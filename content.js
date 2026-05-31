// X Auto Blocker - Content Script
// 默认隐藏推文，24小时内触发10次自动升级屏蔽

(function () {
  'use strict';

  const BLOCK_THRESHOLD = 10;   // 触发次数阈值
  const BLOCK_WINDOW_MS = 24 * 60 * 60 * 1000; // 24小时
  const TRANSLATED_MARKERS = [
    'show original',
    'see original',
    'view original',
    'translated from',
    'translated by',
    '查看原文',
    '显示原文',
    '看原文',
    '翻译自',
    '已翻译',
    '自动翻译'
  ];

  // ==================== 状态管理 ====================
  let config = {
    enabled: true,
    keywords: [],
    blockedCount: 0,
    blockThreshold: BLOCK_THRESHOLD,
    whitelist: ['grok']  // 白名单账号（不区分大小写）
  };

  let blockedAccounts = new Set();
  // triggerLog: { [handle]: [timestamp, timestamp, ...] }
  let triggerLog = {};
  let records = [];

  // ==================== 初始化 ====================
  async function init() {
    const stored = await chrome.storage.local.get(['config', 'blockedAccounts', 'records', 'triggerLog']);
    if (stored.config) config = { ...config, ...stored.config };
    if (stored.blockedAccounts) blockedAccounts = new Set(stored.blockedAccounts);
    if (stored.records) records = stored.records;
    if (stored.triggerLog) triggerLog = stored.triggerLog;

    // observer 一直运行，由 config.enabled 在处理函数里门控
    observeTweets();
    if (config.enabled) scanExistingTweets();
    console.log('[X Auto Blocker] 已加载，enabled:', config.enabled, '关键词数量:', config.keywords.length);
  }

  // ==================== 关键词检测 ====================
  function getMatchedKeywords(text) {
    if (!text || config.keywords.length === 0) return [];
    const lowerText = text.toLowerCase();
    return config.keywords.filter(kw => lowerText.includes(kw.toLowerCase()));
  }

  function hasChineseText(text) {
    return /[\u3400-\u9fff]/.test(text || '');
  }

  function isChineseLang(lang) {
    return /^(zh|cmn|yue)(-|$)/i.test(lang || '');
  }

  function getTweetTextElement(tweetEl) {
    return tweetEl.querySelector('[data-testid="tweetText"]');
  }

  function getTweetBodyText(tweetEl) {
    const textEl = getTweetTextElement(tweetEl);
    return textEl ? (textEl.innerText || textEl.textContent || '') : '';
  }

  function getTranslationMarkerText(tweetEl) {
    const tweetTextEl = getTweetTextElement(tweetEl);
    const nodes = tweetEl.querySelectorAll('button, a, [role="button"], [aria-label]');
    const parts = [];
    nodes.forEach(node => {
      if (tweetTextEl && tweetTextEl.contains(node)) return;
      parts.push(node.getAttribute('aria-label') || '');
      parts.push(node.innerText || node.textContent || '');
    });
    return parts.join(' ').replace(/\s+/g, ' ').toLowerCase();
  }

  function isLikelyTranslatedTweet(tweetEl) {
    const textEl = getTweetTextElement(tweetEl);
    if (!textEl) return false;

    const bodyText = getTweetBodyText(tweetEl);
    const lang = (textEl.getAttribute('lang') || '').toLowerCase();

    if (hasChineseText(bodyText) && lang && !isChineseLang(lang)) return true;

    const markerText = getTranslationMarkerText(tweetEl);
    return TRANSLATED_MARKERS.some(marker => markerText.includes(marker));
  }

  function getTweetText(tweetEl) {
    const userEl = tweetEl.querySelector('[data-testid="User-Name"]');
    return getTweetBodyText(tweetEl) + ' ' + (userEl ? userEl.innerText : '');
  }

  function getAccountHandle(tweetEl) {
    const links = tweetEl.querySelectorAll('a[href*="/status/"]');
    for (const link of links) {
      const match = link.href.match(/x\.com\/([^/]+)\/status/);
      if (match) return match[1];
    }
    const userLink = tweetEl.querySelector('a[role="link"][href^="/"]');
    if (userLink) {
      const match = userLink.href.match(/\/([^/]+)$/);
      if (match && !match[1].includes('.')) return match[1];
    }
    return null;
  }

  function getTweetUrl(tweetEl) {
    const links = tweetEl.querySelectorAll('a[href*="/status/"]');
    for (const link of links) {
      if (/\/status\/\d+/.test(link.href)) return link.href;
    }
    return null;
  }

  // ==================== 触发计数 ====================
  // 记录一次触发，返回24h内的触发总次数
  function logTrigger(handle) {
    const now = Date.now();
    if (!triggerLog[handle]) triggerLog[handle] = [];
    // 清除24h之前的记录
    triggerLog[handle] = triggerLog[handle].filter(t => now - t < BLOCK_WINDOW_MS);
    triggerLog[handle].push(now);
    chrome.storage.local.set({ triggerLog });
    return triggerLog[handle].length;
  }

  function getTriggerCount(handle) {
    if (!triggerLog[handle]) return 0;
    const now = Date.now();
    return triggerLog[handle].filter(t => now - t < BLOCK_WINDOW_MS).length;
  }

  // ==================== 屏蔽操作 ====================
  async function blockAccount(tweetEl, handle, tweetUrl, matchedKeywords) {
    if (blockedAccounts.has(handle)) return;
    try {
      const moreBtn = tweetEl.querySelector('[data-testid="caret"]');
      if (!moreBtn) return;
      moreBtn.click();
      await sleep(500);

      const menuItems = document.querySelectorAll('[role="menuitem"]');
      let blockItem = null;
      for (const item of menuItems) {
        const t = item.innerText || '';
        if (t.includes('屏蔽') || t.toLowerCase().includes('block')) { blockItem = item; break; }
      }

      if (blockItem) {
        blockItem.click();
        await sleep(300);
        const confirmBtn = document.querySelector('[data-testid="confirmationSheetConfirm"]');
        if (confirmBtn) {
          confirmBtn.click();
          blockedAccounts.add(handle);
          config.blockedCount++;
          addRecord({ handle, action: 'blocked', tweetText: getTweetText(tweetEl), tweetUrl, matchedKeywords });
          saveConfig();
          notifyUpdate();
          console.log(`[X Auto Blocker] 已屏蔽账号: @${handle}`);
        }
      } else {
        document.body.click();
      }
    } catch (e) {
      console.error('[X Auto Blocker] 屏蔽失败:', e);
      document.body.click();
    }
  }

  function hideTweet(tweetEl, handle, tweetUrl, matchedKeywords, triggerCount) {
    tweetEl.style.display = 'none';
    tweetEl.setAttribute('data-auto-blocked', 'true');
    addRecord({
      handle: handle || '未知账号',
      action: 'hidden',
      tweetText: getTweetText(tweetEl),
      tweetUrl,
      matchedKeywords,
      triggerCount
    });
  }

  // ==================== 推文扫描 ====================
  async function processTweet(tweetEl) {
    if (!config.enabled) return; // 总开关关闭则直接跳过
    if (tweetEl.hasAttribute('data-xblocker-checked')) return;
    tweetEl.setAttribute('data-xblocker-checked', 'true');

    if (isLikelyTranslatedTweet(tweetEl)) {
      console.log('[X Auto Blocker] 检测到 X 自动翻译内容，跳过关键词匹配');
      return;
    }

    const text = getTweetText(tweetEl);
    const matchedKeywords = getMatchedKeywords(text);
    if (matchedKeywords.length === 0) return;

    const handle = getAccountHandle(tweetEl);
    const tweetUrl = getTweetUrl(tweetEl);

    // 白名单账号跳过
    if (handle && config.whitelist && config.whitelist.some(w => w.toLowerCase() === handle.toLowerCase())) {
      console.log(`[X Auto Blocker] @${handle} 在白名单中，跳过`);
      return;
    }

    // 已屏蔽账号：直接隐藏，不重复操作
    if (handle && blockedAccounts.has(handle)) {
      tweetEl.style.display = 'none';
      tweetEl.setAttribute('data-auto-blocked', 'true');
      return;
    }

    // 记录触发次数
    const triggerCount = handle ? logTrigger(handle) : 1;
    const threshold = config.blockThreshold || BLOCK_THRESHOLD;

    console.log(`[X Auto Blocker] @${handle || '未知'} 触发 ${triggerCount}/${threshold} 次，关键词: ${matchedKeywords.join(', ')}`);

    // 达到阈值 → 升级为屏蔽
    if (handle && triggerCount >= threshold) {
      console.log(`[X Auto Blocker] @${handle} 24h内触发 ${triggerCount} 次，升级屏蔽`);
      await blockAccount(tweetEl, handle, tweetUrl, matchedKeywords);
    }

    // 屏蔽未成功时，至少先本地隐藏
    if (!handle || !blockedAccounts.has(handle)) {
      hideTweet(tweetEl, handle, tweetUrl, matchedKeywords, triggerCount);
      notifyUpdate();
    }
  }

  function scanExistingTweets() {
    document.querySelectorAll('[data-testid="tweet"]').forEach(t => processTweet(t));
  }

  function rescanExistingTweets(options = {}) {
    if (options.reveal) {
      revealHiddenTweets();
    } else {
      document.querySelectorAll('[data-xblocker-checked]').forEach(el => {
        el.removeAttribute('data-xblocker-checked');
      });
    }
    if (config.enabled) scanExistingTweets();
  }

  function configChangeNeedsRescan(prev, next) {
    const sig = list => JSON.stringify((list || []).map(x => String(x).toLowerCase()));
    return (prev.enabled !== next.enabled)
      || ((prev.blockThreshold || BLOCK_THRESHOLD) !== (next.blockThreshold || BLOCK_THRESHOLD))
      || (sig(prev.keywords) !== sig(next.keywords))
      || (sig(prev.whitelist) !== sig(next.whitelist));
  }

  // ==================== MutationObserver ====================
  function observeTweets() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches?.('[data-testid="tweet"]')) processTweet(node);
          node.querySelectorAll?.('[data-testid="tweet"]').forEach(t => processTweet(t));
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ==================== 通知 ====================
  function notifyUpdate() {
    chrome.runtime.sendMessage({ type: 'BLOCKED', count: config.blockedCount }).catch(() => {});
  }

  // ==================== 记录 ====================
  function addRecord({ handle, action, tweetText, tweetUrl, matchedKeywords, triggerCount }) {
    const record = {
      id: Date.now(),
      handle,
      action,
      tweetText: (tweetText || '').slice(0, 100),
      tweetUrl: tweetUrl || null,
      matchedKeywords: matchedKeywords || [],
      triggerCount: triggerCount || null,
      time: new Date().toISOString()
    };
    if (tweetUrl) {
      const existing = records.find(r => r.action === action && r.tweetUrl === tweetUrl);
      if (existing) {
        Object.assign(existing, record, { id: existing.id });
        chrome.storage.local.set({ records });
        return;
      }
    }
    records.unshift(record);
    if (records.length > 500) records = records.slice(0, 500);
    chrome.storage.local.set({ records });
  }

  // ==================== 持久化 ====================
  async function saveConfig() {
    await chrome.storage.local.set({
      config,
      blockedAccounts: [...blockedAccounts],
      records,
      triggerLog
    });
  }

  // ==================== 消息监听 ====================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_STATUS') {
      sendResponse({
        enabled: config.enabled,
        blockedCount: config.blockedCount,
        keywordCount: config.keywords.length,
        blockThreshold: config.blockThreshold || BLOCK_THRESHOLD
      });
    }

    if (msg.type === 'UPDATE_CONFIG') {
      config = { ...config, ...msg.config };
      saveConfig();
      sendResponse({ ok: true });
      if (config.enabled) rescanExistingTweets({ reveal: true });
      else revealHiddenTweets();
    }

    if (msg.type === 'ADD_KEYWORD') {
      if (!config.keywords.includes(msg.keyword)) {
        config.keywords.unshift(msg.keyword); // 新增的放最前面
        saveConfig();
        rescanExistingTweets();
      }
      sendResponse({ keywords: config.keywords });
    }

    if (msg.type === 'REMOVE_KEYWORD') {
      config.keywords = config.keywords.filter(k => k !== msg.keyword);
      saveConfig();
      rescanExistingTweets({ reveal: true });
      sendResponse({ keywords: config.keywords });
    }

    if (msg.type === 'GET_KEYWORDS') {
      sendResponse({ keywords: config.keywords });
    }

    if (msg.type === 'GET_WHITELIST') {
      sendResponse({ whitelist: config.whitelist || [] });
    }

    if (msg.type === 'ADD_WHITELIST') {
      if (!config.whitelist) config.whitelist = [];
      const handle = msg.handle.replace(/^@/, '').trim();
      if (handle && !config.whitelist.some(w => w.toLowerCase() === handle.toLowerCase())) {
        config.whitelist.push(handle);
        saveConfig();
        rescanExistingTweets({ reveal: true });
      }
      sendResponse({ whitelist: config.whitelist });
    }

    if (msg.type === 'REMOVE_WHITELIST') {
      config.whitelist = (config.whitelist || []).filter(w => w.toLowerCase() !== msg.handle.toLowerCase());
      saveConfig();
      rescanExistingTweets({ reveal: true });
      sendResponse({ whitelist: config.whitelist });
    }

    if (msg.type === 'GET_TRIGGER_LOG') {
      // 返回各账号24h内触发次数
      const now = Date.now();
      const summary = {};
      for (const [handle, times] of Object.entries(triggerLog)) {
        const count = times.filter(t => now - t < BLOCK_WINDOW_MS).length;
        if (count > 0) summary[handle] = count;
      }
      sendResponse({ summary, threshold: config.blockThreshold || BLOCK_THRESHOLD });
    }

    if (msg.type === 'RESET_COUNT') {
      config.blockedCount = 0;
      triggerLog = {};
      saveConfig();
      sendResponse({ ok: true });
    }

    if (msg.type === 'GET_RECORDS') {
      sendResponse({ records });
    }

    if (msg.type === 'CLEAR_RECORDS') {
      records = [];
      chrome.storage.local.set({ records });
      sendResponse({ ok: true });
    }

    if (msg.type === 'SET_RECORDS') {
      records = msg.records || [];
      chrome.storage.local.set({ records });
      sendResponse({ ok: true });
    }

    if (msg.type === 'RELOAD_CONFIG') {
      chrome.storage.local.get('config').then(stored => {
        if (stored.config) config = { ...config, ...stored.config };
        if (config.enabled) rescanExistingTweets({ reveal: true });
        else revealHiddenTweets();
        sendResponse({ ok: true });
      });
      return true;
    }

    return true;
  });

  // 关掉时把已隐藏的推文还原显示，并清除"已检查"标记
  function revealHiddenTweets() {
    document.querySelectorAll('[data-auto-blocked="true"]').forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-auto-blocked');
    });
    document.querySelectorAll('[data-xblocker-checked]').forEach(el => {
      el.removeAttribute('data-xblocker-checked');
    });
  }

  // 当 popup 直接写 storage（如导入备份），同步到运行时配置
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.config?.newValue) {
      const prevConfig = { ...config };
      config = { ...config, ...changes.config.newValue };
      if (configChangeNeedsRescan(prevConfig, config)) {
        const wasEnabled = prevConfig.enabled;
        if (wasEnabled && !config.enabled) {
          // 关掉：还原已隐藏的，并清标记
          revealHiddenTweets();
          console.log('[X Auto Blocker] 已禁用，还原所有隐藏推文');
        } else if (!wasEnabled && config.enabled) {
          // 开启：清标记重新扫
          rescanExistingTweets();
        } else if (config.enabled) {
          rescanExistingTweets({ reveal: true });
        }
      }
    }
    if (changes.blockedAccounts?.newValue) {
      blockedAccounts = new Set(changes.blockedAccounts.newValue);
    }
    if (changes.records?.newValue) {
      records = changes.records.newValue;
    }
    if (changes.triggerLog?.newValue) {
      triggerLog = changes.triggerLog.newValue;
    }
  });

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  init();
})();

