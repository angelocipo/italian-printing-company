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
  // Ruchira, per file of 1.000 bifold (×1.6 applied); quantity = files (1–10). Keep in sync with vip-studio-ruchira.html
  "r170": { label: "170gsm matte paper", before: 28320, after: 32640, name: "1.000 bifold each file, 4 pages — A3 folded to A4, 170gsm matte paper, double sided full color offset" },
  "r170g": { label: "170gsm glossy paper", before: 29280, after: 35200, name: "1.000 bifold each file, 4 pages — A3 folded to A4, 170gsm glossy paper, double sided full color offset" },
  "r250": { label: "250gsm matte paper", before: 35840, after: 40640, name: "1.000 bifold each file, 4 pages — A3 folded to A4, 250gsm matte paper, double sided full color offset" },
  "r250g": { label: "250gsm glossy paper", before: 38080, after: 42880, name: "1.000 bifold each file, 4 pages — A3 folded to A4, 250gsm glossy paper, double sided full color offset" },
  "q170": { label: "170gsm matte paper", before: 47200, after: 52500, name: "2.000 bifold each file, 4 pages — A3 folded to A4, 170gsm matte paper, double sided full color offset" },
  "q170g": { label: "170gsm glossy paper", before: 51300, after: null, name: "2.000 bifold each file, 4 pages — A3 folded to A4, 170gsm glossy paper, double sided full color offset" },
  "q250": { label: "250gsm matte paper", before: 59200, after: 65100, name: "2.000 bifold each file, 4 pages — A3 folded to A4, 250gsm matte paper, double sided full color offset" },
  "q250g": { label: "250gsm glossy paper", before: 67300, after: 73400, name: "2.000 bifold each file, 4 pages — A3 folded to A4, 250gsm glossy paper, double sided full color offset" },
  "mag": { label: "cover 300gsm, internal 250gsm, all matte", before: 38400, after: 44320, deadline: new Date("2026-10-19T09:00:00+02:00").getTime(), closes: new Date("2026-10-22T09:00:00+02:00").getTime(), name: "250 magazines, 12 pages, A5 — open A4, closed A5, cover 300gsm, internal 250gsm, all matte, double sided full color" },
  "m170": { label: "cover 300gsm, internal 170gsm, all matte", before: 26400, after: 31520, deadline: new Date("2026-10-20T09:00:00+02:00").getTime(), closes: new Date("2026-10-23T09:00:00+02:00").getTime(), name: "250 magazines, 12 pages, A5 — open A4, closed A5, cover 300gsm, internal 170gsm, all matte, double sided full color" },
  "mk": { label: "170gsm matte paper", before: 19520, after: 19520, deadline: new Date("2026-10-16T00:00:00+02:00").getTime(), closes: new Date("2026-10-19T09:00:00+02:00").getTime(), name: "100 full colour bifold — A3 folded to A4, 170gsm matte paper, double sided full colour" },
  "am8": { label: "production 8 working days", before: 54560, after: 54560, deadline: 0, name: "1 table cloth — 487x289,5cm, 100% polyester fabric 235 g/m², single sided full color, production 8 working days" },
  "am4": { label: "production 4 working days", before: 60160, after: 60160, deadline: 0, name: "1 table cloth — 487x289,5cm, 100% polyester fabric 235 g/m², single sided full color, production 4 working days" },
  "am2": { label: "Night Shift, production 2 working days", before: 65600, after: 65600, deadline: 0, name: "1 table cloth — 487x289,5cm, 100% polyester fabric 235 g/m², single sided full color, Night Shift, production 2 working days" }
};
// Rana offer (vip-studio-rana.html): itemised, cents. after = express price from deadline on.
const RANA = {
  roll: { name: "Rollup — 80/85x200cm · Aluminum frame with indestructible synthetic paper · single sided full color", before: 7000, after: null, deadline: new Date("2026-10-28T09:00:00+01:00").getTime(), max: 50 },
  bc250: { name: "6 x 250 business cards — 85x55mm, credit card size · 350gsm · double sided full color in offset", before: 22400, after: 28000, deadline: new Date("2026-10-20T09:00:00+02:00").getTime(), max: 1 },
  bc500: { name: "6 x 500 business cards — 85x55mm, credit card size · 350gsm · double sided full color in offset", before: 25300, after: 29900, deadline: new Date("2026-10-20T09:00:00+02:00").getTime(), max: 1 },
  br25: { name: "2,500 folded brochures — A4, open 63x29.7cm · 250gsm matte · double sided full color Offset", before: 83600, after: 104000, deadline: new Date("2026-10-21T09:00:00+02:00").getTime(), max: 1 },
  br50: { name: "5,000 folded brochures — A4, open 63x29.7cm · 250gsm matte · double sided full color Offset", before: 152800, after: 189200, deadline: new Date("2026-10-21T09:00:00+02:00").getTime(), max: 1 },
  env: { name: "2,500 DIN C6 (16,2 x 11,4 cm) envelopes — 80gsm · print full colour", before: 25600, after: null, deadline: new Date("2026-10-16T18:00:00+02:00").getTime(), max: 1 },
  wc: { name: "2.500 white cards A6 (15x10,5 cm) — turnaround time 7 working days", before: 13100, after: 18080, deadline: new Date("2026-10-21T09:00:00+02:00").getTime(), closes: new Date("2026-10-27T09:00:00+01:00").getTime(), max: 1 },
  envg: { name: "2.500 white DIN C6 (16,2 x 11,4 cm) envelopes — glossy gold foil", before: 277700, after: null, deadline: new Date("2026-10-16T18:00:00+02:00").getTime(), max: 1 }
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
  let PRODUCTS, label;
  if (body.items && typeof body.items === "object") {
    PRODUCTS = [];
    for (const k of Object.keys(RANA)) {
      const r = RANA[k], q = Math.max(0, Math.min(r.max, parseInt(body.items[k], 10) || 0));
      if (!q) continue;
      if (r.closes && Date.now() >= r.closes) return res.status(410).json({ error: r.name + " is no longer available." });
      const amount = r.deadline && Date.now() >= r.deadline ? r.after : r.before;
      if (amount == null) return res.status(410).json({ error: r.name + " is no longer available." });
      PRODUCTS.push({ name: r.name, amount, quantity: q });
    }
    if (!PRODUCTS.length) return res.status(400).json({ error: "No products selected." });
    const rq = (PRODUCTS.find(x => x.name === RANA.roll.name) || {}).quantity || 0;
    if (rq > 0) PRODUCTS.push({ name: "Rollup delivery — UPS Priority (" + rq + (rq > 1 ? " rollups" : " rollup") + ")", amount: 2000 + 1500 * (rq - 1), quantity: 1 });
    label = PRODUCTS.map(x => x.quantity + "x " + x.name).join("; ").slice(0, 490);
  } else {
    const paper = PAPERS[body.paper] || (/^ms[0-9]$/.test(body.paper) ? PAPERS.am8 : PAPERS["170"]);
    if (paper.closes && Date.now() >= paper.closes) return res.status(410).json({ error: "This offer has ended. Contact us for a new quote." });
    const amount = Date.now() < (paper.deadline || DEADLINE) ? paper.before : paper.after;
    if (amount == null) return res.status(410).json({ error: paper.label + " is no longer available at this price." });
    PRODUCTS = [{ name: paper.name || "2.000 bifold, 4 pages — A3 folded to A4, " + paper.label + ", double sided full color offset", amount }];
    label = paper.label;
    if (/^[rq](170|250)g?$/.test(body.paper)) { const fq = Math.max(1, Math.min(10, parseInt(body.files, 10) || 1)); PRODUCTS[0].quantity = fq; label = fq + (fq > 1 ? " files" : " file") + " × " + (body.paper[0] === "q" ? "2.000" : "1.000") + " bifold, " + paper.label; }
    if (/^(am|ms)[0-9]$/.test(body.paper)) {
      const q = Math.max(1, Math.min(20, parseInt(body.qty, 10) || 1));
      // Amanda mesh banner, cents (×1.6 applied). Keep in sync with vip-studio-amanda.html
      const MESH = { ms7: { amount: 30966, name: "Mesh banner — 487x359,5cm, mesh 260 g/m², single sided full color, production 7 working days" }, ms4: { amount: 35611, name: "Mesh banner — 487x359,5cm, mesh 260 g/m², single sided full color, Fast Track, production 4 working days" } };
      const tc = PRODUCTS[0]; tc.quantity = q; tc.name = tc.name.replace(/^1 table cloth/, "Table cloth");
      PRODUCTS = MESH[body.paper] ? [{ name: MESH[body.paper].name, amount: MESH[body.paper].amount, quantity: q }] : [tc];
      label = PRODUCTS.map(x => x.quantity + "x " + x.name).join("; ").slice(0, 490);
    }
    if (/^(am|ms)[0-9]$/.test(body.paper)) PRODUCTS.push(body.ship === "ovn" ? { name: "UPS overnight shipping (1 working day)", amount: 9900, quantity: 1 } : { name: "UPS standard shipping (2–3 working days)", amount: 5500, quantity: 1 });
    if (body.paper === "mk") PRODUCTS.push({ name: "UPS shipping to Madrid", amount: 5600, quantity: 1 });
  }
  const ref = String(body.ref || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  const email = String(body.email || "").slice(0, 200);
  const page = /^vip-studio[a-z0-9-]*\.html$/.test(String(body.page || "")) ? body.page : "vip-studio.html";

  const p = new URLSearchParams();
  p.append("mode", "payment");
  PRODUCTS.forEach((prod, i) => {
    p.append(`line_items[${i}][price_data][currency]`, "eur");
    p.append(`line_items[${i}][price_data][product_data][name]`, prod.name);
    p.append(`line_items[${i}][price_data][unit_amount]`, String(prod.amount));
    p.append(`line_items[${i}][quantity]`, String(prod.quantity || 1));
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
  p.append("metadata[paper]", label);

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

module.exports.PAPERS = PAPERS;
module.exports.RANA = RANA;
module.exports.DEADLINE = DEADLINE;
