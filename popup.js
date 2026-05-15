// Auto Blocker - Popup Script (X + YouTube)

let currentPlatform = 'x';
let allRecords = [];
let currentThreshold = 10;

// ==================== 平台相关常量 ====================
const PLATFORM_META = {
  x: {
    configKey: 'config',
    recordsKey: 'records',
    reloadMsg: 'RELOAD_CONFIG',
    hasThreshold: true,
    hasBlockTab: true,
    keywordPlaceholder: '添加关键词...',
    whitelistPlaceholder: '输入账号名，如 grok',
    whitelistEmpty: '暂无白名单账号',
    statusOnlineHint: '请打开 X.com'
  },
  youtube: {
    configKey: 'youtube_config',
    recordsKey: 'youtube_records',
    reloadMsg: 'YT_RELOAD_CONFIG',
    hasThreshold: false,
    hasBlockTab: false,
    keywordPlaceholder: '添加关键词（匹配标题/频道）...',
    whitelistPlaceholder: '输入频道名，如 LinusTechTips',
    whitelistEmpty: '暂无白名单频道',
    statusOnlineHint: '请打开 YouTube'
  }
};

function meta() { return PLATFORM_META[currentPlatform]; }

// ==================== 消息发送 ====================
async function sendToContent(msg) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) { return null; }
}

// ==================== 平台感知 storage 读写 ====================
async function getPlatformConfig() {
  const key = meta().configKey;
  const stored = await chrome.storage.local.get(key);
  return stored[key] || {};
}
async function setPlatformConfig(patch) {
  const key = meta().configKey;
  const cfg = await getPlatformConfig();
  const merged = { ...cfg, ...patch };
  await chrome.storage.local.set({ [key]: merged });
  return merged;
}
async function getPlatformRecords() {
  const key = meta().recordsKey;
  const stored = await chrome.storage.local.get(key);
  return stored[key] || [];
}
async function setPlatformRecords(records) {
  const key = meta().recordsKey;
  await chrome.storage.local.set({ [key]: records });
}
async function notifyReload() {
  await sendToContent({ type: meta().reloadMsg });
}

// ==================== 渲染 ====================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setEnableLabel(enabled) {
  document.getElementById('enableLabel').textContent = enabled ? '开启' : '关闭';
}

function updateStats(records) {
  if (currentPlatform === 'x') {
    const blocked = records.filter(r => r.action === 'blocked').length;
    const hidden  = records.filter(r => r.action === 'hidden').length;
    document.getElementById('blockedCount').textContent = blocked;
    document.getElementById('hiddenCount').textContent  = hidden;
  } else {
    // YouTube 只有隐藏
    document.getElementById('blockedCount').textContent = '–';
    document.getElementById('hiddenCount').textContent  = records.length;
  }
}

