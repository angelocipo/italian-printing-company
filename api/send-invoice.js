// Vercel serverless function — after the customer fills in the invoice details (step 2), emails the shop a
// FatturaPA XML draft (Aruba) built from those client fields: company, VAT number, SDI/PEC, address, postcode, city, country.
// Amounts and products come from the verified paid Stripe session, never from the browser.
const { fatturaFromOrder } = require("../lib/fattura-order");
const SITE = "https://www.italianprintingcompany.com";
const FROM = process.env.MAIL_FROM || "Italian Printing Company <order@italianprintingcompany.com>";
const SHOP = "info@italianprintingcompany.com";
const stripe = (path) => fetch("https://api.stripe.com/v1/" + path, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }).then(r => r.json());
const clean = (x, n) => { const s = String(x == null ? "" : x).trim().slice(0, n || 300); return /^[—–-]+$/.test(s) ? "" : s; };

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
    const b = body.f && typeof body.f === "object" ? body.f : {};
    const f = { name: clean(b.name, 120), company: clean(b.company, 120), vat: clean(b.vat, 30), sdi: clean(b.sdi, 80), billing: clean(b.billing, 300), postcode: clean(b.postcode, 20), city: clean(b.city, 80), country: clean(b.country, 60) };
    const d = {
      ref: s.client_reference_id || (s.metadata && s.metadata.reference) || sid.slice(-8), total: s.amount_total,
      lines: (li.data || []).map(x => ({ name: x.description, qty: x.quantity, amount: x.amount_total }))
    };
    const fx = fatturaFromOrder(d, s, f);
    const text = "Invoice details received for order " + d.ref + ".\n\nClient: " + (f.company || f.name) + (f.vat ? "\nVAT: " + f.vat : "") + (f.sdi ? "\nSDI/PEC: " + f.sdi : "") +
      "\nAddress: " + [f.billing, f.postcode, f.city, f.country].filter(Boolean).join(", ") + "\n\nThe attached XML replaces the draft sent with the payment confirmation (this one has the client's invoice data)." +
      (fx.warnings.length ? "\n\nNotes: " + fx.warnings.join(" | ") : "");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": "invoice-" + sid + "-" + Date.now().toString(36) },
      body: JSON.stringify({ from: FROM, to: [SHOP], subject: "Invoice XML (client data) — #" + d.ref, text, attachments: [{ filename: fx.filename, content: Buffer.from(fx.xml, "utf8").toString("base64") }] })
    });
    if (!r.ok) { console.error("Resend error:", await r.text()); return res.status(502).json({ error: "Email not sent" }); }
    return res.status(200).json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: "Invoice failed" }); }
};
