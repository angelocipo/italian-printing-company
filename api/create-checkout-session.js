// Vercel serverless function — creates a Stripe Checkout session for VIP Studio orders.
// Requires env var STRIPE_SECRET_KEY (Vercel → Project → Settings → Environment Variables).
// Place this file at /api/create-checkout-session.js in the repo root.

// Prices in cents, defined server-side so the client can't tamper with them.
const PRODUCTS = [
  { name: "10 Rigid posters — 60x90cm, Foam Boards PVC 5mm, single sided full color", amount: 69900 }
];
const ZONES = {
  rome_s: { label: "Same day Rome South / EUR / Center", amount: 2000 },
  rome:   { label: "Same day rest of Rome", amount: 3000 },
  it:     { label: "Italy (+1 day)", amount: 1500 }
};
const SITE = "https://www.italianprintingcompany.com";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const zone = ZONES[body.zone] || ZONES.it;
  const ref = String(body.ref || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  const email = String(body.email || "").slice(0, 200);

  const p = new URLSearchParams();
  p.append("mode", "payment");
  PRODUCTS.forEach((prod, i) => {
    p.append(`line_items[${i}][price_data][currency]`, "eur");
    p.append(`line_items[${i}][price_data][product_data][name]`, prod.name);
    p.append(`line_items[${i}][price_data][unit_amount]`, String(prod.amount));
    p.append(`line_items[${i}][quantity]`, "1");
  });
  const si = PRODUCTS.length;
  p.append(`line_items[${si}][price_data][currency]`, "eur");
  p.append(`line_items[${si}][price_data][product_data][name]`, "Shipping — " + zone.label);
  p.append(`line_items[${si}][price_data][unit_amount]`, String(zone.amount));
  p.append(`line_items[${si}][quantity]`, "1");
  p.append("success_url", `${SITE}/vip-studio.html?paid=1&ref=${encodeURIComponent(ref)}`);
  p.append("cancel_url", `${SITE}/vip-studio.html?canceled=1`);
  p.append("client_reference_id", ref);
  if (email) p.append("customer_email", email);
  p.append("metadata[reference]", ref);

  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: p.toString()
    });
    const session = await r.json();
    if (session.error) return res.status(502).json({ error: session.error.message });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: "Stripe request failed" });
  }
};