function formatTime(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
  return d.toLocaleDateString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function renderXRecord(r) {
  const threshold = currentThreshold;
  const count = r.triggerCount || 0;
  const pct = r.action === 'hidden' && count ? Math.min(100, Math.round(count / threshold * 100)) : 0;
  const progressHtml = r.action === 'hidden' && count ? `
    <div class="trigger-progress">
      <div class="trigger-bar" style="width:${pct}%"></div>
    </div>
    <div class="trigger-label">${count}/${threshold} 次触发</div>` : '';

  return `
  <div class="record-item ${r.tweetUrl ? 'clickable' : ''}" data-url="${escapeHtml(r.tweetUrl || '')}">
    <div class="record-body">
      <div class="record-handle">@${escapeHtml(r.handle)} ${r.tweetUrl ? '<span class="link-hint">↗</span>' : ''}</div>
      ${r.tweetText ? `<div class="record-text" title="${escapeHtml(r.tweetText)}">${escapeHtml(r.tweetText)}</div>` : ''}
      ${r.matchedKeywords && r.matchedKeywords.length ? `
        <div class="record-keywords">
          ${r.matchedKeywords.map(kw => `<span class="kw-hit">🔑 ${escapeHtml(kw)}</span>`).join('')}
        </div>` : ''}
      ${progressHtml}
      <div class="record-time">${formatTime(r.time)}</div>
    </div>
  </div>`;
}

function renderYtRecord(r) {
  return `
  <div class="record-item">
    <div class="record-body">
      <div class="record-handle">${escapeHtml(r.title || '未知视频')}</div>
      <div class="record-text">${escapeHtml(r.channel || '未知频道')}</div>
      ${r.matchedKeywords && r.matchedKeywords.length ? `
        <div class="record-keywords">
          ${r.matchedKeywords.map(kw => `<span class="kw-hit">🔑 ${escapeHtml(kw)}</span>`).join('')}
        </div>` : ''}
      <div class="record-time">${formatTime(r.time)}</div>
    </div>
  </div>`;
}

function renderRecordList(listEl, countEl, records, type) {
  let filtered;
  let label;
  if (currentPlatform === 'x') {
    filtered = records.filter(r => r.action === type);
    label = type === 'blocked' ? '屏蔽' : '隐藏';
  } else {
    // YouTube 只有 hidden
    if (type === 'blocked') {
      filtered = [];
      label = '屏蔽';
    } else {
      filtered = records;
      label = '隐藏';
    }
  }
  countEl.textContent = filtered.length + ' 条记录';

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div>暂无${label}记录</div>`;
    return;
  }

  const renderFn = currentPlatform === 'x' ? renderXRecord : renderYtRecord;
  listEl.innerHTML = filtered.map(renderFn).join('');

  listEl.querySelectorAll('.record-item.clickable').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  });
}

function renderAllRecordLists() {
  renderRecordList(
    document.getElementById('blockedRecordsList'),
    document.getElementById('blockedRecordsCount'),
    allRecords, 'blocked'
  );
  renderRecordList(
    document.getElementById('hiddenRecordsList'),
    document.getElementById('hiddenRecordsCount'),
    allRecords, 'hidden'
  );
}

function renderKeywords(keywords) {
  const list = document.getElementById('kwList');
  list.innerHTML = '';
  keywords.forEach(kw => {
    const tag = document.createElement('div');
    tag.className = 'kw-tag';
    tag.innerHTML = `<span>${escapeHtml(kw)}</span><button class="kw-remove" data-kw="${escapeHtml(kw)}">×</button>`;
    list.appendChild(tag);
  });
  list.querySelectorAll('.kw-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.getAttribute('data-kw');
      const cfg = await getPlatformConfig();
      const existing = cfg.keywords || [];
      const next = existing.filter(k => k !== target);
      await setPlatformConfig({ keywords: next });
      await notifyReload();
      renderKeywords(next);
      document.getElementById('keywordCount').textContent = next.length;
    });
  });
}

function renderWhitelist(whitelist) {
  const list = document.getElementById('wlList');
  list.innerHTML = '';
  if (whitelist.length === 0) {
    list.innerHTML = `<div style="font-size:11px;color:#b8a880;padding:4px 0;">${meta().whitelistEmpty}</div>`;
    return;
  }
  whitelist.forEach(handle => {
    const tag = document.createElement('div');
    tag.className = 'kw-tag';
    tag.style.borderColor = '#22c55e44';
    const prefix = currentPlatform === 'x' ? '@' : '';
    tag.innerHTML = `<span style="color:#22c55e">${prefix}${escapeHtml(handle)}</span><button class="kw-remove" data-handle="${escapeHtml(handle)}">×</button>`;
    list.appendChild(tag);
  });
  list.querySelectorAll('.kw-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.getAttribute('data-handle');
      const cfg = await getPlatformConfig();
      const existing = cfg.whitelist || [];
      const next = existing.filter(w => w.toLowerCase() !== target.toLowerCase());
      await setPlatformConfig({ whitelist: next });
      await notifyReload();
      renderWhitelist(next);
    });
  });
}

// ==================== 平台切换 ====================
async function switchPlatform(platform) {
  if (platform === currentPlatform) return;
  currentPlatform = platform;
  await chrome.storage.local.set({ ui_platform: platform });

  // 高亮切换按钮
  document.querySelectorAll('.platform-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.platform === platform);
  });

  applyPlatformUI();
  await loadPlatformData();
}

function applyPlatformUI() {
  const m = meta();
  // 屏蔽 tab
  document.getElementById('tabBlocked').style.display = m.hasBlockTab ? '' : 'none';
  // 已屏蔽统计列：YouTube 显示 "–"
  // 设置 tab 区块
  document.getElementById('sectionThreshold').style.display = m.hasThreshold ? '' : 'none';
  document.getElementById('sectionYoutubeInfo').style.display = m.hasThreshold ? 'none' : '';
  // 输入框 placeholder
  document.getElementById('kwInput').placeholder = m.keywordPlaceholder;
  document.getElementById('wlInput').placeholder = m.whitelistPlaceholder;

  // 若当前选中的是屏蔽 tab 但平台不支持，跳回 设置
  if (!m.hasBlockTab) {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.tab === 'blocked-records') {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector('.tab[data-tab="settings"]').classList.add('active');
      document.getElementById('tab-settings').classList.add('active');
    }
  }
}

async function loadPlatformData() {
  const cfg = await getPlatformConfig();
  const records = await getPlatformRecords();

  // 开关
  const enabled = cfg.enabled !== false;
  document.getElementById('enableToggle').checked = enabled;
  setEnableLabel(enabled);

  // 状态点（看当前 tab 是不是该平台）
  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const status = await sendToContent({ type: currentPlatform === 'x' ? 'GET_STATUS' : 'YT_GET_STATUS' });
  if (status) {
    dot.classList.add('active');
    statusText.textContent = '运行中';
  } else {
    dot.classList.remove('active');
    statusText.textContent = meta().statusOnlineHint;
  }

  // 阈值（X 才有）
  if (meta().hasThreshold) {
    currentThreshold = cfg.blockThreshold || 10;
    document.getElementById('thresholdVal').textContent = currentThreshold;
    updateThresholdTip(currentThreshold);
  }

  // 关键词/白名单/记录
  const keywords = cfg.keywords || [];
  const whitelist = cfg.whitelist || [];
  renderKeywords(keywords);
  renderWhitelist(whitelist);
  document.getElementById('keywordCount').textContent = keywords.length;

  allRecords = records;
  updateStats(records);
  renderAllRecordLists();
}

// ==================== 初始化 ====================
async function init() {
  document.getElementById('aboutVersion').textContent = 'v' + chrome.runtime.getManifest().version;

  // 读取上次平台选择
  const stored = await chrome.storage.local.get('ui_platform');
  currentPlatform = stored.ui_platform || 'x';
  document.querySelectorAll('.platform-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.platform === currentPlatform);
  });

  applyPlatformUI();
  await loadPlatformData();
}

// ==================== 事件绑定 ====================

// 平台切换按钮
document.querySelectorAll('.platform-pill').forEach(p => {
  p.addEventListener('click', () => switchPlatform(p.dataset.platform));
});

// 总开关
document.getElementById('enableToggle').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  setEnableLabel(enabled);
  await setPlatformConfig({ enabled });
  await notifyReload();
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// 清空屏蔽记录（仅 X）
document.getElementById('clearBlockedBtn').addEventListener('click', async () => {
  if (currentPlatform !== 'x') return;
  if (!confirm('确认清空所有屏蔽记录？')) return;
  allRecords = allRecords.filter(r => r.action !== 'blocked');
  await setPlatformRecords(allRecords);
  updateStats(allRecords);
  renderAllRecordLists();
});

// 清空隐藏记录
document.getElementById('clearHiddenBtn').addEventListener('click', async () => {
  if (!confirm('确认清空所有隐藏记录？')) return;
  if (currentPlatform === 'x') {
    allRecords = allRecords.filter(r => r.action !== 'hidden');
  } else {
    allRecords = [];
  }
  await setPlatformRecords(allRecords);
  updateStats(allRecords);
  renderAllRecordLists();
});

// Threshold（仅 X）
function updateThresholdTip(val) {
  document.getElementById('thresholdTip').textContent =
    `默认隐藏推文，24小时内触发 ${val} 次后自动屏蔽账号`;
}
document.getElementById('thresholdDown').addEventListener('click', async () => {
  if (!meta().hasThreshold) return;
  if (currentThreshold <= 1) return;
  currentThreshold--;
  document.getElementById('thresholdVal').textContent = currentThreshold;
  updateThresholdTip(currentThreshold);
  await setPlatformConfig({ blockThreshold: currentThreshold });
  await notifyReload();
});
document.getElementById('thresholdUp').addEventListener('click', async () => {
  if (!meta().hasThreshold) return;
  if (currentThreshold >= 99) return;
  currentThreshold++;
  document.getElementById('thresholdVal').textContent = currentThreshold;
  updateThresholdTip(currentThreshold);
  await setPlatformConfig({ blockThreshold: currentThreshold });
  await notifyReload();
});

// 添加关键词
async function addKeyword() {
  const input = document.getElementById('kwInput');
  const kw = input.value.trim();
  if (!kw) return;
  const cfg = await getPlatformConfig();
  const existing = cfg.keywords || [];
  if (existing.includes(kw)) { input.value = ''; return; }
  const next = [kw, ...existing];
  await setPlatformConfig({ keywords: next });
  await notifyReload();
  renderKeywords(next);
  document.getElementById('keywordCount').textContent = next.length;
  input.value = '';
}
document.getElementById('kwAdd').addEventListener('click', addKeyword);
document.getElementById('kwInput').addEventListener('keydown', e => { if (e.key === 'Enter') addKeyword(); });

// 添加白名单
async function addWhitelist() {
  const input = document.getElementById('wlInput');
  const handle = input.value.replace(/^@/, '').trim();
  if (!handle) return;
  const cfg = await getPlatformConfig();
  const existing = cfg.whitelist || [];
  if (existing.some(w => w.toLowerCase() === handle.toLowerCase())) { input.value = ''; return; }
  const next = [handle, ...existing];
  await setPlatformConfig({ whitelist: next });
  await notifyReload();
  renderWhitelist(next);
  input.value = '';
  const prefix = currentPlatform === 'x' ? '@' : '';
  showToast(`✅ 已添加 ${prefix}${handle} 到白名单`, '#22c55e');
}
document.getElementById('wlAdd').addEventListener('click', addWhitelist);
document.getElementById('wlInput').addEventListener('keydown', e => { if (e.key === 'Enter') addWhitelist(); });

// Toast
function showToast(msg, color) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = color || '#c9b888';
  t.style.color = color ? '#fff' : '#4a3d2a';
  t.style.background = color ? color + '22' : '#fff8e6';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ==================== 关键词导出/导入（仅当前平台）====================
document.getElementById('exportBtn').addEventListener('click', async () => {
  const cfg = await getPlatformConfig();
  const keywords = cfg.keywords || [];
  if (!keywords.length) { showToast('❌ 没有关键词可导出', '#e0415a'); return; }

  const data = {
    version: '1.0',
    platform: currentPlatform,
    exportTime: new Date().toISOString(),
    keywords
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `auto-blocker-${currentPlatform}-keywords-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✅ 已导出 ${keywords.length} 个关键词`, '#22c55e');
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const text = await file.text();
  let keywords = [];

  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      keywords = json.filter(k => typeof k === 'string' && k.trim());
    } else if (json.keywords && Array.isArray(json.keywords)) {
      keywords = json.keywords.filter(k => typeof k === 'string' && k.trim());
    } else {
      showToast('❌ 格式不支持', '#e0415a'); return;
    }
  } catch {
    keywords = text.split('\n').map(l => l.trim()).filter(Boolean);
  }

  if (keywords.length === 0) { showToast('❌ 未找到关键词', '#e0415a'); return; }

  const cfg = await getPlatformConfig();
  const existing = cfg.keywords || [];
  const existingSet = new Set(existing);
  const newOnes = keywords.filter(k => !existingSet.has(k));

  if (newOnes.length === 0) { showToast('全部关键词已存在，无需导入', '#f59e0b'); return; }

  const merged = [...newOnes, ...existing];
  await setPlatformConfig({ keywords: merged });
  await notifyReload();
  renderKeywords(merged);
  document.getElementById('keywordCount').textContent = merged.length;
  showToast(`✅ 导入 ${newOnes.length} 个新关键词`, '#22c55e');
});

// ==================== 全部备份/恢复（跨平台）====================
document.getElementById('exportAllBtn').addEventListener('click', async () => {
  const stored = await chrome.storage.local.get([
    'config', 'blockedAccounts', 'records', 'triggerLog',
    'youtube_config', 'youtube_records'
  ]);
  const data = {
    type: 'full',
    version: '2.0',
    exportTime: new Date().toISOString(),
    x: {
      config: stored.config || {},
      blockedAccounts: stored.blockedAccounts || [],
      records: stored.records || [],
      triggerLog: stored.triggerLog || {}
    },
    youtube: {
      config: stored.youtube_config || {},
      records: stored.youtube_records || []
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `auto-blocker-full-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const xKw = data.x.config.keywords?.length || 0;
  const ytKw = data.youtube.config.keywords?.length || 0;
  showToast(`✅ 全部备份已导出（X:${xKw}词 / YT:${ytKw}词）`, '#22c55e');
});

