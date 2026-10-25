// Builds a one-page A4 DDT (documento di trasporto, D.P.R. 472/1996) as a PDF string (latin1 bytes). No dependencies.
// Used by api/send-confirmation.js: attached only to the shop copy of the order confirmation.
const enc = (s) => String(s == null ? "" : s)
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-")
  .replace(/\u20AC/g, "\x80").replace(/[^\x00-\xff]/g, "?").replace(/[\r\n\t]+/g, " ");
const esc = (s) => enc(s).replace(/[\\()]/g, "\\$&");

function ddtPdf(d, logo) {
  const W = 595, H = 842, M = 40, CW = W - 2 * M;
  const o = [];
  const T = (x, y, s, sz, b) => o.push(`BT /${b ? "F2" : "F1"} ${sz || 10} Tf ${x} ${y} Td (${esc(s)}) Tj ET`);
  const L = (x1, y1, x2, y2, w) => o.push(`${w || 0.6} w ${x1} ${y1} m ${x2} ${y2} l S`);
  const B = (x, y, w, h) => o.push(`0.6 w ${x} ${y} ${w} ${h} re S`);
  const wrap = (s, sz, maxW) => {
    const max = Math.max(8, Math.floor(maxW / (sz * 0.53))), out = [];
    String(s || "").split(/\n/).forEach(p => {
      let line = "";
      p.split(/\s+/).filter(Boolean).forEach(w => {
        while (w.length > max) { if (line) { out.push(line); line = ""; } out.push(w.slice(0, max)); w = w.slice(max); }
        if ((line + " " + w).trim().length > max) { out.push(line); line = w; } else line = (line + " " + w).trim();
      });
      if (line) out.push(line);
    });
    return out;
  };
  const cell = (x, yTop, w, h, label, lines, sz) => {
    B(x, yTop - h, w, h);
    T(x + 8, yTop - 13, label, 7.5, 1);
    let yy = yTop - 27;
    (lines || []).forEach((ln, i) => wrap(ln, sz || 10, w - 16).forEach(t => { if (yy > yTop - h + 6) { T(x + 8, yy, t, sz || 10, i === 0 && lines.length > 1); yy -= (sz || 10) + 3; } }));
  };
  let y = H - M;
  if (logo) { const lh = 40, lw = Math.round(lh * logo.w / logo.h); o.push(`q ${lw} 0 0 ${lh} ${M} ${y - lh} cm /Im1 Do Q`); }
  T(M, y - 64, "DOCUMENTO DI TRASPORTO", 18, 1);
  T(M, y - 79, "D.D.T. - D.P.R. 472/1996", 9);
  B(W - M - 200, y - 82, 200, 42);
  T(W - M - 190, y - 57, "N. " + d.ref, 11, 1);
  T(W - M - 190, y - 73, "Data: " + d.date, 10);
  y -= 98;
  const half = (CW - 10) / 2;
  cell(M, y, half, 98, "MITTENTE", ["Italian Printing Company", "by Printing Italy di Angelo Cipolla", "Via Lorenzo Bonincontri 26", "00147 Roma RM - Italia", "P.IVA 02452700590"]);
  cell(M + half + 10, y, half, 98, "DESTINATARIO", [d.to.name || "-", ...d.to.lines]);
  y -= 108;
  cell(M, y, CW, 84, "LUOGO DI DESTINAZIONE", [d.dest.name || "-", ...d.dest.lines]);
  y -= 94;
  const q = CW / 4;
  [["CAUSALE DEL TRASPORTO", "Vendita"], ["TRASPORTO A CURA DI", "Vettore"], ["VETTORE", "UPS"], ["PORTO", "Franco"]]
    .forEach(([k, v], i) => cell(M + i * q, y, q, 40, k, [v]));
  y -= 52;
  const qx = M + CW - 110, ux = M + CW - 50;
  L(M, y, M + CW, y, 1.2);
  T(M + 8, y - 13, "DESCRIZIONE DEI BENI", 7.5, 1); T(qx + 8, y - 13, "QUANTITA'", 7.5, 1); T(ux + 8, y - 13, "U.M.", 7.5, 1);
  y -= 20; L(M, y, M + CW, y);
  (d.items.length ? d.items : [{ name: "-", qty: "" }]).forEach(it => {
    const lines = wrap(it.name, 10, qx - M - 16);
    const h = lines.length * 13 + 12;
    lines.forEach((t, i) => T(M + 8, y - 15 - i * 13, t, 10));
    T(qx + 8, y - 15, String(it.qty), 10, 1); T(ux + 8, y - 15, "pz", 10);
    y -= h; L(M, y, M + CW, y);
  });
  y -= 12;
  const t3 = CW / 3;
  [["ASPETTO ESTERIORE DEI BENI", ""], ["N. COLLI", ""], ["PESO (KG)", ""]].forEach(([k], i) => cell(M + i * t3, y, t3, 40, k, []));
  y -= 50;
  cell(M, y, CW / 2 - 5, 40, "DATA E ORA INIZIO TRASPORTO", []);
  cell(M + CW / 2 + 5, y, CW / 2 - 5, 40, "RIFERIMENTO ORDINE", ["VIP Studio #" + d.ref]);
  y -= 50;
  const notes = wrap(d.notes || "-", 9.5, CW - 16).slice(0, 5);
  cell(M, y, CW, Math.max(40, notes.length * 12.5 + 28), "NOTE", []);
  notes.forEach((t, i) => T(M + 8, y - 27 - i * 12.5, t, 9.5));
  y -= Math.max(40, notes.length * 12.5 + 28) + 10;
  [["FIRMA MITTENTE"], ["FIRMA VETTORE"], ["FIRMA DESTINATARIO"]].forEach(([k], i) => cell(M + i * t3, y, t3, 62, k, []));
  T(M, M - 10, "Italian Printing Company by Printing Italy di Angelo Cipolla - info@italianprintingcompany.com - www.italianprintingcompany.com", 7.5);

  const stream = o.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>${logo ? " /XObject << /Im1 7 0 R >>" : ""} >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  if (logo) objs.push(
    `<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 8 0 R /Length ${logo.rgb.length} >>\nstream\n${logo.rgb}\nendstream`,
    `<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.alpha.length} >>\nstream\n${logo.alpha}\nendstream`);
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offs = objs.map((ob, i) => { const at = out.length; out += `${i + 1} 0 obj\n${ob}\nendobj\n`; return at; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(n => String(n).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return out;
}

// Order data -> DDT fields. s = Stripe session, f = page form fields, lines = Stripe line items.
function ddtData(ref, s, f, lines) {
  const cd = (s && s.customer_details) || {};
  const j = (...a) => a.filter(v => v && String(v).trim()).join(" ");
  const invoiceAddr = [f.billing, j(f.postcode, f.city), f.country].filter(v => v && String(v).trim());
  return {
    ref,
    date: new Date().toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" }),
    to: { name: f.company || f.name || cd.name || "", lines: [f.company && f.name ? f.name : "", ...invoiceAddr, f.vat ? "P.IVA " + f.vat : ""].filter(Boolean) },
    dest: { name: f.hotel || f.guest || cd.name || "", lines: [f.shipping, f.guest && f.hotel ? "c/o " + f.guest : "", f.guestPhone || cd.phone ? "Tel. " + (f.guestPhone || cd.phone) : ""].filter(Boolean) },
    items: lines.filter(l => !/shipping|spedizione/i.test(l.name || "")).map(l => ({ name: l.name, qty: l.qty })),
    notes: [f.deadline ? "Consegna richiesta: " + f.deadline : "", f.notes || ""].filter(Boolean).join(" - ")
  };
}

// Logo from lib/ddt-logo.js, decoded to latin1 byte strings once
let LOGO = null;
try { const l = require("./ddt-logo"); const b = (x) => Buffer.from(x, "base64").toString("latin1"); LOGO = { w: l.w, h: l.h, rgb: b(l.rgb), alpha: b(l.alpha) }; } catch (e) {}
const ddtPdfWithLogo = (d) => ddtPdf(d, LOGO);

module.exports = { ddtPdf: ddtPdfWithLogo, ddtData };
