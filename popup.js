// X Auto Blocker - Popup Script

let allRecords = [];

async function sendToContent(msg) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) { return null; }
}

// 直接读写 storage，绕开"必须激活 x.com tab"的限制
async function getStoredConfig() {
  const stored = await chrome.storage.local.get('config');
  return stored.config || {};
}
async function setStoredConfig(patch) {
  const cfg = await getStoredConfig();
  const merged = { ...cfg, ...patch };
  await chrome.storage.local.set({ config: merged });
  return merged;
}
async function getKeywordsAny() {
  const res = await sendToContent({ type: 'GET_KEYWORDS' });
  if (res?.keywords) return res.keywords;
  const cfg = await getStoredConfig();
  return cfg.keywords || [];
}
async function getWhitelistAny() {
  const res = await sendToContent({ type: 'GET_WHITELIST' });
  if (res?.whitelist) return res.whitelist;
  const cfg = await getStoredConfig();
  return cfg.whitelist || [];
}
async function applyKeywords(keywords) {
  await setStoredConfig({ keywords });
  await sendToContent({ type: 'RELOAD_CONFIG' });
  renderKeywords(keywords);
  document.getElementById('keywordCount').textContent = keywords.length;
}
async function applyWhitelist(whitelist) {
  await setStoredConfig({ whitelist });
  await sendToContent({ type: 'RELOAD_CONFIG' });
  renderWhitelist(whitelist);
}

async function init() {
  const status = await sendToContent({ type: 'GET_STATUS' });
  const kwRes  = await sendToContent({ type: 'GET_KEYWORDS' });
  const recRes = await sendToContent({ type: 'GET_RECORDS' });

  const isXPage = status !== null;
  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  if (isXPage) {
    dot.classList.add('active');
    statusText.textContent = '运行中';
    document.getElementById('enableToggle').checked = status.enabled;
    setEnableLabel(status.enabled);
    const threshold = status.blockThreshold || 10;
    document.getElementById('thresholdVal').textContent = threshold;
    updateThresholdTip(threshold);
  } else {
    statusText.textContent = '请打开 X.com';
  }

  // 关键词：优先从 content 拿，没有则从 storage 兜底
  const keywords = kwRes?.keywords || (await getStoredConfig()).keywords || [];
  renderKeywords(keywords);
  document.getElementById('keywordCount').textContent = keywords.length;

  const wlRes = await sendToContent({ type: 'GET_WHITELIST' });
  const whitelist = wlRes?.whitelist || (await getStoredConfig()).whitelist || [];
  renderWhitelist(whitelist);

  if (recRes?.records) {
    allRecords = recRes.records;
    updateStats();
    renderAllRecordLists();
  }
}

function setEnableLabel(enabled) {
  document.getElementById('enableLabel').textContent = enabled ? '开启' : '关闭';
}

function updateStats() {
  const blocked = allRecords.filter(r => r.action === 'blocked').length;
  const hidden  = allRecords.filter(r => r.action === 'hidden').length;
  document.getElementById('blockedCount').textContent = blocked;
  document.getElementById('hiddenCount').textContent  = hidden;
}