document.getElementById('importAllBtn').addEventListener('click', () => {
  document.getElementById('importAllFile').click();
});

document.getElementById('importAllFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  let json;
  try { json = JSON.parse(await file.text()); }
  catch { showToast('❌ JSON 格式错误', '#e0415a'); return; }

  if (json.type !== 'full') {
    showToast('❌ 不是全部备份文件', '#e0415a');
    return;
  }

  // 兼容 v1.0（只有 X 平面）和 v2.0（分平台）
  const isV2 = json.version === '2.0' || json.x || json.youtube;
  const impX = isV2 ? (json.x || {}) : {
    config: json.config || {},
    blockedAccounts: json.blockedAccounts || [],
    records: json.records || [],
    triggerLog: json.triggerLog || {}
  };
  const impYt = isV2 ? (json.youtube || {}) : { config: {}, records: [] };

  // === X 合并 ===
  const stored = await chrome.storage.local.get(['config', 'blockedAccounts', 'records', 'triggerLog', 'youtube_config', 'youtube_records']);
  const curXCfg = stored.config || {};
  const curXBlocked = stored.blockedAccounts || [];
  const curXRecords = stored.records || [];
  const curXTrigger = stored.triggerLog || {};
  const impXCfg = impX.config || {};

  const xKwSet = new Set(curXCfg.keywords || []);
  const xNewKw = (impXCfg.keywords || []).filter(k => !xKwSet.has(k));
  const xMergedKw = [...xNewKw, ...(curXCfg.keywords || [])];

  const xWlLower = new Set((curXCfg.whitelist || []).map(w => w.toLowerCase()));
  const xNewWl = (impXCfg.whitelist || []).filter(w => !xWlLower.has(w.toLowerCase()));
  const xMergedWl = [...xNewWl, ...(curXCfg.whitelist || [])];

  const xMergedBlocked = [...new Set([...curXBlocked, ...(impX.blockedAccounts || [])])];

  const xRecIds = new Set(curXRecords.map(r => r.id));
  const xNewRecs = (impX.records || []).filter(r => !xRecIds.has(r.id));
  const xMergedRecords = [...curXRecords, ...xNewRecs]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 500);

  const now = Date.now();
  const WINDOW = 24 * 60 * 60 * 1000;
  const xMergedTrigger = { ...curXTrigger };
  for (const [h, times] of Object.entries(impX.triggerLog || {})) {
    const set = new Set([...(xMergedTrigger[h] || []), ...times]);
    xMergedTrigger[h] = [...set].filter(t => now - t < WINDOW);
  }
  for (const h of Object.keys(xMergedTrigger)) {
    xMergedTrigger[h] = (xMergedTrigger[h] || []).filter(t => now - t < WINDOW);
    if (xMergedTrigger[h].length === 0) delete xMergedTrigger[h];
  }

  const newXConfig = {
    ...curXCfg,
    ...impXCfg,
    keywords: xMergedKw,
    whitelist: xMergedWl,
    blockThreshold: impXCfg.blockThreshold || curXCfg.blockThreshold || 10,
    blockedCount: xMergedBlocked.length
  };

  // === YouTube 合并 ===
  const curYtCfg = stored.youtube_config || {};
  const curYtRecords = stored.youtube_records || [];
  const impYtCfg = impYt.config || {};

  const ytKwSet = new Set(curYtCfg.keywords || []);
  const ytNewKw = (impYtCfg.keywords || []).filter(k => !ytKwSet.has(k));
  const ytMergedKw = [...ytNewKw, ...(curYtCfg.keywords || [])];

  const ytWlLower = new Set((curYtCfg.whitelist || []).map(w => w.toLowerCase()));
  const ytNewWl = (impYtCfg.whitelist || []).filter(w => !ytWlLower.has(w.toLowerCase()));
  const ytMergedWl = [...ytNewWl, ...(curYtCfg.whitelist || [])];

  const ytRecIds = new Set(curYtRecords.map(r => r.id));
  const ytNewRecs = (impYt.records || []).filter(r => !ytRecIds.has(r.id));
  const ytMergedRecords = [...curYtRecords, ...ytNewRecs]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 500);

  const newYtConfig = {
    ...curYtCfg,
    ...impYtCfg,
    keywords: ytMergedKw,
    whitelist: ytMergedWl
  };

  // === 写回 ===
  await chrome.storage.local.set({
    config: newXConfig,
    blockedAccounts: xMergedBlocked,
    records: xMergedRecords,
    triggerLog: xMergedTrigger,
    youtube_config: newYtConfig,
    youtube_records: ytMergedRecords
  });

  // 通知双方 content script
  await sendToContent({ type: 'RELOAD_CONFIG' });
  await sendToContent({ type: 'YT_RELOAD_CONFIG' });

  await loadPlatformData();
  showToast(`✅ 已合并 X:+${xNewKw.length}词/+${xNewRecs.length}记录 YT:+${ytNewKw.length}词/+${ytNewRecs.length}记录`, '#22c55e');
});

// Reset 重置当前平台统计
document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm(`确认重置 ${currentPlatform === 'x' ? 'X' : 'YouTube'} 的统计数据？`)) return;
  if (currentPlatform === 'x') {
    await sendToContent({ type: 'RESET_COUNT' });
    await chrome.storage.local.set({ records: [], blockedAccounts: [], triggerLog: {} });
    const cfg = await getPlatformConfig();
    await setPlatformConfig({ ...cfg, blockedCount: 0 });
  } else {
    await setPlatformRecords([]);
    await notifyReload();
  }
  allRecords = [];
  updateStats(allRecords);
  renderAllRecordLists();
});

// 后台消息：当 content script 屏蔽/隐藏了内容
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'BLOCKED' || msg.type === 'YT_HIDDEN') {
    await loadPlatformData();
  }
});

// storage 变化时刷新（其他 tab 同时操作或者 content script 更新）
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const relevant = currentPlatform === 'x'
    ? ['config', 'records', 'blockedAccounts', 'triggerLog']
    : ['youtube_config', 'youtube_records'];
  if (Object.keys(changes).some(k => relevant.includes(k))) {
    loadPlatformData();
  }
});

init();
