'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────

const config = {
  serverUrl: '',
  token: null,
  cnlActive: true,
  autoSend: true,   // when false, all packages are queued for manual dispatch
  notifications: true,   // when false, no desktop notifications are shown
};

const normalizeUrl = url => (url || '').replace(/\/$/, '');

browser.storage.local.get(['serverUrl', 'token', 'cnlActive', 'autoSend', 'notifications']).then((data) => {
  config.serverUrl     = normalizeUrl(data.serverUrl);
  config.token         = data.token     || null;
  config.cnlActive     = data.cnlActive !== false;
  config.autoSend      = data.autoSend  !== false;
  config.notifications = data.notifications !== false;
  updateBadge();
  // Try to flush any items queued while the background was unloaded
  if (config.token && config.autoSend) flushQueue();
});

browser.storage.onChanged.addListener((changes) => {
  if (changes.serverUrl) config.serverUrl = normalizeUrl(changes.serverUrl.newValue);
  if (changes.cnlActive) {
    config.cnlActive = changes.cnlActive.newValue !== false;
    updateBadge();
  }
  if (changes.autoSend)  config.autoSend  = changes.autoSend.newValue  !== false;
  if (changes.notifications) config.notifications = changes.notifications.newValue !== false;
  if (changes.token) {
    const hadToken = !!config.token;
    config.token = changes.token.newValue || null;
    updateBadge();
    // New login → immediately try to flush queued items (only if autoSend is on)
    if (!hadToken && config.token && config.autoSend) flushQueue();
  }
});

// ─── Badge ────────────────────────────────────────────────────────────────────

async function updateBadge() {
  if (!config.token) {
    browser.browserAction.setBadgeText({ text: '!' });
    browser.browserAction.setBadgeBackgroundColor({ color: '#e74c3c' });
    return;
  }
  if (!config.cnlActive) {
    browser.browserAction.setBadgeText({ text: '—' });
    browser.browserAction.setBadgeBackgroundColor({ color: '#64748b' });
    return;
  }
  const queue = await loadQueue();
  if (queue.length > 0) {
    browser.browserAction.setBadgeText({ text: String(queue.length) });
    browser.browserAction.setBadgeBackgroundColor({ color: '#f59e0b' });
  } else {
    browser.browserAction.setBadgeText({ text: '' });
  }
}

// ─── Form Data Parser ─────────────────────────────────────────────────────────

function readFormData(requestBody) {
  const result = {};

  if (requestBody.formData) {
    for (const [key, val] of Object.entries(requestBody.formData)) {
      result[key] = Array.isArray(val) ? val[0] : val;
    }
    return result;
  }

  if (requestBody.raw && requestBody.raw.length > 0) {
    const decoder = new TextDecoder();
    let body = '';
    for (const buf of requestBody.raw) {
      if (buf.bytes) body += decoder.decode(buf.bytes, { stream: true });
    }
    body += decoder.decode();
    for (const [key, val] of new URLSearchParams(body)) {
      if (!(key in result)) result[key] = val;
    }
  }

  return result;
}

// ─── AES-CBC Decryption ───────────────────────────────────────────────────────

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

async function decryptCnl(crypted, jkScript) {
  let keyHex;

  // 1. Plain hex key with no wrapper
  if (/^[0-9a-fA-F]{32,64}$/.test(jkScript.trim())) {
    keyHex = jkScript.trim();
  } else {
    // 2. Standard CNL2 jk function: function f(){ return 'HEXKEY'; }
    //    Extract the hex value via regex — avoids new Function() which is blocked by
    //    the extension's CSP (script-src 'self' 'wasm-unsafe-eval', no 'unsafe-eval').
    const m = jkScript.match(/return\s*['"]([0-9a-fA-F]+)['"]/);
    if (m) {
      keyHex = m[1];
    } else {
      throw new Error(browser.i18n.getMessage('errorUnknownJkFormat', jkScript.slice(0, 80)));
    }
  }

  if (!keyHex || typeof keyHex !== 'string') throw new Error('jk did not return a valid hex key');

  const keyBytes = hexToBytes(keyHex.trim());
  const iv       = keyBytes.slice(0, 16);

  const ciphertextStr   = atob(crypted);
  const ciphertextBytes = new Uint8Array(ciphertextStr.length);
  for (let i = 0; i < ciphertextStr.length; i++) ciphertextBytes[i] = ciphertextStr.charCodeAt(i);

  const decKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['decrypt']);

  // WebCrypto AES-CBC enforces PKCS#7; CNL2 uses zero padding. Try PKCS#7 first,
  // fall back to no-padding decrypt on the resulting OperationError.
  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, decKey, ciphertextBytes);
    return new TextDecoder('utf-8').decode(decrypted).replace(/\0+$/, '');
  } catch (e) {
    if (e.name !== 'OperationError') throw e;
    return decryptCbcNoPadding(keyBytes, iv, ciphertextBytes);
  }
}

