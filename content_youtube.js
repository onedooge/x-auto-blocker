// Auto Blocker - YouTube Content Script
// 扫描视频卡片，匹配关键词后本地隐藏

(function () {
  'use strict';

  // ==================== 状态 ====================
  let config = {
    enabled: true,
    keywords: [],
    whitelist: []  // 频道名（不区分大小写）
  };
  let records = [];

  // ==================== 初始化 ====================
  async function init() {
    const stored = await chrome.storage.local.get(['youtube_config', 'youtube_records']);
    if (stored.youtube_config) config = { ...config, ...stored.youtube_config };
    if (stored.youtube_records) records = stored.youtube_records;

    // observer 一直运行，由 config.enabled 在处理函数门控
    observe();
    if (config.enabled) scan();
    console.log('[Auto Blocker / YouTube] 已加载，enabled:', config.enabled, '关键词数量:', config.keywords.length);
  }

  // ==================== 视频卡片选择器 ====================
  // YouTube 不同页面用不同标签，覆盖主要场景
  const TILE_SELECTORS = [
    'ytd-rich-item-renderer',       // 首页/订阅
    'ytd-video-renderer',           // 搜索结果
    'ytd-compact-video-renderer',   // 播放页右侧相关
    'ytd-grid-video-renderer',      // 频道页/列表
    'ytd-reel-item-renderer',       // Shorts
    'ytd-playlist-video-renderer'   // 播放列表
  ];

  function getTitle(tile) {
    const el = tile.querySelector('#video-title, a#video-title-link, yt-formatted-string#video-title');
    return el ? (el.getAttribute('title') || el.innerText || '').trim() : '';
  }

  function getChannel(tile) {
    const el = tile.querySelector('ytd-channel-name a, #channel-name a, #text.ytd-channel-name a, #byline a');
    return el ? (el.innerText || '').trim() : '';
  }

  // ==================== 关键词匹配 ====================
  function getMatched(text) {
    if (!text || config.keywords.length === 0) return [];
    const lower = text.toLowerCase();
    return config.keywords.filter(kw => lower.includes(kw.toLowerCase()));
  }

  function inWhitelist(channel) {
    if (!channel || !config.whitelist || config.whitelist.length === 0) return false;
    return config.whitelist.some(w => w.toLowerCase() === channel.toLowerCase());
  }

  // ==================== 处理单个视频卡片 ====================
  function processTile(tile) {
    if (!config.enabled) return; // 总开关关闭则直接跳过
    if (tile.hasAttribute('data-ab-checked')) return;
    tile.setAttribute('data-ab-checked', 'true');

    const title = getTitle(tile);
    const channel = getChannel(tile);
    if (!title && !channel) return;

    const text = title + ' ' + channel;
    const matched = getMatched(text);
    if (matched.length === 0) return;

    if (inWhitelist(channel)) {
      console.log(`[Auto Blocker / YouTube] 频道 ${channel} 在白名单，跳过`);
      return;
    }

    // 隐藏
    tile.style.display = 'none';
    tile.setAttribute('data-ab-hidden', 'true');

    addRecord({
      title: title.slice(0, 100),
      channel: channel || '未知频道',
      matchedKeywords: matched
    });
    notifyUpdate();

    console.log(`[Auto Blocker / YouTube] 隐藏: ${title} (${channel}) [${matched.join(',')}]`);
  }

  function scan() {
    for (const sel of TILE_SELECTORS) {
      document.querySelectorAll(sel).forEach(processTile);
    }
  }

  function rescan(options = {}) {
    if (options.reveal) {
      revealHidden();
    } else {
      document.querySelectorAll('[data-ab-checked]').forEach(el => el.removeAttribute('data-ab-checked'));
    }
    if (config.enabled) scan();
  }

  function configChangeNeedsRescan(prev, next) {
    const sig = list => JSON.stringify((list || []).map(x => String(x).toLowerCase()));
    return (prev.enabled !== next.enabled)
      || (sig(prev.keywords) !== sig(next.keywords))
      || (sig(prev.whitelist) !== sig(next.whitelist));
  }

  // ==================== MutationObserver ====================
  function observe() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          for (const sel of TILE_SELECTORS) {
            if (node.matches?.(sel)) processTile(node);
            node.querySelectorAll?.(sel).forEach(processTile);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ==================== 记录 ====================
  function addRecord({ title, channel, matchedKeywords }) {
    const existing = records.find(r => r.title === title && r.channel === channel);
    if (existing) {
      existing.matchedKeywords = matchedKeywords;
      existing.time = new Date().toISOString();
      chrome.storage.local.set({ youtube_records: records });
      return;
    }
    const record = {
      id: Date.now() + Math.random(),
      title,
      channel,
      matchedKeywords,
      time: new Date().toISOString()
    };
    records.unshift(record);
    if (records.length > 500) records = records.slice(0, 500);
    chrome.storage.local.set({ youtube_records: records });
  }

  function notifyUpdate() {
    chrome.runtime.sendMessage({ type: 'YT_HIDDEN' }).catch(() => {});
  }

  // ==================== 消息监听 ====================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'YT_GET_STATUS') {
      sendResponse({ enabled: config.enabled, keywordCount: config.keywords.length });
    }
    if (msg.type === 'YT_RELOAD_CONFIG') {
      chrome.storage.local.get(['youtube_config', 'youtube_records']).then(stored => {
        if (stored.youtube_config) config = { ...config, ...stored.youtube_config };
        if (stored.youtube_records) records = stored.youtube_records;
        if (config.enabled) rescan({ reveal: true });
        else revealHidden();
        sendResponse({ ok: true });
      });
      return true;
    }
    return true;
  });

  function revealHidden() {
    document.querySelectorAll('[data-ab-hidden="true"]').forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-ab-hidden');
    });
    document.querySelectorAll('[data-ab-checked]').forEach(el => el.removeAttribute('data-ab-checked'));
  }

  // storage 变化时同步
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.youtube_config?.newValue) {
      const prevConfig = { ...config };
      config = { ...config, ...changes.youtube_config.newValue };
      if (configChangeNeedsRescan(prevConfig, config)) {
        const wasEnabled = prevConfig.enabled;
        if (wasEnabled && !config.enabled) {
          revealHidden();
          console.log('[Auto Blocker / YouTube] 已禁用，还原所有隐藏视频');
        } else if (!wasEnabled && config.enabled) {
          rescan();
        } else if (config.enabled) {
          rescan({ reveal: true });
        }
      }
    }
    if (changes.youtube_records?.newValue) {
      records = changes.youtube_records.newValue;
    }
  });

  init();
})();
