'use strict';

if (!window.__jdCnlInjected) {
  window.__jdCnlInjected = true;

  const s = document.createElement('script');
  s.src = browser.runtime.getURL('content/cnl-page.js');
  s.onload = () => s.remove();
  (document.body || document.head || document.documentElement).appendChild(s);

  document.addEventListener('__jd_cnl_submit', (e) => {
    browser.runtime.sendMessage({
      type: 'cnlFormIntercept',
      action: e.detail.action,
      formData: e.detail.data,
      packageName: e.detail.packageName,
    });
  });
}