// AES-CBC decrypt without PKCS#7 check: append a block that decrypts to a valid
// 0x10×16 pad (= AES_enc(0x10^16 XOR C_last)), let WebCrypto strip it, trim NULs.
async function decryptCbcNoPadding(keyBytes, iv, ciphertextBytes) {
  const cLast = ciphertextBytes.slice(ciphertextBytes.length - 16);
  const x = new Uint8Array(16);
  for (let i = 0; i < 16; i++) x[i] = 0x10 ^ cLast[i];

  const encKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['encrypt']);
  const encOut = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, encKey, x));
  const cExtra = encOut.slice(0, 16); // = AES_enc(x)

  const extended = new Uint8Array(ciphertextBytes.length + 16);
  extended.set(ciphertextBytes);
  extended.set(cExtra, ciphertextBytes.length);

  const decKey    = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['decrypt']);
  const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, decKey, extended));
  let end = decrypted.length;
  while (end > 0 && decrypted[end - 1] === 0) end--;
  return new TextDecoder('utf-8').decode(decrypted.slice(0, end));
}

// ─── Offline Queue ────────────────────────────────────────────────────────────

const QUEUE_KEY = 'cnlQueue';
const pendingOfflineNotifIds = [];

async function loadQueue() {
  const data = await browser.storage.local.get(QUEUE_KEY);
  return data[QUEUE_KEY] || [];
}

async function saveQueue(queue) {
  await browser.storage.local.set({ [QUEUE_KEY]: queue });
}

async function addToQueue(links, packageName, extractPassword) {
  const queue = await loadQueue();
  queue.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2),
    links,
    packageName:      packageName      || '',
    extractPassword:  extractPassword  || '',
    timestamp:        Date.now(),
  });
  await saveQueue(queue);
  await updateBadge();
  if (config.autoSend) {
    const id = await showNotification(
      browser.i18n.getMessage('notifOfflineTitle'),
      queue.length === 1 ? browser.i18n.getMessage('notifOfflineAutoSend1') : browser.i18n.getMessage('notifOfflineAutoSendN', String(queue.length))
    );
    if (id) pendingOfflineNotifIds.push(id);
  } else {
    showNotification('JDownloader', browser.i18n.getMessage('notifOfflineManual'));
  }
}

