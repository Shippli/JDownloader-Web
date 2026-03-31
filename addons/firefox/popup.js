'use strict';

// ─── i18n ─────────────────────────────────────────────────────────────────────

function t(key, ...subs) {
  return browser.i18n.getMessage(key, subs) || key;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
}

applyI18n();

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const loginView        = document.getElementById('loginView');
const connectedView    = document.getElementById('connectedView');
const offlineView      = document.getElementById('offlineView');
const statusText       = document.getElementById('statusText');
const statusDot        = document.getElementById('statusDot');
const loginForm        = document.getElementById('loginForm');
const loginBtn         = document.getElementById('loginBtn');
const loginError       = document.getElementById('loginError');
const serverUrlInput   = document.getElementById('serverUrl');
const emailInput       = document.getElementById('email');
const passwordInput    = document.getElementById('password');
const connServerUrl    = document.getElementById('connServerUrl');
const openWebBtn       = document.getElementById('openWebBtn');
const logoutBtn        = document.getElementById('logoutBtn');
const cnlToggle        = document.getElementById('cnlToggle');
const cnlDesc          = document.getElementById('cnlDesc');
const retryBtn         = document.getElementById('retryBtn');
const offlineLogoutBtn = document.getElementById('offlineLogoutBtn');
const offlineServer    = document.getElementById('offlineServer');
const autoSendToggle   = document.getElementById('autoSendToggle');
const autoSendDesc     = document.getElementById('autoSendDesc');
// Queue elements
const queueInfo        = document.getElementById('queueInfo');
const queueText        = document.getElementById('queueText');
const queueList        = document.getElementById('queueList');
const flushQueueBtn    = document.getElementById('flushQueueBtn');
const clearQueueBtn    = document.getElementById('clearQueueBtn');
const offlineQueueInfo = document.getElementById('offlineQueueInfo');
const offlineQueueText = document.getElementById('offlineQueueText');
const offlineQueueList = document.getElementById('offlineQueueList');

// ─── Queue UI ─────────────────────────────────────────────────────────────────

function linkCount(links) {
  return (links || '').trim().split(/\r?\n/).filter(u => u.trim()).length;
}

function renderQueueItems(items, listEl, inOfflineView) {
  listEl.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'queue-item';

    const nameEl = document.createElement('span');
    nameEl.className = 'queue-item-name';
    nameEl.textContent = item.packageName || t('queueItemNoName');
    nameEl.title = item.packageName || '';

    const metaEl = document.createElement('span');
    metaEl.className = 'queue-item-meta';
    const n = linkCount(item.links);
    metaEl.textContent = n === 1 ? t('linkCount1') : t('linkCountN', String(n));

    const sendBtn = document.createElement('button');
    sendBtn.className = 'queue-item-send';
    sendBtn.title = t('queueItemSendTitle');
    sendBtn.textContent = '▶';
    sendBtn.addEventListener('click', async () => {
      sendBtn.disabled = true;
      await browser.runtime.sendMessage({ type: 'sendQueueItem', id: item.id }).catch(() => {});
      refreshQueueUI(inOfflineView);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'queue-item-del';
    delBtn.title = t('queueItemDeleteTitle');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', async () => {
      delBtn.disabled = true;
      await browser.runtime.sendMessage({ type: 'removeQueueItem', id: item.id }).catch(() => {});
      refreshQueueUI(inOfflineView);
    });

    li.appendChild(nameEl);
    li.appendChild(metaEl);
    li.appendChild(sendBtn);
    li.appendChild(delBtn);
    listEl.appendChild(li);
  }
}

async function refreshQueueUI(inOfflineView = false) {
  const items = await browser.runtime.sendMessage({ type: 'getQueue' }).catch(() => []);
  if (inOfflineView) {
    if (items.length > 0) {
      offlineQueueText.textContent = t('queueSaved', String(items.length));
      renderQueueItems(items, offlineQueueList, true);
      offlineQueueInfo.classList.remove('hidden');
    } else {
      offlineQueueInfo.classList.add('hidden');
    }
  } else {
    if (items.length > 0) {
      queueText.textContent = t('queueWaiting', String(items.length));
      renderQueueItems(items, queueList, false);
      queueInfo.classList.remove('hidden');
    } else {
      queueInfo.classList.add('hidden');
    }
  }
}

