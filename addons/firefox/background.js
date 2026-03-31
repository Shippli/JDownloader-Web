'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────

const config = {
  serverUrl: '',
  token: null,
  cnlActive: true,
  autoSend: true,   // when false, all packages are queued for manual dispatch
};

browser.storage.local.get(['serverUrl', 'token', 'cnlActive', 'autoSend']).then((data) => {
  config.serverUrl = data.serverUrl || '';
  config.token     = data.token     || null;
  config.cnlActive = data.cnlActive !== false;
  config.autoSend  = data.autoSend  !== false;
  updateBadge();
  // Try to flush any items queued while the background was unloaded
  if (config.token && config.autoSend) flushQueue();
});

browser.storage.onChanged.addListener((changes) => {
  if (changes.serverUrl) config.serverUrl = changes.serverUrl.newValue || '';
  if (changes.cnlActive) config.cnlActive = changes.cnlActive.newValue !== false;
  if (changes.autoSend)  config.autoSend  = changes.autoSend.newValue  !== false;
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

// crossdomain.xml base64 encoded
const CROSSDOMAIN_RESPONSE = 'data:text/xml;charset=utf-8;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/Pg0KPGNyb3NzLWRvbWFpbi1wb2xpY3k+DQogIDxzaXRlLWNvbnRyb2wgcGVybWl0dGVkLWNyb3NzLWRvbWFpbi1wb2xpY2llcz0ibWFzdGVyLW9ubHkiLz4NCiAgPGFsbG93LWFjY2Vzcy1mcm9tIGRvbWFpbj0iKiIvPg0KICA8YWxsb3ctaHR0cC1yZXF1ZXN0LWhlYWRlcnMtZnJvbSBkb21haW49IioiIGhlYWRlcnM9IioiLz4NCjwvY3Jvc3MtZG9tYWluLXBvbGljeT4=';

// ─── URL Helpers ──────────────────────────────────────────────────────────────

function matchesCnlHost(url, path) {
  return url.includes('localhost:9666' + path) || url.includes('127.0.0.1:9666' + path);
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
    let binary = '';
    for (const buf of requestBody.raw) {
      const bytes = new Uint8Array(buf.bytes);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    }
    for (const pair of binary.split('&')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const key = decodeURIComponent(pair.slice(0, eqIdx).replace(/\+/g, ' '));
      const val = decodeURIComponent(pair.slice(eqIdx + 1).replace(/\+/g, ' '));
      result[key] = val;
    }
  }

  return result;
}

// ─── AES-CBC Decryption ───────────────────────────────────────────────────────

async function hexToBytes(hex) {
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

  const keyBytes  = await hexToBytes(keyHex.trim());
  const iv        = keyBytes.slice(0, 16);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['decrypt']);

  const ciphertextStr   = atob(crypted);
  const ciphertextBytes = new Uint8Array(ciphertextStr.length);
  for (let i = 0; i < ciphertextStr.length; i++) ciphertextBytes[i] = ciphertextStr.charCodeAt(i);

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, ciphertextBytes);
  return new TextDecoder('utf-8').decode(decrypted);
}

// ─── Offline Queue ────────────────────────────────────────────────────────────

const QUEUE_KEY = 'cnlQueue';

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
  showNotification(
    config.autoSend ? browser.i18n.getMessage('notifOfflineTitle') : 'JDownloader',
    config.autoSend
      ? browser.i18n.getMessage('notifOfflineAutoSend', String(queue.length))
      : browser.i18n.getMessage('notifOfflineManual')
  );
}