function formatTime(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
  return d.toLocaleDateString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function renderRecordList(listEl, countEl, records, action) {
  const filtered = records.filter(r => r.action === action);
  const label = action === 'blocked' ? '屏蔽' : '隐藏';
  countEl.textContent = filtered.length + ' 条记录';

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div>暂无${label}记录</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(r => {
    const threshold = 10;
    const count = r.triggerCount || 0;
    const pct = action === 'hidden' && count ? Math.min(100, Math.round(count / threshold * 100)) : 0;
    const progressHtml = action === 'hidden' && count ? `
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
  }).join('');

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

function renderWhitelist(whitelist) {
  const list = document.getElementById('wlList');
  list.innerHTML = '';
  if (whitelist.length === 0) {
    list.innerHTML = '<div style="font-size:11px;color:#4b5563;padding:4px 0;">暂无白名单账号</div>';
    return;
  }
  whitelist.forEach(handle => {
    const tag = document.createElement('div');
    tag.className = 'kw-tag';
    tag.style.borderColor = '#22c55e44';
    tag.innerHTML = `<span style="color:#22c55e">@${escapeHtml(handle)}</span><button class="kw-remove" data-handle="${escapeHtml(handle)}">×</button>`;
    list.appendChild(tag);
  });
  list.querySelectorAll('.kw-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.getAttribute('data-handle');
      const existing = await getWhitelistAny();
      await applyWhitelist(existing.filter(w => w.toLowerCase() !== target.toLowerCase()));
    });
  });
}

async function addWhitelist() {
  const input = document.getElementById('wlInput');
  const handle = input.value.replace(/^@/, '').trim();
  if (!handle) return;
  const existing = await getWhitelistAny();
  if (existing.some(w => w.toLowerCase() === handle.toLowerCase())) { input.value = ''; return; }
  await applyWhitelist([handle, ...existing]);
  input.value = '';
  showToast(`✅ 已添加 @${handle} 到白名单`, '#22c55e');
}
document.getElementById('wlAdd').addEventListener('click', addWhitelist);
document.getElementById('wlInput').addEventListener('keydown', e => { if (e.key === 'Enter') addWhitelist(); });

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
      const existing = await getKeywordsAny();
      await applyKeywords(existing.filter(k => k !== target));
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// Clear blocked records
document.getElementById('clearBlockedBtn').addEventListener('click', async () => {
  if (!confirm('确认清空所有屏蔽记录？')) return;
  allRecords = allRecords.filter(r => r.action !== 'blocked');
  await sendToContent({ type: 'SET_RECORDS', records: allRecords });
  updateStats();
  renderAllRecordLists();
});

// Clear hidden records
document.getElementById('clearHiddenBtn').addEventListener('click', async () => {
  if (!confirm('确认清空所有隐藏记录？')) return;
  allRecords = allRecords.filter(r => r.action !== 'hidden');
  await sendToContent({ type: 'SET_RECORDS', records: allRecords });
  updateStats();
  renderAllRecordLists();
});

// Threshold controls
function updateThresholdTip(val) {
  document.getElementById('thresholdTip').textContent =
    `默认隐藏推文，24小时内触发 ${val} 次后自动屏蔽账号`;
}

let currentThreshold = 10;
document.getElementById('thresholdDown').addEventListener('click', async () => {
  if (currentThreshold <= 1) return;
  currentThreshold--;
  document.getElementById('thresholdVal').textContent = currentThreshold;
  updateThresholdTip(currentThreshold);
  await sendToContent({ type: 'UPDATE_CONFIG', config: { blockThreshold: currentThreshold } });
});
document.getElementById('thresholdUp').addEventListener('click', async () => {
  if (currentThreshold >= 99) return;
  currentThreshold++;
  document.getElementById('thresholdVal').textContent = currentThreshold;
  updateThresholdTip(currentThreshold);
  await sendToContent({ type: 'UPDATE_CONFIG', config: { blockThreshold: currentThreshold } });
});

// Keywords
async function addKeyword() {
  const input = document.getElementById('kwInput');
  const kw = input.value.trim();
  if (!kw) return;
  const existing = await getKeywordsAny();
  if (existing.includes(kw)) { input.value = ''; return; }
  await applyKeywords([kw, ...existing]); // 新加的放最前
  input.value = '';
}
document.getElementById('kwAdd').addEventListener('click', addKeyword);
document.getElementById('kwInput').addEventListener('keydown', e => { if (e.key === 'Enter') addKeyword(); });

// Toast
function showToast(msg, color) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = color || '#2a2f3e';
  t.style.color = color ? '#fff' : '#d1d5db';
  t.style.background = color ? color + '22' : '#1a1f2e';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// Export
document.getElementById('exportBtn').addEventListener('click', async () => {
  const keywords = await getKeywordsAny();
  if (!keywords.length) { showToast('❌ 没有关键词可导出', '#e0415a'); return; }

  const data = {
    version: '1.0',
    exportTime: new Date().toISOString(),
    keywords
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `x-blocker-keywords-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✅ 已导出 ${keywords.length} 个关键词`, '#22c55e');
});

// Import
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = ''; // 重置，允许重复导入同一文件

  const text = await file.text();
  let keywords = [];

  try {
    // 支持 JSON 格式
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      keywords = json.filter(k => typeof k === 'string' && k.trim());
    } else if (json.keywords && Array.isArray(json.keywords)) {
      keywords = json.keywords.filter(k => typeof k === 'string' && k.trim());
    } else {
      showToast('❌ 格式不支持', '#e0415a'); return;
    }
  } catch {
    // 支持纯文本（每行一个关键词）
    keywords = text.split('\n').map(l => l.trim()).filter(Boolean);
  }

  if (keywords.length === 0) { showToast('❌ 未找到关键词', '#e0415a'); return; }

  // 直接读写 storage，不依赖当前 tab 是否是 x.com
  const existingKw = await getKeywordsAny();
  const existingSet = new Set(existingKw);
  const newOnes = keywords.filter(k => !existingSet.has(k));

  if (newOnes.length === 0) { showToast('全部关键词已存在，无需导入', '#f59e0b'); return; }

  const merged = [...newOnes, ...existingKw]; // 新导入的放最前面
  await setStoredConfig({ keywords: merged });

  // 顺便通知 content script（如果当前 tab 是 x.com 则即时生效；不是也没事）
  await sendToContent({ type: 'RELOAD_CONFIG' });

  renderKeywords(merged);
  document.getElementById('keywordCount').textContent = merged.length;
  showToast(`✅ 导入 ${newOnes.length} 个新关键词`, '#22c55e');
});

// ==================== 全部备份 / 恢复 ====================
document.getElementById('exportAllBtn').addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['config', 'blockedAccounts', 'records', 'triggerLog']);
  const data = {
    type: 'full',
    version: '1.0',
    exportTime: new Date().toISOString(),
    config: stored.config || {},
    blockedAccounts: stored.blockedAccounts || [],
    records: stored.records || [],
    triggerLog: stored.triggerLog || {}
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `x-blocker-full-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const kwCount = data.config.keywords?.length || 0;
  const recCount = data.records.length;
  showToast(`✅ 全部备份已导出（${kwCount}词 / ${recCount}条记录）`, '#22c55e');
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
    showToast('❌ 不是全部备份文件，请用「关键词」标签的导入', '#e0415a');
    return;
  }

  const stored = await chrome.storage.local.get(['config', 'blockedAccounts', 'records', 'triggerLog']);
  const curConfig = stored.config || {};
  const curBlocked = stored.blockedAccounts || [];
  const curRecords = stored.records || [];
  const curTrigger = stored.triggerLog || {};

  const impConfig = json.config || {};
  const impBlocked = json.blockedAccounts || [];
  const impRecords = json.records || [];
  const impTrigger = json.triggerLog || {};

  // 关键词去重并集（导入的放最前）
  const curKw = curConfig.keywords || [];
  const kwSet = new Set(curKw);
  const newKw = (impConfig.keywords || []).filter(k => !kwSet.has(k));
  const mergedKw = [...newKw, ...curKw];

  // 白名单（不区分大小写并集）
  const curWl = curConfig.whitelist || [];
  const wlLower = new Set(curWl.map(w => w.toLowerCase()));
  const newWl = (impConfig.whitelist || []).filter(w => !wlLower.has(w.toLowerCase()));
  const mergedWl = [...newWl, ...curWl];

  // 已屏蔽账号集合并集
  const mergedBlockedSet = new Set([...curBlocked, ...impBlocked]);
  const mergedBlocked = [...mergedBlockedSet];

  // 记录按 id 去重，时间倒序，限 500
  const recIds = new Set(curRecords.map(r => r.id));
  const newRecs = impRecords.filter(r => !recIds.has(r.id));
  const mergedRecords = [...curRecords, ...newRecs]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 500);

  // 触发日志合并 + 24h 过滤
  const now = Date.now();
  const WINDOW = 24 * 60 * 60 * 1000;
  const mergedTrigger = { ...curTrigger };
  for (const [h, times] of Object.entries(impTrigger)) {
    const set = new Set([...(mergedTrigger[h] || []), ...times]);
    mergedTrigger[h] = [...set].filter(t => now - t < WINDOW);
  }
  for (const h of Object.keys(mergedTrigger)) {
    mergedTrigger[h] = (mergedTrigger[h] || []).filter(t => now - t < WINDOW);
    if (mergedTrigger[h].length === 0) delete mergedTrigger[h];
  }

  const newConfig = {
    ...curConfig,
    ...impConfig,
    keywords: mergedKw,
    whitelist: mergedWl,
    blockThreshold: impConfig.blockThreshold || curConfig.blockThreshold || 10,
    blockedCount: mergedBlocked.length
  };

  await chrome.storage.local.set({
    config: newConfig,
    blockedAccounts: mergedBlocked,
    records: mergedRecords,
    triggerLog: mergedTrigger
  });
  await sendToContent({ type: 'RELOAD_CONFIG' });

  // 刷新 UI
  allRecords = mergedRecords;
  renderKeywords(mergedKw);
  renderWhitelist(mergedWl);
  document.getElementById('keywordCount').textContent = mergedKw.length;
  document.getElementById('thresholdVal').textContent = newConfig.blockThreshold;
  currentThreshold = newConfig.blockThreshold;
  updateThresholdTip(newConfig.blockThreshold);
  updateStats();
  renderAllRecordLists();

  showToast(`✅ 已合并 +${newKw.length}词 +${newRecs.length}记录 +${newWl.length}白名单`, '#22c55e');
});

// Reset & Clear all
document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('确认重置所有统计数据？')) return;
  await sendToContent({ type: 'RESET_COUNT' });
  allRecords = [];
  updateStats();
  renderAllRecordLists();
});

// Live update
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'BLOCKED') {
    const res = await sendToContent({ type: 'GET_RECORDS' });
    if (res?.records) { allRecords = res.records; updateStats(); renderAllRecordLists(); }
  }
});

init();
