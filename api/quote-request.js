// Vercel serverless function — quote request forms on italianprintingcompany.com.
// Sends a branded HTML email (same look as the VIP Studio order confirmation) to the shop via Resend,
// with Reply-To set to the customer. If Resend fails, the request is forwarded to FormSubmit so no lead is lost.
// Requires env var RESEND_API_KEY (already used by api/send-confirmation.js). Optional: MAIL_FROM.
const SITE = "https://www.italianprintingcompany.com";
const FROM = process.env.MAIL_FROM || "Italian Printing Company <order@italianprintingcompany.com>";
const TO = "info@italianprintingcompany.com";
const FORMSUBMIT = "https://formsubmit.co/b942cfb9cc981f7a65b4d267ce82b00f";
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");
const clip = (s, n) => String(s == null ? "" : s).trim().slice(0, n || 2000);
const L = "font-size:11px; font-weight:700; color:#6e6e73; letter-spacing:1.4px;";
const row = (k, v, last) => `<tr><td width="150" valign="top" style="${last ? "" : "border-bottom:1px solid #e6e6e8; "}padding:12px 0; ${L}">${esc(k.toUpperCase())}</td><td style="${last ? "" : "border-bottom:1px solid #e6e6e8; "}padding:12px 0; font-size:15px; line-height:1.5; color:#1d1d1f;">${v}</td></tr>`;

function html(d) {
  const rows = d.fields.map((f, i) => row(f[0], f[1] ? esc(f[1]) : "—", i === d.fields.length - 1)).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>New quote request</title></head>
<body style="margin:0; padding:0; background:#f2f2f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f4;"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:100%; background:#ffffff; border:1px solid #e0e0e3; font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<tr><td style="background:#1d1d1f; padding:30px 32px 28px;"><div style="font-size:12px; font-weight:700; color:#a1a1a6; letter-spacing:2px;">ITALIAN PRINTING COMPANY · QUOTE REQUEST</div><div style="font-size:34px; line-height:1.15; font-weight:700; color:#ffffff; letter-spacing:-0.8px; padding-top:8px;">New quote request</div></td></tr>
<tr><td style="padding:22px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:17px; line-height:1.4; color:#1d1d1f;"><strong>${esc(d.material)}</strong>${d.city ? " · " + esc(d.city) : ""}</td>
<td align="right" style="white-space:nowrap; padding-left:12px;"><span style="display:inline-block; border:1px solid #d2d2d7; padding:7px 12px; font-size:14px; font-weight:700; color:#0071e3; letter-spacing:0.6px;">#${esc(d.ref)}</span></td></tr></table></td></tr>
<tr><td style="padding:22px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid #0071e3;"><tr><td style="padding:20px 22px;">
<div style="font-size:11px; font-weight:700; color:#0071e3; letter-spacing:1.4px;">REQUEST</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">${rows}</table>
</td></tr></table></td></tr>
<tr><td style="padding:28px 32px 30px;"><div style="border-top:1px solid #e6e6e8; padding-top:18px; font-size:12px; line-height:1.6; color:#86868b;">
Sent from <a href="${esc(d.pageUrl)}" style="color:#0071e3; text-decoration:none;">${esc(d.page)}</a> · ${esc(d.when)} Rome time<br>
<strong style="color:#1d1d1f; font-size:13px;">Italian Printing Company by Printing Italy di Angelo Cipolla</strong><br>Via Lorenzo Bonincontri 26, 00147 Roma RM · P.IVA 02452700590</div></td></tr>
</table></td></tr></table></body></html>`;
}

const done = (req, res, code, ok) => {
  if (String(req.headers.accept || "").includes("application/json")) return res.status(code).json({ ok });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(code).send(ok ? "<!DOCTYPE html><title>Sent</title><p>Thank you, your request was sent.</p>" : "<!DOCTYPE html><title>Error</title><p>Sorry, the request could not be sent.</p>");
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  let b = req.body || {};
  if (typeof b === "string") b = Object.fromEntries(new URLSearchParams(b));
  if (clip(b._honey)) return done(req, res, 200, true); // spam bot filled the hidden field
  const email = clip(b.email || b._replyto, 200);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return done(req, res, 400, false);
  const material = clip(b.Material, 200) || "Printing";
  const city = clip(b["Event city"], 100);
  const page = clip(b["Source page"], 200).replace(/[^A-Za-z0-9._\/-]/g, "") || "website";
  const skip = new Set(["email", "Material", "Event city", "Source page"]);
  const fields = [["Material", material], ["Event city", city]]
    .concat(Object.keys(b).filter(k => k[0] !== "_" && !skip.has(k)).map(k => [k.replace(/_/g, " "), clip(b[k])]))
    .concat([["Email", email]]);
  const ref = "Q-" + Array.from({ length: 6 }, () => "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 32)]).join("");
  const when = new Date().toLocaleString("en-GB", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const d = { ref, material, city, email, fields, page, pageUrl: SITE + "/" + (page === "index.html" ? "" : page), when };
  const subject = "Quote request — " + material + (city ? " (" + city + ")" : "") + " · #" + ref;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": "quote-" + ref },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject, html: html(d) })
    });
    if (r.ok) return done(req, res, 200, true);
    console.error("Resend error:", r.status, await r.text());
  } catch (e) { console.error("Resend failed:", e); }
  // Fallback: forward to FormSubmit (old route) so the request still arrives
  try {
    const p = new URLSearchParams();
    p.append("_subject", subject); p.append("_template", "table"); p.append("_captcha", "false"); p.append("_replyto", email);
    fields.forEach(f => p.append(f[0], f[1] || "—")); p.append("Source page", page);
    const r2 = await fetch(FORMSUBMIT, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", Referer: SITE + "/" }, body: p.toString() });
    if (r2.ok) return done(req, res, 200, true);
  } catch (e) { console.error("FormSubmit fallback failed:", e); }
  return done(req, res, 502, false);
};
