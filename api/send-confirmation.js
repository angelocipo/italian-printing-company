// Vercel serverless function — sends the HTML order confirmation (Resend) after a paid VIP Studio order.
// Requires env vars: RESEND_API_KEY, STRIPE_SECRET_KEY. Optional: MAIL_FROM (default order@italianprintingcompany.com).
// Amounts, products and the customer email come from Stripe (verified paid session), never from the browser.
const { ddtPdf, ddtData } = require("../lib/ddt-pdf");
const { fatturaFromOrder } = require("../lib/fattura-order");
const SITE = "https://www.italianprintingcompany.com";
const FROM = process.env.MAIL_FROM || "Italian Printing Company <order@italianprintingcompany.com>";
const BCC = "info@italianprintingcompany.com";
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");
const val = (s) => (s && String(s).trim() ? esc(String(s).slice(0, 1000)) : "—");
const eur = (c) => "€ " + (c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const L = "font-size:11px; font-weight:700; color:#6e6e73; letter-spacing:1.4px;";
const row = (k, v, last) => `<tr><td width="150" valign="top" style="${last ? "" : "border-bottom:1px solid #e6e6e8; "}padding:12px 0; ${L}">${k}</td><td style="${last ? "" : "border-bottom:1px solid #e6e6e8; "}padding:12px 0; font-size:15px; line-height:1.45; color:#1d1d1f;">${v}</td></tr>`;

function html(d) {
  const lines = d.lines.map(l => `<tr>
<td style="border-bottom:1px solid #e6e6e8; padding:18px 0; font-size:15px; line-height:1.5; color:#1d1d1f;">${esc(l.name)}</td>
<td align="right" style="border-bottom:1px solid #e6e6e8; padding:18px 0 18px 14px; font-size:15px; color:#6e6e73; white-space:nowrap;">${l.qty}×</td>
<td align="right" style="border-bottom:1px solid #e6e6e8; padding:18px 0 18px 14px; font-size:15px; color:#1d1d1f; white-space:nowrap;">${eur(l.amount)}</td></tr>`).join("");
  const box = (title, inner, strong) => `<tr><td style="padding:${strong ? 28 : 22}px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:${strong ? "2px solid #0071e3" : "1px solid #d2d2d7"};"><tr><td style="padding:20px 22px;"><div style="font-size:11px; font-weight:700; color:#0071e3; letter-spacing:1.4px;">${title}</div>${inner}</td></tr></table></td></tr>`;
  const f = d.f;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Order confirmed</title></head>
<body style="margin:0; padding:0; background:#f2f2f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f4;"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:100%; background:#ffffff; border:1px solid #e0e0e3; font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<tr><td style="background:#1d1d1f; padding:30px 32px 28px;"><div style="font-size:12px; font-weight:700; color:#a1a1a6; letter-spacing:2px;">ITALIAN PRINTING COMPANY · VIP STUDIO</div><div style="font-size:34px; line-height:1.15; font-weight:700; color:#ffffff; letter-spacing:-0.8px; padding-top:8px;">Order confirmed</div></td></tr>
<tr><td style="padding:20px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:17px; line-height:1.35; color:#1d1d1f;">Thank you for your order${f.name ? ", " + esc(f.name) : ""}.</td><td align="right" style="white-space:nowrap; padding-left:12px;"><span style="display:inline-block; border:1px solid #d2d2d7; padding:7px 12px; font-size:14px; font-weight:700; color:#0071e3; letter-spacing:0.6px;">#${esc(d.ref)}</span></td></tr></table></td></tr>
<tr><td style="padding:26px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="border-bottom:2px solid #1d1d1f; padding-bottom:10px; ${L}">DETAIL</td><td align="right" style="border-bottom:2px solid #1d1d1f; padding-bottom:10px; ${L}">QTY</td><td align="right" style="border-bottom:2px solid #1d1d1f; padding-bottom:10px; ${L}">AMOUNT</td></tr>
${lines}
<tr><td style="padding:26px 0 0; ${L} font-size:12px;">TOTAL PAID</td><td colspan="2" align="right" style="padding:20px 0 0; font-size:32px; font-weight:700; color:#1d1d1f; letter-spacing:-1px; white-space:nowrap;">${eur(d.total)}</td></tr>
<tr><td colspan="3" align="right" style="padding:2px 0 0; font-size:13px; color:#6e6e73;">VAT included · delivery included</td></tr></table></td></tr>
${!(f.name || f.vat || f.billing) ? box("INVOICE DETAILS", `<div style="font-size:21px; font-weight:700; color:#1d1d1f; letter-spacing:-0.4px; padding-top:6px;">Complete your invoice details</div><div style="font-size:15px; line-height:1.55; color:#6e6e73; padding-top:8px;">Your payment is received. Fill in your invoice details and send your artwork on your order page, so we can issue the invoice and start production.</div><div style="padding-top:16px;"><a href="${esc(d.link)}" style="display:inline-block; background:#0071e3; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; padding:12px 24px; border-radius:980px;">Add invoice details</a></div>`, true) : box("INVOICE DETAILS", `<div style="font-size:21px; font-weight:700; color:#1d1d1f; letter-spacing:-0.4px; padding-top:6px;">The invoice will be issued like this</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">${row("NAME", val(f.name))}${row("COMPANY", val(f.company))}${row("VAT NUMBER", val(f.vat))}${row("SDI / PEC", val(f.sdi))}${row("ADDRESS", val([f.billing, [f.postcode, f.city].filter(Boolean).join(" "), f.country].filter(Boolean).join("\n")))}${row("EMAIL", `<a href="mailto:${esc(d.email)}" style="color:#0071e3;">${esc(d.email)}</a>`)}</table>
<div style="padding-top:14px; font-size:14px; line-height:1.5; color:#6e6e73;">Need a correction? Reply to this email within one working day, before the invoice is issued.</div>`, true)}
${box("ARTWORK", `<div style="font-size:15px; line-height:1.55; color:#6e6e73; padding-top:8px;">File reference: <strong style="color:#1d1d1f;">${esc(d.ref)}</strong> — ${val([f.file, f.filelink].filter(Boolean).join(", ")) === "—" ? "no file yet, please reply with your print-ready PDF" : val([f.file, f.filelink].filter(Boolean).join(", "))}</div><div style="font-size:14px; line-height:1.5; color:#6e6e73; padding-top:10px;">Quote this reference in every message about the order.</div>`)}
${box("DELIVERY / NOTES", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">${row("HOTEL", val(f.hotel))}${row("ADDRESS", val(f.shipping))}${row("GUEST", val([f.guest, f.guestPhone].filter(Boolean).join(" · ")))}${row("DEADLINE", val(f.deadline))}${row("NOTES", val(f.notes), 1)}</table>`)}
<tr><td style="padding:24px 32px 0;"><p style="margin:0; font-size:15px; line-height:1.55; color:#1d1d1f;">We check your file and confirm your deadline within one working day, then send the proof.</p></td></tr>
<tr><td style="padding:28px 32px 30px;"><div style="border-top:1px solid #e6e6e8; padding-top:18px; font-size:12px; line-height:1.6; color:#86868b;"><strong style="color:#1d1d1f; font-size:13px;">Italian Printing Company by Printing Italy di Angelo Cipolla</strong><br>Via Lorenzo Bonincontri 26, 00147 Roma RM · P.IVA 02452700590<br><a href="mailto:info@italianprintingcompany.com" style="color:#0071e3; text-decoration:none;">info@italianprintingcompany.com</a> · <a href="${SITE}" style="color:#0071e3; text-decoration:none;">italianprintingcompany.com</a></div></td></tr>
</table></td></tr></table></body></html>`;
}

const stripe = (path) => fetch("https://api.stripe.com/v1/" + path, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }).then(r => r.json());

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", SITE);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body || {};
  const sid = String(body.session_id || "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return res.status(400).json({ error: "Missing payment session" });
  try {
    const s = await stripe("checkout/sessions/" + sid);
    if (s.error || s.payment_status !== "paid") return res.status(402).json({ error: "Payment not found or not completed" });
    const li = await stripe("checkout/sessions/" + sid + "/line_items?limit=50");
    const email = (s.customer_details && s.customer_details.email) || s.customer_email;
    if (!email) return res.status(400).json({ error: "No customer email" });
    const f = body.f && typeof body.f === "object" ? body.f : {};
    const page = /^vip-studio[a-z0-9-]*\.html$/.test(String(body.page || "")) ? body.page : "vip-studio.html";
    const d = {
      link: SITE + "/" + page + "?paid=1&ref=" + encodeURIComponent(s.client_reference_id || "") + "&session_id=" + sid,
      ref: s.client_reference_id || (s.metadata && s.metadata.reference) || sid.slice(-8),
      email, f, total: s.amount_total,
      lines: (li.data || []).map(x => ({ name: x.description, qty: x.quantity, amount: x.amount_total }))
    };
    const mail = html(d), subject = "Order confirmed — #" + d.ref;
    const send = (to, key, replyTo, attachments) => fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": key + sid },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: replyTo, subject, html: mail, ...(attachments ? { attachments } : {}) })
    }).then(async r => ({ ok: r.ok, out: await r.json() }));
    // DDT (PDF) attached only to the shop copy
    let ddt = null;
    try { ddt = [{ filename: "DDT-" + String(d.ref).replace(/[^A-Za-z0-9-]/g, "") + ".pdf", content: Buffer.from(ddtPdf(ddtData(d.ref, s, f, d.lines)), "latin1").toString("base64") }]; } catch (e) { console.error("DDT error:", e); }
    // Aruba invoice draft (FatturaPA XML), shop copy only
    try { const fx = fatturaFromOrder(d, s, f); (ddt = ddt || []).push({ filename: fx.filename, content: Buffer.from(fx.xml, "utf8").toString("base64") }); if (fx.warnings.length) console.warn("Fattura " + d.ref + ": " + fx.warnings.join(" | ")); } catch (e) { console.error("Fattura XML error:", e); }
    // Same email, sent separately to the client and to the shop (identical content and subject)
    const [c, o] = await Promise.all([send(email, "confirm-", BCC), send(BCC, "confirm-shop-", email, ddt)]);
    if (!c.ok || !o.ok) { console.error("Resend error:", c.out, o.out); return res.status(502).json({ error: "Email not sent" }); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Confirmation failed" });
  }
};
