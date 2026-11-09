'use strict';

// Runs at document_start in every frame. Passive until the page shows CNL intent:
//   - a form posting to /flash/add or /flash/addcrypted2 (on DOMContentLoaded)
//   - a failed jdcheck.js probe (blocked before background.js can redirect it)
//   - a CSP violation on the CNL port
//   - a `cnlActivate` message from background.js (jdcheck.js probe seen)
// Activation exposes `jdownloader` and hooks form.submit() via Xray wrappers.
// The capture-phase `submit` listener is invisible to the page and always on.

const CONFIG_KEYS = ['cnlActive', 'token'];
let cnlEnabled = false;
let activated = false;

function readConfig(data) {
  cnlEnabled = data.cnlActive !== false && !!data.token;
}

const configReady = browser.storage.local.get(CONFIG_KEYS).then(readConfig);
browser.storage.onChanged.addListener((changes) => {
  if (CONFIG_KEYS.some(k => k in changes)) browser.storage.local.get(CONFIG_KEYS).then(readConfig);
});

// ─── CNL URLs ─────────────────────────────────────────────────────────────────

function parseUrl(url, base) {
  try {
    return new URL(url, base);
  } catch {
    return null;
  }
}

function isCnlUrl(url) {
  return !!url && url.port === '9666' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
}

// Read from the attribute; `form.action` is shadowed by an input named "action".
function formAction(form) {
  return parseUrl(form.getAttribute('action') || '', document.baseURI);
}

const CNL_PATHS = ['/flash/add', '/flash/addcrypted2'];

function isCnlForm(form) {
  const action = formAction(form);
  return isCnlUrl(action) && CNL_PATHS.includes(action.pathname);
}

function isJdCheck(script) {
  const src = parseUrl(script.src);
  return isCnlUrl(src) && src.pathname === '/jdcheck.js';
}

// ─── Form forwarding ──────────────────────────────────────────────────────────

// Sends the form fields to background.js instead of posting to the CNL port.
function forwardForm(form, submitter) {
  const formData = {};
  for (const [key, value] of new FormData(form, submitter || undefined)) {
    if (typeof value === 'string' && !(key in formData)) formData[key] = value;
  }
  // filecrypt keeps the package name in JDData[3]; used when the form has no `package`.
  const jdData = window.wrappedJSObject.JDData;
  browser.runtime.sendMessage({
    type: 'cnlFormIntercept',
    action: formAction(form).href,
    formData,
    packageName: (jdData && jdData[3]) || '',
  });
}

// ─── Activation ───────────────────────────────────────────────────────────────

function installHooks() {
  const page = window.wrappedJSObject;

  // `jdownloader` reads true while CNL is enabled; page writes are kept for when it is not.
  let pageValue = page.jdownloader;
  try {
    Object.defineProperty(page, 'jdownloader', {
      configurable: true,
      get: exportFunction(() => cnlEnabled || pageValue, window),
      set: exportFunction((v) => { pageValue = v; }, window),
    });
  } catch {
    // Non-configurable `var` from the redirected jdcheck.js — already true.
  }

  const nativeSubmit = HTMLFormElement.prototype.submit;
  exportFunction(function () {
    if (cnlEnabled && isCnlForm(this)) forwardForm(this);
    else nativeSubmit.call(this);
  }, page.HTMLFormElement.prototype, { defineAs: 'submit' });
}

function activate() {
  if (activated || !cnlEnabled) return;
  activated = true;
  installHooks();
}

const activateWhenReady = () => configReady.then(activate);

// ─── Listeners ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (Array.from(document.forms).some(isCnlForm)) activateWhenReady();
});

// Button clicks and requestSubmit() fire `submit`; form.submit() does not.
document.addEventListener('submit', (e) => {
  if (!cnlEnabled || !(e.target instanceof HTMLFormElement) || !isCnlForm(e.target)) return;
  e.preventDefault();
  forwardForm(e.target, e.submitter);
}, true);

// A failed jdcheck.js probe is reported to the page as a successful load.
document.addEventListener('error', (e) => {
  if (!cnlEnabled || !(e.target instanceof HTMLScriptElement) || !isJdCheck(e.target)) return;
  activate();
  e.stopImmediatePropagation();
  e.target.dispatchEvent(new Event('load'));
}, true);

document.addEventListener('securitypolicyviolation', (e) => {
  if (isCnlUrl(parseUrl(e.blockedURI))) activateWhenReady();
});

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'cnlActivate') activateWhenReady();
});
