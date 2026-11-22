// Sends the VIP Studio form (order, formal quote, invoice details) through /api/order-email (branded emails).
// If that fails, or the artwork file is too big for it, falls back to the old FormSubmit route so no request is lost.
(function () {
  var FS = 'https://formsubmit.co/ajax/b942cfb9cc981f7a65b4d267ce82b00f';
  var legacy = function (d) { return fetch(FS, { method: 'POST', body: d, headers: { Accept: 'application/json' } }); };
  window.ipcFS = function (d) {
    try {
      var o = { fields: [], subject: '', replyto: '', email: '', autoresponse: '' }, file = null;
      d.forEach(function (v, k) {
        if (typeof File !== 'undefined' && v instanceof File) { file = v; return; }
        if (k === '_subject') o.subject = v; else if (k === '_replyto') o.replyto = v; else if (k === '_autoresponse') o.autoresponse = v;
        else if (k === 'email') o.email = v; else if (k.charAt(0) !== '_') o.fields.push([k, v]);
      });
      var post = function (att) {
        if (att) o.attachment = att;
        return fetch('/api/order-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }).then(function (r) { if (!r.ok) throw new Error('mail'); return r; });
      };
      var p;
      if (file && file.size > 0) {
        if (file.size > 2.8 * 1024 * 1024) return legacy(d);
        p = new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res({ name: file.name, content: String(fr.result).split(',')[1] || '' }); }; fr.onerror = rej; fr.readAsDataURL(file); }).then(post);
      } else p = post();
      return p.catch(function () { return legacy(d); });
    } catch (e) { return legacy(d); }
  };
})();
