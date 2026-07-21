'use strict';

window.jdownloader = true;

if (!window.__jdFormIntercepted) {
  window.__jdFormIntercepted = true;
  const _submit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () {
    const action = this.action || '';
    if (action.indexOf('9666') !== -1 || action.indexOf('/flash/add') !== -1) {
      const data = {};
      const els = this.querySelectorAll('[name]');
      for (let i = 0; i < els.length; i++) data[els[i].name] = els[i].value;
      // Name from the `package` field (JDData[3] as backup), never `source` —
      // that is the referer URL. Empty → JD names from the filename.
      const packageName = data.package || (window.JDData && window.JDData[3]) || '';
      document.dispatchEvent(new CustomEvent('__jd_cnl_submit', {
        detail: { action, data, packageName },
      }));
      return;
    }
    _submit.call(this);
  };
}
