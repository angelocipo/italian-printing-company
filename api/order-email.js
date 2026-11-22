// Vercel serverless function — branded emails for the VIP Studio forms (order, formal quote, invoice details).
// Replaces the plain FormSubmit "table" email: same look as the order confirmation / quote request emails.
// The page posts the form fields as JSON; this sends (1) the shop email with Reply-To = customer and the artwork attached,
// (2) the customer's auto-reply. If anything fails the page falls back to FormSubmit, so no lead is lost.
// Requires env var RESEND_API_KEY (already used by the other functions). Optional: MAIL_FROM.
const SITE = "https://www.italianprintingcompany.com";
const FROM = process.env.MAIL_FROM || "Italian Printing Company <order@italianprintingcompany.com>";
const SHOP = "info@italianprintingcompany.com";
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");
const clip = (s, n) => String(s == null ? "" : s).trim().slice(0, n || 3000);
const L = "font-size:11px; font-weight:700; color:#6e6e73; letter-spacing:1.4px;";
const row = (k, v, last) => `<tr><td width="150" valign="top" style="${last ? "" : "border-bottom:1px solid #e6e6e8; "}padding:12px 0; ${L}">${esc(String(k).toUpperCase())}</td><td style="${last ? "" : "border-bottom:1px solid #e6e6e8; "}padding:12px 0 12px 12px; font-size:15px; line-height:1.45; color:#1d1d1f; word-break:break-word;">${v}</td></tr>`;
const box = (title, inner, strong) => `<tr><td style="padding:${strong ? 28 : 22}px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:${strong ? "2px solid #0071e3" : "1px solid #d2d2d7"};"><tr><td style="padding:20px 22px;"><div style="font-size:11px; font-weight:700; color:#0071e3; letter-spacing:1.4px;">${title}</div>${inner}</td></tr></table></td></tr>`;
const table = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">${rows}</table>`;

const GROUPS = [
  ["ORDER", ["Request type", "Paper", "Production", "Expected delivery", "Order", "Subtotal", "Total", "Shipping", "Grand total"], 1],
  ["CUSTOMER", ["Name", "Email", "Phone", "Company", "VAT number", "Codice destinatario / PEC", "Billing address", "Postcode", "City", "Country"]],
  ["DELIVERY", ["Hotel name", "Shipping address", "Registered guest", "Venue mobile", "Deadline"]],
];
const isMail = (v) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);