// Sends one item directly (throws on network error / auth error)
async function sendItem(item) {
  const body = { links: item.links.trim(), packageName: item.packageName, autostart: false };
  if (item.extractPassword) body.extractPassword = item.extractPassword;

  const response = await fetch(config.serverUrl + '/api/jd/grabber/add', {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(body),
  });

  if (response.status === 401) {
    const err  = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  if (!response.ok) {
    throw new Error('Backend returned ' + response.status);
  }
}

// Session expired – drop the token (badge updates via storage.onChanged) and ask for re-login.
async function handleUnauthorized() {
  config.token = null;
  await browser.storage.local.remove('token');
  showNotification('JDownloader', browser.i18n.getMessage('notifSessionExpired'));
}

function linkCount(links) {
  return links.trim().split(/\r?\n/).filter(u => u.trim()).length;
}

function notifyLinksAdded(links) {
  const n = linkCount(links);
  showNotification('JDownloader', n === 1 ? browser.i18n.getMessage('notifLinksAdded1') : browser.i18n.getMessage('notifLinksAddedN', String(n)));
}

// Processes the full queue. Stops on first network error (server still down).
// Clears token on 401 (session expired).
let flushRunning = false;
async function flushQueue() {
  if (flushRunning || !config.serverUrl || !config.token) return;
  flushRunning = true;

  try {
    let queue = await loadQueue();
    if (queue.length === 0) return;
    if (!await isCompanionReady()) return;

    const sent = [];
    for (const item of queue) {
      try {
        await sendItem(item);
        sent.push(item.id);
      } catch (err) {
        if (err.status === 401) {
          await handleUnauthorized();
          return;
        }
        // Network / server error – stop and try again later
        console.warn('[JD-CNL] Queue flush stopped (server unreachable):', err.message);
        break;
      }
    }

    if (sent.length > 0) {
      queue = queue.filter(i => !sent.includes(i.id));
      await saveQueue(queue);
      await updateBadge();
      for (const id of pendingOfflineNotifIds.splice(0)) {
        browser.notifications.clear(id).catch(() => {});
      }
      showNotification(
        'JDownloader',
        sent.length === 1 ? browser.i18n.getMessage('notifQueueFlushed1') : browser.i18n.getMessage('notifQueueFlushedN', String(sent.length))
      );
    }
  } finally {
    flushRunning = false;
  }
}

// Periodic retry every 30 seconds (only when autoSend is on)
browser.alarms.create('flushQueue', { periodInMinutes: 0.5 });
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'flushQueue' && config.token && config.autoSend) flushQueue();
});

// ─── Backend Communication ────────────────────────────────────────────────────

async function isCompanionReady() {
  if (!config.serverUrl || !config.token) return false;
  try {
    const res = await fetch(config.serverUrl + '/api/jd/status', { credentials: 'include' });
    if (!res.ok) return false;
    const data = await res.json();
    return data.configured === true && data.connected === true;
  } catch {
    return false;
  }
}

async function sendToBackend(links, packageName, extractPassword) {
  if (!config.serverUrl || !config.token || !config.autoSend) {
    await addToQueue(links, packageName, extractPassword);
    return;
  }

  if (!await isCompanionReady()) {
    console.info('[JD-CNL] App not ready, queueing links');
    await addToQueue(links, packageName, extractPassword);
    return;
  }

  try {
    await sendItem({ links, packageName, extractPassword });
  } catch (err) {
    if (err.status === 401) {
      await handleUnauthorized();
      return;
    }
    // Network error → queue for later
    console.warn('[JD-CNL] Server unreachable, queueing:', err.message);
    await addToQueue(links, packageName, extractPassword);
    return;
  }

  notifyLinksAdded(links);
}

// ─── Notifications ────────────────────────────────────────────────────────────

function showNotification(title, message) {
  if (!config.notifications) return Promise.resolve(null);
  return browser.notifications.create({
    type:    'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
  }).catch(() => {});
}

// Focus an open web UI tab, or open one.
async function openWebUi() {
  if (!config.serverUrl) return;
  // query throws if serverUrl isn't a valid match pattern → just open a new tab
  const [tab] = await browser.tabs.query({ url: config.serverUrl + '/*' }).catch(() => []);
  if (tab) {
    await browser.tabs.update(tab.id, { active: true });
    await browser.windows.update(tab.windowId, { focused: true });
  } else {
    await browser.tabs.create({ url: config.serverUrl });
  }
}

browser.notifications.onClicked.addListener((id) => {
  browser.notifications.clear(id).catch(() => {});
  openWebUi().catch(console.error);
});

// ─── CNL Handling ─────────────────────────────────────────────────────────────

function notifyCnlError(message) {
  showNotification(browser.i18n.getMessage('notifCnlError'), message);
}

