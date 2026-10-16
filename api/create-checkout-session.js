// Vercel serverless function — creates a Stripe Checkout session for VIP Studio orders.
// Requires env var STRIPE_SECRET_KEY (Vercel → Project → Settings → Environment Variables).
// Place this file at /api/create-checkout-session.js in the repo root.

// Prices in cents, defined server-side so the client can't tamper with them.
// Prices before / after DEADLINE (Rome time). Keep in sync with VIP Studio.dc.html
const DEADLINE = new Date("2026-10-16T18:00:00+02:00").getTime();
const PAPERS = {
  "170": { label: "170gsm matte paper", before: 47200, after: 52500 },
  "170g": { label: "170gsm glossy paper", before: 51300, after: null },
  "250": { label: "250gsm matte paper", before: 59200, after: 65100 },
  "250g": { label: "250gsm glossy paper", before: 67300, after: 73400 },
  "mag": { label: "cover 300gsm, internal 250gsm, all matte", before: 38400, after: 44320, deadline: new Date("2026-10-19T09:00:00+02:00").getTime(), closes: new Date("2026-10-22T09:00:00+02:00").getTime(), name: "250 magazines, 12 pages, A5 — open A4, closed A5, cover 300gsm, internal 250gsm, all matte, double sided full color" },
  "m170": { label: "cover 300gsm, internal 170gsm, all matte", before: 26400, after: 31520, deadline: new Date("2026-10-20T09:00:00+02:00").getTime(), closes: new Date("2026-10-23T09:00:00+02:00").getTime(), name: "250 magazines, 12 pages, A5 — open A4, closed A5, cover 300gsm, internal 170gsm, all matte, double sided full color" }
};
const ZONES = {
  rome_s: { label: "Same day Rome South / EUR / Center", amount: 0 },
  rome:   { label: "Same day rest of Rome", amount: 0 },
  it:     { label: "Italy (+1 day)", amount: 0 }
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
  const paper = PAPERS[body.paper] || PAPERS["170"];
  if (paper.closes && Date.now() >= paper.closes) return res.status(410).json({ error: "This offer has ended. Contact us for a new quote." });
  const amount = Date.now() < (paper.deadline || DEADLINE) ? paper.before : paper.after;
  if (amount == null) return res.status(410).json({ error: paper.label + " is no longer available at this price." });
  const PRODUCTS = [{ name: paper.name || "2.000 bifold, 4 pages — A3 folded to A4, " + paper.label + ", double sided full color offset", amount }];
  const ref = String(body.ref || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  const email = String(body.email || "").slice(0, 200);
  const page = /^vip-studio[a-z0-9-]*\.html$/.test(String(body.page || "")) ? body.page : "vip-studio.html";

  const p = new URLSearchParams();
  p.append("mode", "payment");
  PRODUCTS.forEach((prod, i) => {
    p.append(`line_items[${i}][price_data][currency]`, "eur");
    p.append(`line_items[${i}][price_data][product_data][name]`, prod.name);
    p.append(`line_items[${i}][price_data][unit_amount]`, String(prod.amount));
    p.append(`line_items[${i}][quantity]`, "1");
  });
  const si = PRODUCTS.length;
  if (zone.amount > 0) {
  p.append(`line_items[${si}][price_data][currency]`, "eur");
  p.append(`line_items[${si}][price_data][product_data][name]`, "Shipping — " + zone.label);
  p.append(`line_items[${si}][price_data][unit_amount]`, String(zone.amount));
  p.append(`line_items[${si}][quantity]`, "1");
  }
  p.append("success_url", `${SITE}/${page}?paid=1&ref=${encodeURIComponent(ref)}`);
  p.append("cancel_url", `${SITE}/${page}?canceled=1`);
  p.append("client_reference_id", ref);
  if (email) p.append("customer_email", email);
  p.append("metadata[reference]", ref);
  p.append("metadata[paper]", paper.label);

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
    if (session.error) {
      console.error("Stripe error:", session.error.type, session.error.message);
      return res.status(502).json({ error: session.error.message });
    }
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: "Stripe request failed" });
  }
};