function value(k, v) {
  v = String(v || "").trim();
  if (!v || v === "—") return "—";
  if (k === "Order") {
    return v.split("\n").map(l => { const i = l.lastIndexOf(" — "); const a = i > 0 ? esc(l.slice(0, i)) : esc(l), b = i > 0 ? esc(l.slice(i + 3)) : ""; return `<div style="padding:2px 0;">${a}${b ? ` <strong style="white-space:nowrap;">— ${b}</strong>` : ""}</div>`; }).join("");
  }
  if (k === "Expected delivery") return `<strong>${esc(v)}</strong>`;
  if (/^https?:\/\//i.test(v)) return `<a href="${esc(v)}" style="color:#0071e3;">${esc(v)}</a>`;
  if (isMail(v)) return `<a href="mailto:${esc(v)}" style="color:#0071e3;">${esc(v)}</a>`;
  return esc(v);
}

function shell(kicker, title, ref, bodyRows, d) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0; padding:0; background:#f2f2f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f4;"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:100%; background:#ffffff; border:1px solid #e0e0e3; font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<tr><td style="background:#1d1d1f; padding:30px 32px 28px;"><div style="font-size:12px; font-weight:700; color:#a1a1a6; letter-spacing:2px;">${esc(kicker)}</div><div style="font-size:34px; line-height:1.15; font-weight:700; color:#ffffff; letter-spacing:-0.8px; padding-top:8px;">${esc(title)}</div></td></tr>
<tr><td style="padding:20px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:17px; line-height:1.35; color:#1d1d1f;">${d.lead || ""}</td><td align="right" style="white-space:nowrap; padding-left:12px;">${ref ? `<span style="display:inline-block; border:1px solid #d2d2d7; padding:7px 12px; font-size:14px; font-weight:700; color:#0071e3; letter-spacing:0.6px;">#${esc(ref)}</span>` : ""}</td></tr></table></td></tr>
${bodyRows}
<tr><td style="padding:28px 32px 30px;"><div style="border-top:1px solid #e6e6e8; padding-top:18px; font-size:12px; line-height:1.6; color:#86868b;">${d.foot || ""}<strong style="color:#1d1d1f; font-size:13px;">Italian Printing Company by Printing Italy di Angelo Cipolla</strong><br>Via Lorenzo Bonincontri 26, 00147 Roma RM · P.IVA 02452700590<br><a href="mailto:${SHOP}" style="color:#0071e3; text-decoration:none;">${SHOP}</a></div></td></tr>
</table></td></tr></table></body></html>`;
}

function shopHtml(o, map, ref, kind) {
  const used = new Set();
  let out = "";
  GROUPS.forEach(([title, keys, strong]) => {
    const rows = keys.filter(k => map[k] != null && String(map[k]).trim() && String(map[k]).trim() !== "—").map(k => { used.add(k); return [k, value(k, map[k])]; });
    if (rows.length) out += box(title, table(rows.map((r, i) => row(r[0], r[1], i === rows.length - 1)).join("")), strong);
  });
  used.add("Reference"); 
  const rest = Object.keys(map).filter(k => !used.has(k) && String(map[k]).trim() && String(map[k]).trim() !== "\u2014").map(k => [k, value(k, map[k])]);
  if (rest.length) out += box("NOTES / FILES", table(rest.map((r, i) => row(r[0], r[1], i === rest.length - 1)).join("")));
  const titles = { order: "New VIP order", quote: "New VIP quote request", invoice: "Invoice details received" };
  return shell("ITALIAN PRINTING COMPANY · VIP STUDIO", titles[kind], ref, out, {
    lead: esc(map.Name || ""),
    foot: `Reply to this email to answer the customer directly.<br>`
  });
}

function customerHtml(o, map, ref, kind) {
  const text = String(o.autoresponse || "");
  const paras = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const greet = paras[0] || (kind === "quote" ? "Thank you for your quote request." : "Thank you for your order.");
  const ti = paras.findIndex(p => /^Total:/m.test(p));
  const after = ti >= 0 ? paras.slice(ti + 1) : [];
  let out = "";
  const rows = [];
  ["Order", "Expected delivery", "Production"].forEach(k => { if (map[k] && String(map[k]).trim() !== "—") rows.push([k === "Order" ? (kind === "quote" ? "Quote" : "Order") : k, value(k, map[k])]); });
  const tot = map["Grand total"] || map.Total;
  if (tot) rows.push(["Total", `<strong>${esc(tot)}</strong> <span style="color:#6e6e73;">VAT included</span>`]);
  if (rows.length) out += box(kind === "quote" ? "YOUR QUOTE REQUEST" : "YOUR ORDER", table(rows.map((r, i) => row(r[0], r[1], i === rows.length - 1)).join("")), 1);
  const note = (after.length ? after : (ti < 0 ? paras.slice(1) : [])).filter(p => !/^Italian Printing Company by/.test(p));
  if (note.length) out += `<tr><td style="padding:24px 32px 0;">${note.map(p => `<p style="margin:0 0 12px; font-size:15px; line-height:1.55; color:#1d1d1f;">${esc(p)}</p>`).join("")}</td></tr>`;
  return shell("ITALIAN PRINTING COMPANY · VIP STUDIO", kind === "quote" ? "Quote request received" : "Order received", ref, out, { lead: esc(greet) });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", SITE);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const origin = String(req.headers.origin || "");
  if (origin && !/^https:\/\/(www\.)?italianprintingcompany\.com$/.test(origin)) return res.status(403).json({ error: "Forbidden" });
  const o = req.body && typeof req.body === "object" ? req.body : {};
  const fields = Array.isArray(o.fields) ? o.fields.slice(0, 60).filter(f => Array.isArray(f) && f.length === 2) : [];
  const map = {};
  fields.forEach(([k, v]) => { map[clip(k, 60)] = clip(v, 4000); });
  const ref = clip(map.Reference, 20);
  if (!/^(VIP|Q)-[A-Z0-9]{4,10}$/.test(ref)) return res.status(400).json({ error: "Bad reference" });
  const email = clip(o.email || map.Email, 200);
  const replyTo = isMail(clip(o.replyto, 200)) ? clip(o.replyto, 200) : (isMail(email) ? email : undefined);
  const rt = String(map["Request type"] || "");
  const kind = /invoice/i.test(rt) ? "invoice" : /quote/i.test(rt) || /^Q-/.test(ref) ? "quote" : "order";
  if (email) map.Email = email;
  const att = o.attachment && o.attachment.content ? [{ filename: clip(o.attachment.name, 120).replace(/[^\w.\- ()]/g, "_") || "artwork", content: String(o.attachment.content).slice(0, 4200000) }] : undefined;
  const subject = clip(o.subject, 200) || ("VIP " + kind + " " + ref);
  const send = (to, subj, html, key, reply, attachments) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: reply, subject: subj, html, ...(attachments ? { attachments } : {}) })
  }).then(async r => ({ ok: r.ok, out: await r.json().catch(() => ({})) }));
  try {
    const stamp = Date.now().toString(36);
    const jobs = [send(SHOP, subject, shopHtml(o, map, ref, kind), "ord-shop-" + ref + "-" + kind + "-" + stamp, replyTo, att)];
    if (kind !== "invoice" && o.autoresponse && isMail(email)) {
      const cs = kind === "quote" ? "Your quote request #" + ref + " — Italian Printing Company" : "Your order #" + ref + " — Italian Printing Company";
      jobs.push(send(email, cs, customerHtml(o, map, ref, kind), "ord-cust-" + ref + "-" + kind + "-" + stamp, SHOP));
    }
    const [s, c] = await Promise.all(jobs);
    if (!s.ok) { console.error("Resend shop email error:", s.out); return res.status(502).json({ error: "Email not sent" }); }
    if (c && !c.ok) console.error("Resend customer email error:", c.out);
    return res.status(200).json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: "Failed" }); }
};