// kind: 'add' (plain links) or 'addcrypted2' (encrypted). packageOverride is the
// name captured on the page, if any.
function processCnl(kind, fd, packageOverride) {
  if (kind === 'addcrypted2') {
    const crypted = fd.crypted || '';
    const jk      = fd.jk      || '';
    // Package name comes from the `package` field, never `source` (the referer URL).
    const packageName = packageOverride || fd.package || '';
    if (!crypted || !jk) {
      notifyCnlError(browser.i18n.getMessage('errorCnlMissingData', [String(!!crypted), String(!!jk)]));
      return;
    }
    decryptCnl(crypted, jk)
      .then(urls => sendToBackend(urls, packageName, fd.passwords || ''))
      .catch(err => notifyCnlError(err.message));
    return;
  }
  const links       = fd.urls || '';
  const packageName = packageOverride || fd.package || '';
  if (links) sendToBackend(links, packageName).catch(err => notifyCnlError(err.message));
}

// ─── WebRequest Interceptor ───────────────────────────────────────────────────

function handleRequest(details) {
  // Not ready (no token or CNL disabled) → don't intercept; site gets natural connection error
  if (!config.cnlActive || !config.token) return {};

  const { pathname, search } = new URL(details.url);

  if (pathname === '/jdcheck.js') {
    // Activate content/cnl.js in the probing frame (submit hook); the redirect answers the probe.
    if (details.tabId >= 0) {
      browser.tabs.sendMessage(details.tabId, { type: 'cnlActivate' }, { frameId: details.frameId }).catch(() => {});
    }
    return { redirectUrl: browser.runtime.getURL('content/jdcheck.js') };
  }
  if (pathname === '/crossdomain.xml')  return { cancel: true };
  if (search.includes('fromExtension')) return {};

  if (pathname === '/flash/addcrypted2') {
    processCnl('addcrypted2', readFormData(details.requestBody || {}));
    return { cancel: true };
  }
  if (pathname === '/flash/add') {
    processCnl('add', readFormData(details.requestBody || {}));
    return { cancel: true };
  }

  return {};
}

browser.webRequest.onBeforeRequest.addListener(
  handleRequest,
  { urls: ['http://127.0.0.1:9666/*', 'http://localhost:9666/*'] },
  ['blocking', 'requestBody']
);

// ─── Message Handler (from popup) ────────────────────────────────────────────

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'flushQueue') {
    flushQueue().then(() => loadQueue()).then(queue => {
      sendResponse({ queueSize: queue.length });
    });
    return true;
  }

  // CNL form data captured by the injected page-context script (bypasses mixed-content blocking)
  if (message.type === 'cnlFormIntercept') {
    if (!config.cnlActive) { sendResponse({ ok: false }); return true; }
    const action = message.action || '';
    const kind   = action.includes('/flash/addcrypted2') ? 'addcrypted2' : action.includes('/flash/add') ? 'add' : null;
    if (kind) processCnl(kind, message.formData || {}, message.packageName);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'getQueue') {
    loadQueue().then(queue => sendResponse(queue));
    return true;
  }

  if (message.type === 'removeQueueItem') {
    loadQueue().then(async queue => {
      const updated = queue.filter(i => i.id !== message.id);
      await saveQueue(updated);
      await updateBadge();
      sendResponse({ ok: true, queueSize: updated.length });
    });
    return true;
  }

  if (message.type === 'sendQueueItem') {
    loadQueue().then(async queue => {
      const item = queue.find(i => i.id === message.id);
      if (!item) { sendResponse({ ok: false, error: 'not found' }); return; }
      try {
        await sendItem(item);
        const updated = queue.filter(i => i.id !== message.id);
        await saveQueue(updated);
        await updateBadge();
        notifyLinksAdded(item.links);
        sendResponse({ ok: true, queueSize: updated.length });
      } catch (err) {
        if (err.status === 401) {
          await handleUnauthorized();
        }
        sendResponse({ ok: false, error: err.message });
      }
    });
    return true;
  }

  if (message.type === 'clearQueue') {
    saveQueue([]).then(() => {
      updateBadge();
      sendResponse({ ok: true });
    });
    return true;
  }
});

console.log('[JD-CNL] Background script loaded');