// Sends one item directly (throws on network error / auth error)
async function sendItem(item) {
  const body = { links: item.links.trim(), packageName: item.packageName, autostart: false };
  if (item.extractPassword) body.extractPassword = item.extractPassword;

  const response = await fetch(config.serverUrl.replace(/\/$/, '') + '/api/jd/grabber/add', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + config.token,
    },
    body: JSON.stringify(body),
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

// Processes the full queue. Stops on first network error (server still down).
// Clears token on 401 (session expired).
let flushRunning = false;
async function flushQueue() {
  if (flushRunning || !config.serverUrl || !config.token) return;
  flushRunning = true;

  try {
    let queue = await loadQueue();
    if (queue.length === 0) return;

    const sent = [];
    for (const item of queue) {
      try {
        await sendItem(item);
        sent.push(item.id);
      } catch (err) {
        if (err.status === 401) {
          // Session expired – stop, require re-login
          config.token = null;
          await browser.storage.local.remove('token');
          await updateBadge();
          showNotification('JDownloader', browser.i18n.getMessage('notifSessionExpired'));
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
      showNotification(
        'JDownloader',
        browser.i18n.getMessage('notifQueueFlushed', String(sent.length))
      );
    }
  } finally {
    flushRunning = false;
  }
}

// Periodic retry every 30 seconds (only when autoSend is on)
setInterval(() => {
  if (config.token && config.autoSend) flushQueue();
}, 30_000);

// ─── Backend Communication ────────────────────────────────────────────────────

async function sendToBackend(links, packageName, extractPassword) {
  if (!config.serverUrl || !config.token || !config.autoSend) {
    await addToQueue(links, packageName, extractPassword);
    return;
  }

  try {
    await sendItem({ links, packageName, extractPassword });
  } catch (err) {
    if (err.status === 401) {
      config.token = null;
      await browser.storage.local.remove('token');
      await updateBadge();
      showNotification('JDownloader', browser.i18n.getMessage('notifSessionExpired'));
      return;
    }
    // Network error → queue for later
    console.warn('[JD-CNL] Server unreachable, queueing:', err.message);
    await addToQueue(links, packageName, extractPassword);
    return;
  }

  const urlCount = links.trim().split(/\r?\n/).filter(u => u.trim()).length;
  showNotification('JDownloader', browser.i18n.getMessage('notifLinksAdded', String(urlCount)));
}

// ─── Notifications ────────────────────────────────────────────────────────────

function showNotification(title, message) {
  browser.notifications.create({
    type:     'basic',
    iconUrl:  'icons/icon48.png',
    title,
    message,
  }).catch(() => {});
}

// ─── CNL Inject Code Builder ─────────────────────────────────────────────────
//
// Builds the content-script code injected into a CNL helper page when jdcheck.js
// is intercepted. It does two things:
//   1. Injects a <script> tag into the page context that sets window.jdownloader=true
//      AND overrides HTMLFormElement.prototype.submit to capture CNL form data before
//      the browser can block the HTTP-to-localhost POST as mixed content.
//   2. Adds a content-script event listener that relays the captured data to the
//      background via browser.runtime.sendMessage.

function buildCnlInjectCode() {
  // This script runs in the PAGE context (not the content-script sandbox) so it can
  // override HTMLFormElement.prototype.submit. It dispatches a custom event with the
  // form data so the content-script layer can pick it up.
  const pageScript = (
    'window.jdownloader=true;' +
    'if(!window.__jdFormIntercepted){' +
      'window.__jdFormIntercepted=true;' +
      'var _o=HTMLFormElement.prototype.submit;' +
      'HTMLFormElement.prototype.submit=function(){' +
        'var a=this.action||"";' +
        'if(a.indexOf("9666")!==-1||a.indexOf("/flash/add")!==-1){' +
          'var d={};var els=this.querySelectorAll("[name]");' +
          'for(var i=0;i<els.length;i++){d[els[i].name]=els[i].value;}' +
          'var pn=(window.JDData&&window.JDData[3])||d.source||"";' +
          'document.dispatchEvent(new CustomEvent("__jd_cnl_submit",{detail:{action:a,data:d,packageName:pn}}));' +
          'return;' +
        '}' +
        '_o.call(this);' +
      '};' +
    '}'
  );

  // Content-script wrapper: inject the page script once per tab, then listen for its event.
  return (
    '(function(){' +
      'if(window.__jdCnlInjected)return;window.__jdCnlInjected=true;' +
      'var s=document.createElement("script");' +
      's.text=' + JSON.stringify(pageScript) + ';' +
      '(document.body||document.head||document.documentElement).appendChild(s);' +
      'document.addEventListener("__jd_cnl_submit",function(e){' +
        'browser.runtime.sendMessage({type:"cnlFormIntercept",action:e.detail.action,formData:e.detail.data,packageName:e.detail.packageName});' +
      '});' +
    '})();'
  );
}

// ─── WebRequest Interceptor ───────────────────────────────────────────────────

function handleRequest(details) {
  const url = details.url;

  if (matchesCnlHost(url, '/jdcheck.js')) {
    // Inject window.jdownloader=true AND a form.submit() interceptor into the page context.
    // The interceptor captures CNL form data before the browser can block the HTTP→localhost
    // submission as mixed content (which happens before webRequest fires).
    if (details.tabId > 0) {
      browser.tabs.executeScript(details.tabId, { code: buildCnlInjectCode() }).catch(() => {});
    }
    // Redirect to the extension's own jdcheck.js — proper JS MIME type, no CSP issues.
    return { redirectUrl: browser.runtime.getURL('jdcheck.js') };
  }
  if (matchesCnlHost(url, '/crossdomain.xml')) return { cancel: true };
  if (url.includes('?fromExtension'))          return {};

  // CNL stopped → let requests fail naturally (nothing listens on 9666)
  if (!config.cnlActive) return { cancel: true };

  // Plain links
  if (matchesCnlHost(url, '/flash/add')) {
    const fd          = readFormData(details.requestBody || {});
    const links       = fd.urls || fd.source || '';
    const packageName = fd.package || fd.refer || '';
    if (links) sendToBackend(links, packageName).catch(console.error);
    return { cancel: true };
  }

  // Encrypted links
  if (matchesCnlHost(url, '/flash/addcrypted2')) {
    const fd        = readFormData(details.requestBody || {});
    const crypted   = fd.crypted   || '';
    const jk        = fd.jk        || '';
    const source    = fd.source    || '';
    const passwords = fd.passwords || '';
    if (crypted && jk) {
      decryptCnl(crypted, jk)
        .then(urls => sendToBackend(urls, source, passwords))
        .catch(err => showNotification(browser.i18n.getMessage('notifCnlError'), err.message));
    } else {
      showNotification(browser.i18n.getMessage('notifCnlError'), `addcrypted2 empfangen, aber Daten fehlen (crypted=${!!crypted}, jk=${!!jk})`);
    }
    return { cancel: true };
  }

  return {};
}

browser.webRequest.onBeforeRequest.addListener(
  handleRequest,
  { urls: ['<all_urls>'] },
  ['blocking', 'requestBody']
);

// ─── Message Handler (from popup) ────────────────────────────────────────────

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'getStatus') {
    loadQueue().then(queue => {
      sendResponse({ serverUrl: config.serverUrl, loggedIn: !!config.token, queueSize: queue.length, autoSend: config.autoSend });
    });
    return true;
  }

  if (message.type === 'logout') {
    config.token = null;
    browser.storage.local.remove('token').then(() => {
      updateBadge();
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'setCnlActive') {
    config.cnlActive = message.active;
    updateBadge();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'flushQueue') {
    flushQueue().then(() => loadQueue()).then(queue => {
      sendResponse({ queueSize: queue.length });
    });
    return true;
  }

  // CNL form data captured by the injected page-context script (bypasses mixed-content blocking)
  if (message.type === 'cnlFormIntercept') {
    if (!config.cnlActive) { sendResponse({ ok: false }); return true; }
    const fd     = message.formData || {};
    const action = message.action   || '';
    if (action.includes('/flash/addcrypted2')) {
      const crypted     = fd.crypted   || '';
      const jk          = fd.jk        || '';
      const packageName = message.packageName || fd.source || '';
      const passwords   = fd.passwords || '';
      if (crypted && jk) {
        decryptCnl(crypted, jk)
          .then(urls => sendToBackend(urls, packageName, passwords))
          .catch(err => showNotification(browser.i18n.getMessage('notifCnlError'), err.message));
      }
    } else if (action.includes('/flash/add')) {
      const links       = fd.urls || fd.source || '';
      const packageName = message.packageName || fd.package || fd.refer || '';
      if (links) sendToBackend(links, packageName).catch(err => showNotification(browser.i18n.getMessage('notifCnlError'), err.message));
    }
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

  if (message.type === 'setAutoSend') {
    config.autoSend = message.active;
    sendResponse({ ok: true });
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
        const n = item.links.trim().split(/\r?\n/).filter(u => u.trim()).length;
        showNotification('JDownloader', browser.i18n.getMessage('notifLinksAdded', String(n)));
        sendResponse({ ok: true, queueSize: updated.length });
      } catch (err) {
        if (err.status === 401) {
          config.token = null;
          await browser.storage.local.remove('token');
          await updateBadge();
          showNotification('JDownloader', browser.i18n.getMessage('notifSessionExpired'));
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
