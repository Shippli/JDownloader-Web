'use strict';

// Runs at document_start in every frame. Passive until the page contacts the
// CNL port: a CSP violation on 127.0.0.1/localhost:9666, or a `cnlActivate`
// message from background.js for a jdcheck.js probe. Only then exposes
// `jdownloader` and hooks form.submit() via Xray wrappers.

const CNL_KEYS = ['cnlActive', 'token'];
let cnlEnabled = false;

function readConfig(data) {
  cnlEnabled = data.cnlActive !== false && !!data.token;
}

const configReady = browser.storage.local.get(CNL_KEYS).then(readConfig);
browser.storage.onChanged.addListener((changes) => {
  if (CNL_KEYS.some(k => k in changes)) browser.storage.local.get(CNL_KEYS).then(readConfig);
});

function isCnlUrl(url) {
  try {
    const { hostname, port } = new URL(url);
    return port === '9666' && (hostname === '127.0.0.1' || hostname === 'localhost');
  } catch {
    return false;
  }
}

let activated = false;

function installHooks() {
  const page = window.wrappedJSObject;

  // `jdownloader` reads true while CNL is active; page writes are kept for when it is not.
  let pageValue = page.jdownloader;
  try {
    Object.defineProperty(page, 'jdownloader', {
      configurable: true,
      get: exportFunction(() => cnlEnabled || pageValue, window),
      set: exportFunction((v) => { pageValue = v; }, window),
    });
  } catch {
    // Declared via `var` (non-configurable), e.g. by the redirected jdcheck.js — already true.
  }

  const nativeSubmit = HTMLFormElement.prototype.submit;
  exportFunction(function () {
    const action = this.action || '';
    if (cnlEnabled && isCnlUrl(action)) {
      const data = {};
      const els = this.querySelectorAll('[name]');
      for (let i = 0; i < els.length; i++) data[els[i].name] = els[i].value;
      // Name from the `package` field (JDData[3] as backup), never `source` —
      // that is the referer URL. Empty → JD names from the filename.
      const packageName = data.package || (page.JDData && page.JDData[3]) || '';
      browser.runtime.sendMessage({ type: 'cnlFormIntercept', action, formData: data, packageName });
      return;
    }
    nativeSubmit.call(this);
  }, page.HTMLFormElement.prototype, { defineAs: 'submit' });
}

async function activate() {
  if (activated) return;
  await configReady;
  if (activated || !cnlEnabled) return;
  activated = true;
  installHooks();
}

document.addEventListener('securitypolicyviolation', (e) => {
  if (isCnlUrl(e.blockedURI)) activate();
});

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'cnlActivate') activate();
});
