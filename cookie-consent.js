/* Italian Printing Company — cookie consent + Google Analytics 4 (G-T3KH910VM8).
   Google Consent Mode v2: everything starts "denied"; Analytics cookies are only set after "Accept all".
   The choice is stored in localStorage "ipc_cookie_consent" (same key as the homepage banner).
   Load this file early in <head>: <script src="cookie-consent.js"></script> */
(function () {
  var ID = 'G-T3KH910VM8', KEY = 'ipc_cookie_consent';
  var embedded = window.parent !== window;
  var get = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  var set = function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} };

  // 1. Google tag with consent defaults (skipped if the page already has its own gtag setup)
  var own = !!window.gtag;
  window.dataLayer = window.dataLayer || [];
  if (!own) {
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    if (get() === 'granted') gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', ID);
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
  }
  var grant = function () { gtag('consent', 'update', { analytics_storage: 'granted' }); };
  var deny = function () { gtag('consent', 'update', { analytics_storage: 'denied' }); };

  // 2. Banner (same look as the homepage banner) + "Cookie settings" link in the footer
  var ready = function (fn) { document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn(); };
  ready(function () {
    var existing = document.querySelector('[data-if="showCookie"]'), box;
    var open = function () {
      if (existing) { existing.hidden = false; existing.style.display = 'contents'; return; }
      box.hidden = false;
    };
    var close = function () { if (box) box.hidden = true; };
    if (!existing && !embedded) {
      box = document.createElement('div');
      box.hidden = true;
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Cookie preferences');
      box.innerHTML =
        '<div style="position:fixed; left:0; right:0; bottom:0; z-index:1000; display:flex; justify-content:center; padding:16px; pointer-events:none; font-family:\'SF Pro Display\',-apple-system,BlinkMacSystemFont,\'Helvetica Neue\',Inter,sans-serif;">' +
        '<div style="pointer-events:auto; max-width:560px; width:100%; background:rgba(255,255,255,0.92); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px); border:1px solid rgba(0,0,0,0.08); border-radius:20px; box-shadow:0 12px 40px rgba(0,0,0,0.16); padding:22px 24px; display:flex; flex-direction:column; gap:16px;">' +
        '<div><div style="font-size:16px; font-weight:600; letter-spacing:-0.3px; color:#1d1d1f;">We value your privacy</div>' +
        '<p style="font-size:14px; line-height:1.5; color:#6e6e73; margin:6px 0 0;">We use cookies to analyse traffic and improve your experience. Accept all cookies, or continue with only the essentials. You can change your choice any time under “Cookie settings” at the bottom of the page.</p></div>' +
        '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
        '<button type="button" data-cc="yes" style="flex:1; min-width:130px; background:#0071e3; color:#fff; border:none; font-family:inherit; font-size:15px; font-weight:500; padding:11px 20px; border-radius:980px; cursor:pointer;">Accept all</button>' +
        '<button type="button" data-cc="no" style="flex:1; min-width:130px; background:#f5f5f7; color:#1d1d1f; border:1px solid #e2e2e4; font-family:inherit; font-size:15px; font-weight:500; padding:11px 20px; border-radius:980px; cursor:pointer;">Essentials only</button>' +
        '</div></div></div>';
      document.body.appendChild(box);
      box.querySelector('[data-cc="yes"]').onclick = function () { set('granted'); grant(); close(); };
      box.querySelector('[data-cc="no"]').onclick = function () { set('denied'); deny(); close(); };
      if (!get()) open();
    }
    if (embedded) return;
    var foot = document.querySelector('footer');
    var a = document.createElement('a');
    a.href = '#'; a.textContent = 'Cookie settings';
    a.style.cssText = 'display:inline-block; margin-top:12px; font-size:12px; color:#6e6e73; text-decoration:underline; cursor:pointer;';
    a.onclick = function (e) { e.preventDefault(); open(); };
    if (foot) { var w = document.createElement('div'); w.style.textAlign = 'center'; w.appendChild(a); (foot.firstElementChild || foot).appendChild(w); }
    else { a.style.cssText += ' position:fixed; left:12px; bottom:10px; z-index:999; background:#fff; padding:4px 10px; border-radius:980px; border:1px solid #e2e2e4; margin:0;'; document.body.appendChild(a); }
  });
})();