// Legacy helper used by showConnected / showOffline (called with just the count)
function updateQueueUI(queueSize, inOfflineView = false) {
  if (queueSize > 0) {
    refreshQueueUI(inOfflineView);
  } else {
    (inOfflineView ? offlineQueueInfo : queueInfo).classList.add('hidden');
  }
}

flushQueueBtn.addEventListener('click', async () => {
  flushQueueBtn.textContent = t('btnFlushQueueLoading');
  flushQueueBtn.disabled = true;
  await browser.runtime.sendMessage({ type: 'flushQueue' }).catch(() => {});
  await refreshQueueUI(false);
  flushQueueBtn.textContent = t('btnFlushQueue');
  flushQueueBtn.disabled = false;
});

clearQueueBtn.addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'clearQueue' }).catch(() => {});
  queueInfo.classList.add('hidden');
});

// ─── State helpers ────────────────────────────────────────────────────────────

function showConnected(serverUrl, queueSize = 0) {
  loginView.classList.add('hidden');
  offlineView.classList.add('hidden');
  connectedView.classList.remove('hidden');
  statusText.textContent = t('statusConnected');
  statusDot.className = 'status-dot connected';
  connServerUrl.textContent = serverUrl.replace(/^https?:\/\//, '');
  updateQueueUI(queueSize, false);
}

function showOffline(serverUrl, queueSize = 0) {
  loginView.classList.add('hidden');
  connectedView.classList.add('hidden');
  offlineView.classList.remove('hidden');
  statusText.textContent = t('statusOffline');
  statusDot.className = 'status-dot offline';
  offlineServer.textContent = serverUrl.replace(/^https?:\/\//, '');
  updateQueueUI(queueSize, true);
}

function showLogin() {
  connectedView.classList.add('hidden');
  offlineView.classList.add('hidden');
  loginView.classList.remove('hidden');
  statusText.textContent = t('statusDisconnected');
  statusDot.className = 'status-dot';
}

function showError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

function hideError() {
  loginError.classList.add('hidden');
}

function setLoading(loading) {
  loginBtn.disabled = loading;
  loginBtn.textContent = '';
  if (loading) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    loginBtn.appendChild(spinner);
  }
  loginBtn.appendChild(document.createTextNode(t(loading ? 'btnLoginLoading' : 'btnLogin')));
}

// ─── Session check ────────────────────────────────────────────────────────────

async function checkSession(serverUrl, token) {
  try {
    const res = await fetch(serverUrl.replace(/\/$/, '') + '/api/auth/get-session', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (res.ok) {
      const data = await res.json();
      return (data && data.user) ? 'connected' : 'invalid';
    }
    return res.status === 401 ? 'invalid' : 'offline';
  } catch (_) {
    return 'offline';
  }
}

// ─── Toggle state helpers ─────────────────────────────────────────────────────

// Apply both toggle states synchronously (call before making the view visible)
function applyToggleStates(cnlActive, autoSend) {
  cnlToggle.checked          = cnlActive;
  cnlDesc.textContent        = cnlActive ? t('toggleCnlActive') : t('toggleCnlStopped');
  autoSendToggle.checked     = autoSend;
  autoSendDesc.textContent   = autoSend  ? t('toggleCnlActive') : t('toggleAutoSendManual');
}

// ─── CNL toggle ───────────────────────────────────────────────────────────────

async function loadCnlState() {
  const data = await browser.storage.local.get('cnlActive');
  const active = data.cnlActive !== false;
  cnlToggle.checked = active;
  cnlDesc.textContent = active ? t('toggleCnlActive') : t('toggleCnlStopped');
}

cnlToggle.addEventListener('change', async () => {
  const active = cnlToggle.checked;
  cnlDesc.textContent = active ? t('toggleCnlActive') : t('toggleCnlStopped');
  await browser.storage.local.set({ cnlActive: active });
  browser.runtime.sendMessage({ type: 'setCnlActive', active }).catch(() => {});
});

// ─── Auto-Send toggle ─────────────────────────────────────────────────────────

async function loadAutoSendState() {
  const data = await browser.storage.local.get('autoSend');
  const active = data.autoSend !== false;
  autoSendToggle.checked = active;
  autoSendDesc.textContent = active ? t('toggleCnlActive') : t('toggleAutoSendManual');
}

autoSendToggle.addEventListener('change', async () => {
  const active = autoSendToggle.checked;
  autoSendDesc.textContent = active ? t('toggleCnlActive') : t('toggleAutoSendManual');
  await browser.storage.local.set({ autoSend: active });
  browser.runtime.sendMessage({ type: 'setAutoSend', active }).catch(() => {});
});

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const data = await browser.storage.local.get(['serverUrl', 'token', 'email', 'cnlActive', 'autoSend']);

  if (data.serverUrl) serverUrlInput.value = data.serverUrl;
  if (data.email)     emailInput.value     = data.email;

  if (data.token && data.serverUrl) {
    // Apply toggle states before the view becomes visible to avoid the flash
    applyToggleStates(data.cnlActive !== false, data.autoSend !== false);

    const result = await checkSession(data.serverUrl, data.token);

    if (result === 'connected') {
      showConnected(data.serverUrl);
      await refreshQueueUI(false);
      return;
    }

    if (result === 'offline') {
      showOffline(data.serverUrl);
      await refreshQueueUI(true);
      return;
    }

    // Token invalid → clear and show login
    await browser.storage.local.remove('token');
  }

  showLogin();
}

// ─── Login ────────────────────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const serverUrl = serverUrlInput.value.trim().replace(/\/$/, '');
  const email     = emailInput.value.trim();
  const password  = passwordInput.value;

  if (!serverUrl || !email || !password) {
    showError(t('errorFillFields'));
    return;
  }

  setLoading(true);

  try {
    const res = await fetch(serverUrl + '/api/auth/sign-in-ext', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showError(err.message || err.error || t('errorLoginFailed'));
      return;
    }

    const body  = await res.json();
    const token = body?.token;

    if (!token) {
      showError(t('errorNoToken'));
      return;
    }

    await browser.storage.local.set({ serverUrl, token, email });
    await loadCnlState();
    await loadAutoSendState();
    showConnected(serverUrl);
    // token change triggers flushQueue in background; wait briefly then refresh list
    setTimeout(() => refreshQueueUI(false), 500);

  } catch (err) {
    showError(t('errorConnection', err.message));
  } finally {
    setLoading(false);
  }
});

