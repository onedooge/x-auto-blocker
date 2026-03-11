// X Auto Blocker - Popup Script

let allRecords = [];

async function sendToContent(msg) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) { return null; }
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

  if (kwRes?.keywords) {
    renderKeywords(kwRes.keywords);
    document.getElementById('keywordCount').textContent = kwRes.keywords.length;
  }

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
      const res = await sendToContent({ type: 'REMOVE_KEYWORD', keyword: btn.getAttribute('data-kw') });
      if (res?.keywords) {
        renderKeywords(res.keywords);
        document.getElementById('keywordCount').textContent = res.keywords.length;
      }
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
  const res = await sendToContent({ type: 'ADD_KEYWORD', keyword: kw });
  if (res?.keywords) {
    renderKeywords(res.keywords);
    document.getElementById('keywordCount').textContent = res.keywords.length;
    input.value = '';
  }
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
  const res = await sendToContent({ type: 'GET_KEYWORDS' });
  if (!res?.keywords) { showToast('请先打开 X.com', '#e0415a'); return; }

  const data = {
    version: '1.0',
    exportTime: new Date().toISOString(),
    keywords: res.keywords
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `x-blocker-keywords-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✅ 已导出 ${res.keywords.length} 个关键词`, '#22c55e');
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

  // 获取现有关键词，合并去重
  const existing = await sendToContent({ type: 'GET_KEYWORDS' });
  const existingSet = new Set(existing?.keywords || []);
  const newOnes = keywords.filter(k => !existingSet.has(k));

  if (newOnes.length === 0) { showToast('全部关键词已存在，无需导入', '#f59e0b'); return; }

  // 逐个添加
  let lastRes = null;
  for (const kw of newOnes) {
    lastRes = await sendToContent({ type: 'ADD_KEYWORD', keyword: kw });
  }

  if (lastRes?.keywords) {
    renderKeywords(lastRes.keywords);
    document.getElementById('keywordCount').textContent = lastRes.keywords.length;
  }
  showToast(`✅ 导入 ${newOnes.length} 个新关键词`, '#22c55e');
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
