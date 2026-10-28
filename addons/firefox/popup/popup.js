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
const notifToggle      = document.getElementById('notifToggle');
const notifDesc        = document.getElementById('notifDesc');
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
      offlineQueueText.textContent = items.length === 1 ? t('queueSaved1') : t('queueSavedN', String(items.length));
      renderQueueItems(items, offlineQueueList, true);
      offlineQueueInfo.classList.remove('hidden');
    } else {
      offlineQueueInfo.classList.add('hidden');
    }
  } else {
    if (items.length > 0) {
      queueText.textContent = items.length === 1 ? t('queueWaiting1') : t('queueWaitingN', String(items.length));
      renderQueueItems(items, queueList, false);
      queueInfo.classList.remove('hidden');
    } else {
      queueInfo.classList.add('hidden');
    }
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

function showConnected(serverUrl) {
  loginView.classList.add('hidden');
  offlineView.classList.add('hidden');
  connectedView.classList.remove('hidden');
  statusText.textContent = t('statusConnected');
  statusDot.className = 'status-dot connected';
  connServerUrl.textContent = serverUrl.replace(/^https?:\/\//, '');
}

function showOffline(serverUrl) {
  loginView.classList.add('hidden');
  connectedView.classList.add('hidden');
  offlineView.classList.remove('hidden');
  statusText.textContent = t('statusOffline');
  statusDot.className = 'status-dot offline';
  offlineServer.textContent = serverUrl.replace(/^https?:\/\//, '');
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

async function checkSession(serverUrl) {
  try {
    const res = await fetch(serverUrl.replace(/\/$/, '') + '/api/auth/get-session', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      return (data && data.user) ? 'connected' : 'invalid';
    }
    return res.status === 401 ? 'invalid' : 'offline';
  } catch (_) {
    return 'offline';
  }
}

// ─── Toggles ──────────────────────────────────────────────────────────────────
// Each toggle mirrors a boolean in storage (default true); background.js
// picks changes up via storage.onChanged.

const TOGGLES = [
  { key: 'cnlActive',     input: cnlToggle,      desc: cnlDesc,      on: 'toggleCnlActive', off: 'toggleCnlStopped' },
  { key: 'autoSend',      input: autoSendToggle, desc: autoSendDesc, on: 'toggleCnlActive', off: 'toggleAutoSendManual' },
  { key: 'notifications', input: notifToggle,    desc: notifDesc,    on: 'toggleNotifOn',   off: 'toggleNotifOff' },
];

function renderToggle(toggle, active) {
  toggle.input.checked     = active;
  toggle.desc.textContent  = t(active ? toggle.on : toggle.off);
}

// Apply stored toggle states synchronously (call before making the view visible)
function applyToggleStates(data) {
  for (const toggle of TOGGLES) renderToggle(toggle, data[toggle.key] !== false);
}

for (const toggle of TOGGLES) {
  toggle.input.addEventListener('change', () => {
    const active = toggle.input.checked;
    renderToggle(toggle, active);
    browser.storage.local.set({ [toggle.key]: active });
  });
}

const STORED_KEYS = ['serverUrl', 'token', 'email', ...TOGGLES.map(tg => tg.key)];

// Shows the view matching the stored session. Returns the session state
// ('connected' | 'offline' | 'invalid' | 'none').
async function resolveSession() {
  const data = await browser.storage.local.get(STORED_KEYS);
  if (!data.token || !data.serverUrl) {
    showLogin();
    return 'none';
  }
  // Apply toggle states before the view becomes visible to avoid the flash
  applyToggleStates(data);
  const result = await checkSession(data.serverUrl);
  if (result === 'connected') {
    showConnected(data.serverUrl);
    await refreshQueueUI(false);
  } else if (result === 'offline') {
    showOffline(data.serverUrl);
    await refreshQueueUI(true);
  } else {
    await browser.storage.local.remove('token');
    showLogin();
  }
  return result;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const data = await browser.storage.local.get(['serverUrl', 'email']);
  if (data.serverUrl) serverUrlInput.value = data.serverUrl;
  if (data.email)     emailInput.value     = data.email;
  await resolveSession();
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
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ email, password }),
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
    applyToggleStates(await browser.storage.local.get(STORED_KEYS));
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
  if (await resolveSession() === 'connected') {
    browser.runtime.sendMessage({ type: 'flushQueue' }).catch(() => {});
  }
  retryBtn.disabled = false;
  retryBtn.textContent = t('btnRetry');
});

// ─── Logout ───────────────────────────────────────────────────────────────────

async function doLogout() {
  await browser.storage.local.remove('token');
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