// ─── Retry (offline view) ─────────────────────────────────────────────────────

retryBtn.addEventListener('click', async () => {
  retryBtn.disabled = true;
  retryBtn.textContent = t('btnRetryLoading');

  const data = await browser.storage.local.get(['serverUrl', 'token', 'cnlActive', 'autoSend']);
  if (data.token && data.serverUrl) {
    applyToggleStates(data.cnlActive !== false, data.autoSend !== false);
    const result = await checkSession(data.serverUrl, data.token);

    if (result === 'connected') {
      showConnected(data.serverUrl);
      await refreshQueueUI(false);
      browser.runtime.sendMessage({ type: 'flushQueue' }).catch(() => {});
      return;
    }

    if (result === 'invalid') {
      await browser.storage.local.remove('token');
      showLogin();
      return;
    }
  }

  // Still offline
  retryBtn.disabled = false;
  retryBtn.textContent = t('btnRetry');
});

// ─── Logout ───────────────────────────────────────────────────────────────────

async function doLogout() {
  await browser.storage.local.remove('token');
  await browser.runtime.sendMessage({ type: 'logout' }).catch(() => {});
  passwordInput.value = '';
  showLogin();
}

logoutBtn.addEventListener('click', doLogout);
offlineLogoutBtn.addEventListener('click', doLogout);

// ─── Open Web UI ──────────────────────────────────────────────────────────────

openWebBtn.addEventListener('click', async () => {
  const data = await browser.storage.local.get('serverUrl');
  if (data.serverUrl) browser.tabs.create({ url: data.serverUrl });
});

// ─── Start ────────────────────────────────────────────────────────────────────

init();
