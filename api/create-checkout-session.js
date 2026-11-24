// Vercel serverless function — creates a Stripe Checkout session (or a Nexi XPay payment page when body.provider === "nexi") for VIP Studio orders.
// Requires env var STRIPE_SECRET_KEY (Vercel → Project → Settings → Environment Variables).
// Place this file at /api/create-checkout-session.js in the repo root.

// Prices in cents, defined server-side so the client can't tamper with them.
// Prices before / after DEADLINE (Rome time). Keep in sync with VIP Studio.dc.html
const DEADLINE = new Date("2026-10-16T18:00:00+02:00").getTime();
const PAPERS = {
  // vip-studio.html: test price € 0,50 (end price, no ×1.6)
  "170": { label: "170gsm matte paper", before: 50, after: 50 },
  "170g": { label: "170gsm glossy paper", before: 50, after: 50 },
  "250": { label: "250gsm matte paper", before: 50, after: 50 },
  "250g": { label: "250gsm glossy paper", before: 50, after: 50 },
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
  // Cat (vip-studio-cat.html), final prices (no ×1.6): Night Shift, order by 09:00 Rome for next-working-day delivery (Mon 26 Oct 09:00 → Tue 27 Oct); later orders roll to the following day, never closes
  "cat20": { label: "20 pages", before: 53100, after: 53100, deadline: new Date("2026-10-23T00:00:00+02:00").getTime(), closes: 8.64e15, name: "500 magazines, 20 pages, A5 — open A4, closed A5, 130gsm glossy, double sided full color" },
  "cat28": { label: "28 pages", before: 69200, after: 69200, deadline: new Date("2026-10-23T00:00:00+02:00").getTime(), closes: 8.64e15, name: "500 magazines, 28 pages, A5 — open A4, closed A5, 130gsm glossy, double sided full color" },
  "catst": { label: "1.000 stickers ø 4 cm", before: 19800, after: 19800, deadline: new Date("2026-10-23T00:00:00+02:00").getTime(), closes: 8.64e15, name: "1.000 stickers — round ø 4 cm, full color" },
  "catst2": { label: "2.000 stickers ø 4 cm", before: 25800, after: 25800, deadline: new Date("2026-10-23T00:00:00+02:00").getTime(), closes: 8.64e15, name: "2.000 stickers — round ø 4 cm, full color" },
  // Arina (vip-studio-arina.html), final prices (no ×1.6): Standard 6–8 wd € 218,62 (112 ×1.22 ×1.6) until Wed 21 Oct 09:00, Express 5–6 wd € 277,18 (142 ×1.22 ×1.6) until Fri 23 Oct 09:00, delivery Fri 30 Oct
  "arina": { label: "130gsm glossy", before: 21862, after: 27718, deadline: new Date("2026-10-21T09:00:00+02:00").getTime(), closes: new Date("2026-10-23T09:00:00+02:00").getTime(), name: "50 magazines, 24 pages, A4 — open A3, closed A4, 130gsm glossy, double sided full color" },
  // Karl (vip-studio-karl.html), final client prices (no ×1.6): Standard 7 wd until Thu 22 Oct 09:00, Fast Track 3 wd until Wed 28 Oct 09:00, then closed
  "karl": { label: "130gsm paper", before: 29700, after: 39300, deadline: new Date("2026-10-22T09:00:00+02:00").getTime(), closes: new Date("2026-10-28T09:00:00+01:00").getTime(), name: "5,000 flyers — A4, 130gsm paper" },
  // Taylor (vip-studio-taylor.html): Flyeralarm Express € 94,56 ×1.8 = € 170,21 (Fast Track, 2 wd) until Tue 10 Nov 09:00, Overnight € 117,64 ×1.8 = € 211,75 (Night Shift, 1 wd) until Wed 11 Nov 09:00, then closed; delivery Thu 12 Nov
  "taylor": { label: "170gsm glossy paper", before: 17021, after: 21175, deadline: new Date("2026-11-10T09:00:00+01:00").getTime(), closes: new Date("2026-11-11T09:00:00+01:00").getTime(), name: "250 flyers — A4, 170gsm glossy paper, double sided full color, one sheet per copy (2-page PDF: page 1 front, page 2 back)" },
  // Posters (vip-studio-posters.html): price per run of 50 A2 posters (one design), 100gsm glossy, supplier × 1.6: Fast Track € 142 × 1.6 = € 227,20 (3 wd, delivery 16 Nov ~90%), Standard € 111 × 1.6 = € 177,60 (7 wd); qty = runs (+/−, 1–20, default 1); double sided; 130gsm (pst2b/pst7b): Fast Track € 123 × 1.6 = € 196,80, Standard € 91 × 1.6 = € 145,60 per run; delivery Mon 16 Nov; Fast Track closes Wed 11 Nov 11:00; Standard closed (7 wd can't make delivery Mon 16 Nov)
  "pst2": { label: "100gsm glossy paper, Fast Track", before: 22720, after: 22720, deadline: new Date("2026-11-11T11:00:00+01:00").getTime(), closes: new Date("2026-11-11T11:00:00+01:00").getTime(), name: "Poster run — 50 copies of one design, A2 42×59.4 cm, 100gsm glossy paper, double sided full color, Fast Track, production 3 working days" },
  "pst7": { label: "100gsm glossy paper, Standard", before: 17760, after: 17760, deadline: new Date("2026-11-12T09:00:00+01:00").getTime(), closes: new Date("2026-11-11T00:00:00+01:00").getTime(), name: "Poster run — 50 copies of one design, A2 42×59.4 cm, 100gsm glossy paper, double sided full color, Standard, production 7 working days" },
  "pst2b": { label: "130gsm glossy paper, Fast Track", before: 19680, after: 19680, deadline: new Date("2026-11-11T11:00:00+01:00").getTime(), closes: new Date("2026-11-11T11:00:00+01:00").getTime(), name: "Poster run — 50 copies of one design, A2 42×59.4 cm, 130gsm glossy paper, double sided full color, Fast Track, production 3 working days" },
  "pst7b": { label: "130gsm glossy paper, Standard", before: 14560, after: 14560, deadline: new Date("2026-11-12T09:00:00+01:00").getTime(), closes: new Date("2026-11-11T00:00:00+01:00").getTime(), name: "Poster run — 50 copies of one design, A2 42×59.4 cm, 130gsm glossy paper, double sided full color, Standard, production 7 working days" },
  // Sarah (vip-studio-sarah.html): fabric banner 12 x 4 ft (366 x 122 cm), final price € 147 per banner (no ×1.6), UPS delivery in Italy included. Night Shift, closes Thu 19 Nov 09:00 Rome, delivery Fri 20 Nov (~90%); qty 1–20
  "sarah": { label: "Fabric banner 12 x 4 ft", before: 14700, after: 14700, deadline: new Date("2026-11-19T09:00:00+01:00").getTime(), closes: new Date("2026-11-19T09:00:00+01:00").getTime(), name: "Fabric banner 12 x 4 ft — 366 x 122 cm, polyester fabric, single sided full color, Night Shift, UPS delivery in Italy included" },
  // Rodolfo (vip-studio-rodolfo.html): photobook A4, 52 pages, cover 250gsm glossy, inside 170gsm, final price € 588 each (no ×1.6), UPS Italy included. Fast Track 3–4 wd, closes Sat 21 Nov 18:00 Rome, delivery Wed 25 – Thu 26 Nov; qty 1–20
  "rodolfo": { label: "Photobook A4, 52 pages", before: 58800, after: 58800, deadline: new Date("2026-11-21T18:00:00+01:00").getTime(), closes: new Date("2026-11-21T18:00:00+01:00").getTime(), name: "Photobook A4, 52 pages — cover 250gsm glossy, inside pages 170gsm, full color, Fast Track 3–4 working days, UPS delivery in Italy included" },
  // Photo poster (vip-studio-photo-poster.html): 60 x 90 cm glossy photo paper 220gsm, laminated, final price € 155 each, UPS to Rimini included. Fast Track, closes Thu 19 Nov 18:00 Rome, delivery Mon 23 Nov; qty 1–20
  "photoposter": { label: "Photo poster 60 x 90 cm", before: 15500, after: 15500, deadline: new Date("2026-11-19T18:00:00+01:00").getTime(), closes: new Date("2026-11-19T18:00:00+01:00").getTime(), name: "Photo poster 60 x 90 cm — glossy photo paper 220gsm, 6-colour pigment inks 2880 x 2880 dpi, protective lamination, Fast Track, UPS delivery to Rimini included" },
  "photopostermatt": { label: "Photo poster 60 x 90 cm, matt lamination", before: 17000, after: 17000, deadline: new Date("2026-11-19T18:00:00+01:00").getTime(), closes: new Date("2026-11-19T18:00:00+01:00").getTime(), name: "Photo poster 60 x 90 cm — glossy photo paper 220gsm, 6-colour pigment inks 2880 x 2880 dpi, matt lamination, Fast Track, UPS delivery to Rimini included" },
  // Test product for vip-studio-test.html — exactly € 1,00, no shipping, no deadline (not ×1.6)
  "test": { label: "Test product", before: 100, after: 100, deadline: 0, name: "Test product — payment check, nothing will be printed" },
  // A0 (vip-studio-a0.html), final price (no ×1.6): € 17 per poster + € 20 UPS shipping per order. Night Shift 1 wd, closes Mon 26 Oct 09:00 Rome, delivery Tue 27 Oct
  "a0": { label: "A0 poster, 180gsm", before: 1700, after: 1700, deadline: new Date("2026-10-26T09:00:00+01:00").getTime(), closes: new Date("2026-10-26T09:00:00+01:00").getTime(), name: "A0 poster — 84,1 x 118,9 cm, 180gsm paper" },
  // Malta (vip-studio-malta.html): € 128 ×1.6 = € 204,80, UPS to Malta included. Night Shift, closes Wed 28 Oct 09:00 Rome, delivery Fri 30 Oct
  "malta": { label: "300 folded leaflets, A4, matte ~170gsm", before: 20480, after: 20480, deadline: new Date("2026-10-28T09:00:00+01:00").getTime(), closes: new Date("2026-10-28T09:00:00+01:00").getTime(), name: "300 folded leaflets — A4, folded in the centre, matte ~170gsm, UPS delivery to Malta included" },
  // Malta 500 flyers A5 double sided: final price € 149 (no ×1.6), UPS to Malta included. Night Shift, closes Thu 29 Oct 09:00 Rome, delivery Fri 30 Oct (90%) / Mon 2 Nov (10%)
  "mtfly": { label: "500 flyers, A5, double sided full color", before: 14900, after: 14900, deadline: new Date("2026-10-29T09:00:00+01:00").getTime(), closes: new Date("2026-10-29T09:00:00+01:00").getTime(), name: "500 flyers — A5, double sided full color" },
  // Sroman (vip-studio-sroman.html): 125 conference programs A5, 8 pages, stapled. ×1.6 applied. Orders close Wed 4 Nov 09:00 Rome
  "sr10": { label: "Matte coated, 10 working days", before: 35040, after: 35040, deadline: 0, closes: new Date("2026-10-22T09:00:00+02:00").getTime(), name: "125 conference programs — A5, 8 pages, stapled, matte coating, double sided full color, production 10 working days" },
  // srn: Normal 7 wd until Tue 27 Oct 09:00, Fast Track 4 wd until Fri 30 Oct 09:00, Night Shift 1 wd until Wed 4 Nov 09:00 (delivery Fri 6 Nov)
  "srn": { label: "Not laminated", tiers: [[new Date("2026-10-27T09:00:00+01:00").getTime(), 12320, "Normal, 7 working days"], [new Date("2026-10-30T09:00:00+01:00").getTime(), 17440, "Fast Track, 4 working days"], [new Date("2026-11-04T09:00:00+01:00").getTime(), 20800, "Night Shift, 1 working day"]], closes: new Date("2026-11-04T09:00:00+01:00").getTime(), name: "125 conference programs — A5, 8 pages, stapled, not laminated, double sided full color" },
  // sra: 3 A3 posters, 3 copies of 1 file — (37 / 70 / 91) ×1.6 for the 3, same tiers as srn
  "sra": { label: "3 posters A3", tiers: [[new Date("2026-10-27T09:00:00+01:00").getTime(), 5920, "Normal, 7 working days"], [new Date("2026-10-30T09:00:00+01:00").getTime(), 11200, "Fast Track, 4 working days"], [new Date("2026-11-04T09:00:00+01:00").getTime(), 14560, "Night Shift, 1 working day"]], closes: new Date("2026-11-04T09:00:00+01:00").getTime(), name: "3 posters A3 — light foam board 5 mm, single sided full color, 3 copies of 1 file" },
  // srp: 3 A2 posters, light foam board 5 mm — 3 × (22 / 54 / 75) ×1.6, same tiers as srn
  "srp": { label: "3 posters A2", tiers: [[new Date("2026-10-27T09:00:00+01:00").getTime(), 10560, "Normal, 7 working days"], [new Date("2026-10-30T09:00:00+01:00").getTime(), 25920, "Fast Track, 4 working days"], [new Date("2026-11-04T09:00:00+01:00").getTime(), 36000, "Night Shift, 1 working day"]], closes: new Date("2026-11-04T09:00:00+01:00").getTime(), name: "3 posters A2 — light foam board 5 mm, single sided full color, 3 different files" },
  // Polonia (vip-studio-polonia.html): final prices (no ×1.6), selectable together (body.pl). Pick up Rome Mon 2 Nov, orders close 15:00
  "pol": { label: "Stickers", before: 28400, after: 28400, deadline: 0, closes: new Date("2026-11-02T15:00:00+01:00").getTime(), name: "Stickers — 1 big sticker contour cut (€ 74,00), 2 QR prints (2 × € 30,00), 2 black stickers (2 × € 75,00) — pick up in Rome" },
  "pold": { label: "Door name stickers", before: 2300, after: 2300, deadline: 0, closes: new Date("2026-11-02T15:00:00+01:00").getTime(), name: "Door name stickers — pick up in Rome" },
  "polp": { label: "Print 210x210 cm", before: 9000, after: 9000, deadline: 0, closes: new Date("2026-11-02T15:00:00+01:00").getTime(), name: "Print 210x210 cm — divided in 3 pieces of 70x210 cm — pick up in Rome" },
  "am8": { label: "production 8 working days", before: 54560, after: 54560, deadline: 0, name: "1 table cloth — 487x289,5cm, 100% polyester fabric 235 g/m², single sided full color, production 8 working days" },
  "am4": { label: "production 4 working days", before: 60160, after: 60160, deadline: 0, name: "1 table cloth — 487x289,5cm, 100% polyester fabric 235 g/m², single sided full color, production 4 working days" },
  "am2": { label: "Night Shift, production 2 working days", before: 65600, after: 65600, deadline: 0, name: "1 table cloth — 487x289,5cm, 100% polyester fabric 235 g/m², single sided full color, Night Shift, production 2 working days" }
};
// Rana offer (vip-studio-rana.html): itemised, cents. after = express price from deadline on.
const RANA = {
  roll: { name: "Rollup — 80/85x200cm · Aluminum frame with indestructible synthetic paper · single sided full color", before: 7000, after: null, deadline: new Date("2026-10-29T09:00:00+01:00").getTime(), max: 50 },
  pen70: { name: "70 personalised ballpoint pens — Push-button ballpoint pen with metal clip · plastic barrel, metal button, body and tip · photo print (CMYK) next to the clip, print area 58 x 6 mm · blue ink", before: 25694, after: null, deadline: new Date("2026-11-24T09:00:00+01:00").getTime(), max: 1 },
  pin70: { name: "70 personalised pins — ø 4 cm, full colour print with your artwork", before: 12374, after: 15731, deadline: new Date("2026-11-24T09:00:00+01:00").getTime(), closes: new Date("2026-11-30T09:00:00+01:00").getTime(), max: 1 },
  pin10: { name: "10 personalised pins — ø 4 cm, full colour print with your artwork", before: 5300, after: 8400, deadline: new Date("2026-11-24T09:00:00+01:00").getTime(), closes: new Date("2026-11-30T09:00:00+01:00").getTime(), max: 50 },
  post10: { name: "10 posters — 70 x 100 cm, full colour print with your artwork", before: 11600, after: 15000, deadline: new Date("2026-11-24T09:00:00+01:00").getTime(), closes: new Date("2026-11-30T09:00:00+01:00").getTime(), max: 1 },
  choc50: { name: "50 personalised chocolates — Single chocolate in flowpack · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls", before: 23041, tiers: [{"q":10,"p":5950,"name":"10 personalised chocolates — Single chocolate in flowpack · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":50,"p":23041,"name":"50 personalised chocolates — Single chocolate in flowpack · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":100,"p":39263,"name":"100 personalised chocolates — Single chocolate in flowpack · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":250,"p":89779,"name":"250 personalised chocolates — Single chocolate in flowpack · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":500,"p":169227,"name":"500 personalised chocolates — Single chocolate in flowpack · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":750,"p":241875,"name":"750 personalised chocolates — Single chocolate in flowpack · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":1000,"p":300298,"name":"1,000 personalised chocolates — Single chocolate in flowpack · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":2500,"p":707147,"name":"2,500 personalised chocolates — Single chocolate in flowpack · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"}], after: null, deadline: new Date("2026-11-16T09:00:00+01:00").getTime(), max: 1 },
  cbox30: { name: "30 gift boxes, 2 personalised chocolates each — Gift box with 2 chocolates · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls", before: 29218, tiers: [{"q":10,"p":11011,"name":"10 gift boxes, 2 personalised chocolates each — Gift box with 2 chocolates · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":30,"p":29218,"name":"30 gift boxes, 2 personalised chocolates each — Gift box with 2 chocolates · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":60,"p":55585,"name":"60 gift boxes, 2 personalised chocolates each — Gift box with 2 chocolates · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":100,"p":89259,"name":"100 gift boxes, 2 personalised chocolates each — Gift box with 2 chocolates · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":150,"p":129987,"name":"150 gift boxes, 2 personalised chocolates each — Gift box with 2 chocolates · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":200,"p":171318,"name":"200 gift boxes, 2 personalised chocolates each — Gift box with 2 chocolates · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":250,"p":210397,"name":"250 gift boxes, 2 personalised chocolates each — Gift box with 2 chocolates · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":500,"p":408433,"name":"500 gift boxes, 2 personalised chocolates each — Gift box with 2 chocolates · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"},{"q":1000,"p":802907,"name":"1,000 gift boxes, 2 personalised chocolates each — Gift box with 2 chocolates · digital print over the whole surface with your artwork, using food-grade colours subject to strict controls"}], after: null, deadline: new Date("2026-11-16T09:00:00+01:00").getTime(), max: 1 },
  hex: { name: "30 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)", before: 36485, tiers: [{"q":1,"p":7291,"name":"1 hexagonal gift box — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":5,"p":12571,"name":"5 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":10,"p":17246,"name":"10 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":15,"p":21784,"name":"15 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":20,"p":25955,"name":"20 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":25,"p":30275,"name":"25 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":30,"p":36485,"name":"30 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":40,"p":48149,"name":"40 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":50,"p":66933,"name":"50 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":100,"p":75376,"name":"100 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":250,"p":97952,"name":"250 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":500,"p":137466,"name":"500 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":1000,"p":216320,"name":"1,000 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":2500,"p":445707,"name":"2,500 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":5000,"p":814792,"name":"5,000 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":7500,"p":1191280,"name":"7,500 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"},{"q":10000,"p":1575096,"name":"10,000 hexagonal gift boxes — Hexagonal slot-together box, 13 x 4 cm (D x H) · 400gsm SBS board, matte coated outside · full colour print outside (4/0)"}], after: null, deadline: new Date("2026-11-17T09:00:00+01:00").getTime(), max: 1 },
  sq18: { name: "30 gift boxes with lid — Lid and base gift box, 18 x 18 x 18 cm · full colour print on the lid with your artwork", before: 59341, tiers: [{"q":10,"p":23034,"name":"10 gift boxes with lid — Lid and base gift box, 18 x 18 x 18 cm · full colour print on the lid with your artwork"},{"q":20,"p":41968,"name":"20 gift boxes with lid — Lid and base gift box, 18 x 18 x 18 cm · full colour print on the lid with your artwork"},{"q":30,"p":59341,"name":"30 gift boxes with lid — Lid and base gift box, 18 x 18 x 18 cm · full colour print on the lid with your artwork"}], after: null, deadline: new Date("2026-11-19T09:00:00+01:00").getTime(), max: 1 },
  nb: { name: "30 A5 hardcover notebooks — Hardcover notebook, DIN A5 (14.8 x 21 cm), portrait, bound on the left · inside: 100 pages, 80gsm white offset paper, unprinted, PUR perfect binding · cover: 130gsm gloss coated paper on 2.2 mm grey board, full colour print (4/0), matte lamination on the front · elastic band and ribbon bookmark in matching colour · digital print", before: 71250, tiers: [{"q":30,"p":71250,"name":"30 A5 hardcover notebooks — Hardcover notebook, DIN A5 (14.8 x 21 cm), portrait, bound on the left · inside: 100 pages, 80gsm white offset paper, unprinted, PUR perfect binding · cover: 130gsm gloss coated paper on 2.2 mm grey board, full colour print (4/0), matte lamination on the front · elastic band and ribbon bookmark in matching colour · digital print","a":82200},{"q":50,"p":76000,"name":"50 A5 hardcover notebooks — Hardcover notebook, DIN A5 (14.8 x 21 cm), portrait, bound on the left · inside: 100 pages, 80gsm white offset paper, unprinted, PUR perfect binding · cover: 130gsm gloss coated paper on 2.2 mm grey board, full colour print (4/0), matte lamination on the front · elastic band and ribbon bookmark in matching colour · digital print","a":87680}], after: 82200, deadline: new Date("2026-11-17T09:00:00+01:00").getTime(), closes: new Date("2026-11-23T09:00:00+01:00").getTime(), max: 50 },
  nbp: { name: "30 A5 faux-leather and fabric notebooks — DIN A5 notebook · cover: suede-look PU leather with fabric · inside: 192 lined pages · elastic band, pen holder and blue ribbon bookmark · digital print, full colour (4/0)", before: 45600, tiers: [{"q":30,"p":45600,"name":"30 A5 faux-leather and fabric notebooks — DIN A5 notebook · cover: suede-look PU leather with fabric · inside: 192 lined pages · elastic band, pen holder and blue ribbon bookmark · digital print, full colour (4/0)"},{"q":50,"p":48640,"name":"50 A5 faux-leather and fabric notebooks — DIN A5 notebook · cover: suede-look PU leather with fabric · inside: 192 lined pages · elastic band, pen holder and blue ribbon bookmark · digital print, full colour (4/0)"}], after: null, deadline: new Date("2026-11-19T09:00:00+01:00").getTime(), max: 50 },
  shop60: { name: "60 personalised cotton shoppers — Cotton shopper bag, 38 x 42 cm, long handles · natural colour · 1-colour print on one side", before: 36500, after: 36500, deadline: new Date("2026-11-23T09:00:00+01:00").getTime(), closes: new Date("2026-11-27T09:00:00+01:00").getTime(), max: 1 },
  bc250: { name: "6 x 250 business cards — 85x55mm, credit card size · 350gsm · double sided full color in offset", before: 22400, after: 28000, deadline: new Date("2026-10-20T09:00:00+02:00").getTime(), max: 1 },
  bc500: { name: "6 x 500 business cards — 85x55mm, credit card size · 350gsm · double sided full color in offset", before: 25300, after: 29900, deadline: new Date("2026-10-20T09:00:00+02:00").getTime(), max: 1 },
  br25: { name: "2,500 folded brochures — A4, open 63x29.7cm · 250gsm matte · double sided full color Offset", before: 83600, after: 104000, deadline: new Date("2026-10-21T09:00:00+02:00").getTime(), max: 1 },
  br25b: { name: "2,500 folded brochures (2nd design) — A4, open 63x29.7cm · 250gsm matte · double sided full color Offset", before: 83600, after: 104000, deadline: new Date("2026-10-21T09:00:00+02:00").getTime(), max: 1 },
  br50: { name: "5,000 folded brochures — A4, open 63x29.7cm · 250gsm matte · double sided full color Offset", before: 152800, after: 189200, deadline: new Date("2026-10-21T09:00:00+02:00").getTime(), max: 1 },
  env: { name: "2,500 DIN C6 (16,2 x 11,4 cm) envelopes — 80gsm · print full colour", before: 25600, after: null, max: 1 },
  wc: { name: "2.500 white cards A6 (15x10,5 cm) — turnaround time 7 working days", before: 13100, after: 18080, deadline: new Date("2026-10-21T09:00:00+02:00").getTime(), closes: new Date("2026-10-27T09:00:00+01:00").getTime(), max: 1 },
  // Serbia (vip-studio-serbia.html): 300 postcards, Fast Track until Tue 27 Oct 09:00, Night Shift until Thu 29 Oct 09:00
  pc: { name: "300 postcards — 300gsm matte · double sided full color", before: 11200, after: 14880, deadline: new Date("2026-10-27T09:00:00+01:00").getTime(), closes: new Date("2026-10-29T09:00:00+01:00").getTime(), max: 1 },
  pc40: { name: "40 postcards — 300gsm matte · double sided full color", before: 12480, after: 12480, deadline: new Date("2026-10-27T09:00:00+01:00").getTime(), closes: new Date("2026-10-29T09:00:00+01:00").getTime(), max: 1 },
  envg: { name: "2.500 white DIN C6 (16,2 x 11,4 cm) envelopes — glossy gold foil", before: 277700, after: null, max: 1 }
};
const ZONES = {
  rome_s: { label: "Same day Rome South / EUR / Center", amount: 0 },
  rome:   { label: "Same day rest of Rome", amount: 0 },
  it:     { label: "Italy (+1 day)", amount: 0 }
};
const SITE = "https://www.italianprintingcompany.com";

// Nexi XPay (Hosted Payment Page). Env vars: NEXI_API_KEY (Nexi back office → Terminals → API KEYS); NEXI_TEST=1 to use the sandbox.
const NEXI_BASE = () => process.env.NEXI_TEST === "1" ? "https://xpaysandbox.nexigroup.com/api/phoenix-0.0/psp/api/v1" : "https://xpay.nexigroup.com/api/phoenix-0.0/psp/api/v1";
async function nexiCheckout(res, lines, ref, email, page) {
  if (!process.env.NEXI_API_KEY) return res.status(500).json({ error: "Nexi is not configured" });
  const total = lines.reduce((t, x) => t + x.amount * (x.quantity || 1), 0);
  const AL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rnd = ""; for (let i = 0; i < 6; i++) rnd += AL[Math.floor(Math.random() * AL.length)];
  // orderId: max 18 characters, letters/digits only, new for every payment attempt
  const orderId = (ref.replace(/[^A-Za-z0-9]/g, "").slice(0, 12) + rnd).slice(0, 18);
  const order = {
    orderId, amount: String(total), currency: "EUR", customerId: ref.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 27) || undefined,
    description: lines.map(x => (x.quantity || 1) + "x " + x.name).join("; ").slice(0, 255),
    customField: ref.slice(0, 255)
  };
  if (email) order.customerInfo = { cardHolderEmail: email };
  const back = `${SITE}/${page}?paid=1&ref=${encodeURIComponent(ref)}&session_id=nx_${orderId}`;
  try {
    const r = await fetch(NEXI_BASE() + "/orders/hpp", {
      method: "POST",
      headers: { "X-Api-Key": process.env.NEXI_API_KEY, "Correlation-Id": require("crypto").randomUUID(), "Content-Type": "application/json" },
      body: JSON.stringify({ order, paymentSession: { actionType: "PAY", amount: String(total), language: "eng", resultUrl: back, cancelUrl: `${SITE}/${page}?canceled=1` } })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.hostedPage) {
      console.error("Nexi error:", r.status, JSON.stringify(d.errors || d));
      return res.status(502).json({ error: (d.errors && d.errors[0] && d.errors[0].description) || "Nexi request failed" });
    }
    return res.status(200).json({ url: d.hostedPage });
  } catch (e) {
    console.error("Nexi request failed:", e);
    return res.status(500).json({ error: "Nexi request failed" });
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const zone = ZONES[body.zone] || ZONES.it;
  let PRODUCTS, label;
  if (Array.isArray(body.sr) && body.sr.length) {
    // Sroman (vip-studio-sroman.html): conference programs, any combination
    PRODUCTS = [];
    for (const k of [...new Set(body.sr)].filter(x => x === "sr10" || x === "srn" || x === "srp" || x === "sra")) {
      const p = PAPERS[k];
      if (p.closes && Date.now() >= p.closes) return res.status(410).json({ error: "This offer has ended. Contact us for a new quote." });
      const t = p.tiers ? p.tiers.find(x => Date.now() < x[0]) : null;
      PRODUCTS.push(t ? { name: p.name + ", " + t[2], amount: t[1], quantity: 1 } : { name: p.name, amount: p.after, quantity: 1 });
    }
    if (!PRODUCTS.length) return res.status(400).json({ error: "No products selected." });
    label = PRODUCTS.map(x => x.name).join("; ").slice(0, 490);
  } else if (Array.isArray(body.pl) && body.pl.length) {
    // Polonia (vip-studio-polonia.html): any combination of pol, pold, polp
    PRODUCTS = [];
    for (const k of [...new Set(body.pl)].filter(x => x === "pol" || x === "pold" || x === "polp")) {
      const p = PAPERS[k];
      if (p.closes && Date.now() >= p.closes) return res.status(410).json({ error: "This offer has ended. Contact us for a new quote." });
      PRODUCTS.push({ name: p.name, amount: p.after, quantity: 1 });
    }
    if (!PRODUCTS.length) return res.status(400).json({ error: "No products selected." });
    label = PRODUCTS.map(x => x.name).join("; ").slice(0, 490);
  } else if (Array.isArray(body.mt) && body.mt.length) {
    // Malta (vip-studio-malta.html): 300 leaflets and/or 500 flyers, each with its own deadline
    PRODUCTS = [];
    for (const k of [...new Set(body.mt)].filter(x => x === "malta" || x === "mtfly")) {
      const p = PAPERS[k];
      if (p.closes && Date.now() >= p.closes) return res.status(410).json({ error: p.label + " is no longer available." });
      PRODUCTS.push({ name: p.name || p.label, amount: p.after, quantity: 1 });
    }
    if (!PRODUCTS.length) return res.status(400).json({ error: "No products selected." });
    label = PRODUCTS.map(x => x.name).join("; ").slice(0, 490);
  } else if (Array.isArray(body.cat) && body.cat.length) {
    // Cat (vip-studio-cat.html): magazines 20/28 pages and stickers 1.000/2.000, any combination
    PRODUCTS = [];
    for (const k of [...new Set(body.cat)].filter(x => x === "cat20" || x === "cat28" || x === "catst" || x === "catst2")) {
      const p = PAPERS[k];
      if (p.closes && Date.now() >= p.closes) return res.status(410).json({ error: "This offer has ended. Contact us for a new quote." });
      PRODUCTS.push({ name: p.name, amount: p.after, quantity: 1 });
    }
    if (!PRODUCTS.length) return res.status(400).json({ error: "No products selected." });
    label = PRODUCTS.map(x => x.name).join("; ").slice(0, 490);
  } else if (body.items && typeof body.items === "object") {
    PRODUCTS = [];
    for (const k of Object.keys(RANA)) {
      const r = RANA[k], q = Math.max(0, Math.min(r.max, parseInt(body.items[k], 10) || 0));
      if (!q) continue;
      // Constanza 2 (vip-studio-constanza-2.html): delivery Mon 30 Nov, so deadlines one working day earlier
      const c2 = String(body.page || "").includes("vip-studio-constanza-2");
      const C2 = { roll: { deadline: new Date("2026-11-25T09:00:00+01:00").getTime() }, pin70: { deadline: new Date("2026-11-23T09:00:00+01:00").getTime(), closes: new Date("2026-11-27T09:00:00+01:00").getTime() }, pin10: { deadline: new Date("2026-11-23T09:00:00+01:00").getTime(), closes: new Date("2026-11-27T09:00:00+01:00").getTime() }, post10: { deadline: new Date("2026-11-23T09:00:00+01:00").getTime(), closes: new Date("2026-11-27T09:00:00+01:00").getTime() } };
      const closes = c2 && C2[k] && C2[k].closes ? C2[k].closes : r.closes;
      if (closes && Date.now() >= closes) return res.status(410).json({ error: r.name + " is no longer available." });
      const noDl = k === "roll" && String(body.page || "").includes("vip-studio-rollup");
      const dl = c2 && C2[k] ? C2[k].deadline : k === "roll" && String(body.page || "").includes("vip-studio-constanza") ? new Date("2026-11-26T09:00:00+01:00").getTime() : r.deadline;
      const amount = !noDl && dl && Date.now() >= dl ? r.after : r.before;
      if (amount == null) return res.status(410).json({ error: r.name + " is no longer available." });
      const tier = r.tiers ? (r.tiers.find(t => t.q === parseInt((body.tiers || {})[k], 10)) || null) : null;
      if (r.tiers && !tier) return res.status(400).json({ error: "Please choose a quantity for " + r.name.split(" — ")[0] + "." });
      const tierAmt = tier ? (tier.a != null && !noDl && dl && Date.now() >= dl ? tier.a : tier.p) : amount;
      PRODUCTS.push({ name: tier ? tier.name : r.name, amount: tierAmt, quantity: q });
    }
    if (parseInt(body.items.fl, 10) > 0) {
      const A4T = { "130": { std: [5589, 7644, 9046, 11062], ft: [11244, 13301, 14701, 16717], ns: [14937, 16994, 18394, 20986] }, "170": { std: [7371, 9475, 11320, 14800], ft: [13026, 15130, 16975, 20455], ns: [16719, 18823, 20668, 24726] }, "250": { std: [5684, 9990, 12221, 15975], ft: [11341, 15645, 17876, 21630], ns: [15034, 19338, 21570, 25901] } };
      const QS4 = [100, 250, 500, 1000], SN4 = { std: "Standard, production 4–6 working days", ft: "Fast Track, production 2 working days", ns: "Night Shift, production 1 working day" };
      const fb = body.flyer || {}, fw = String(fb.w), fs = String(fb.s), fi = QS4.indexOf(parseInt(fb.q, 10));
      if (!A4T[fw] || !A4T[fw][fs] || fi < 0) return res.status(400).json({ error: "Please choose paper, quantity and speed for the flyers." });
      { // delivery must be by Mon 30 Nov 2026: working days from the Rome 09:00 cut-off, +1 safety day (same as the page)
        const pr = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date()).forEach(x => { pr[x.type] = x.value; });
        const wd = d => { const w = d.getUTCDay(); return w > 0 && w < 6 && d.toISOString().slice(0, 10) !== "2026-12-08"; };
        const add = (d, n) => { d = new Date(d); while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); if (wd(d)) n--; } return d; };
        let st = new Date(Date.UTC(+pr.year, +pr.month - 1, +pr.day)); if (!wd(st) || (+pr.hour % 24) >= 9) st = add(st, 1);
        const n = { std: 7, ft: 3, ns: 2 }[fs];
        if (add(add(st, n - 1), 1).getTime() > Date.UTC(2026, 10, 30)) return res.status(410).json({ error: "This flyer speed can no longer be delivered by 30 November. Please choose a faster option." });
      }
      PRODUCTS.push({ name: String(QS4[fi]).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " flyers — A4, " + fw + "gsm glossy paper, double sided full color, " + SN4[fs], amount: A4T[fw][fs][fi], quantity: 1 });
    }
    if (!PRODUCTS.length) return res.status(400).json({ error: "No products selected." });
    const rq = (PRODUCTS.find(x => x.name === RANA.roll.name) || {}).quantity || 0;
    if (rq > 0 && !body.pickup) PRODUCTS.push({ name: "Rollup delivery — UPS Priority (" + rq + (rq > 1 ? " rollups" : " rollup") + ")", amount: /vip-studio-(serbia|rollup|constanza)/.test(String(body.page || "")) ? 2000 + 1500 * (rq - 1) : 2000, quantity: 1 });
    label = PRODUCTS.map(x => x.quantity + "x " + x.name).join("; ").slice(0, 490);
  } else if (body.paper === "bc" && Array.isArray(body.bcs) && body.bcs.length && body.bcs.length <= 2) {
    // Business cards (vip-studio-business-cards.html): Strategic Prices (5515), Soft Touch (5517), Embossed (202); euros VAT included, from api/_pricing-data.js. One or two lines per order. Keep in sync with the page.
    const BCD = {"bc":{"f":[{"l":"Landscape 8.5 \u00d7 5.5 cm","q":[250,500,1000,2500,5000,7500,10000,15000,20000,25000,30000],"p":[{"g":300,"t":"300gsm coated paper","std":{"d":[4,6],"p":[37.73,50.0,56.25,68.25,101.09,131.81,160.45,215.43,263.15,324.3,364.98]},"ft":{"d":[2,2],"p":[98.77,107.46,115.31,130.54,163.39,194.12,222.75,277.73,325.48,428.95,469.62]},"ns":{"d":[1,1],"p":[141.58,150.43,164.83,186.74,226.62,257.98,293.58,349.72,404.83,513.04,573.66]}},{"g":400,"t":"400gsm coated paper","std":{"d":[5,7],"p":[52.29,56.8,62.07,75.0,111.05,145.57,178.75,241.31,316.95,389.3,455.72]},"ft":{"d":[2,2],"p":[113.34,117.88,123.12,137.3,173.34,207.86,241.08,303.61,421.64,493.95,560.38]}},{"g":500,"t":"500gsm coated paper","std":{"d":[7,9],"p":[50.85,55.1,61.22,74.1,104.16,133.91,165.67,221.91,279.26,340.38,391.48]}}]},{"l":"Portrait 5.5 \u00d7 8.5 cm","q":[250,500,1000,2500,5000,7500,10000,15000,20000,25000,30000],"p":[{"g":300,"t":"300gsm coated paper","std":{"d":[4,6],"p":[37.73,50.0,56.25,68.25,101.09,131.81,160.45,215.43,263.15,324.3,364.98]},"ft":{"d":[2,2],"p":[98.77,107.46,115.31,130.54,163.39,194.12,222.75,277.73,325.48,428.95,469.62]},"ns":{"d":[1,1],"p":[141.58,150.43,164.83,186.74,226.62,257.98,293.58,349.72,404.83,513.04,573.66]}},{"g":400,"t":"400gsm coated paper","std":{"d":[5,7],"p":[52.29,56.8,62.07,75.0,111.05,145.57,178.75,241.31,316.95,389.3,455.72]},"ft":{"d":[2,2],"p":[113.34,117.88,123.12,137.3,173.34,207.86,241.08,303.61,421.64,493.95,560.38]}},{"g":500,"t":"500gsm coated paper","std":{"d":[7,9],"p":[50.85,55.1,61.22,74.1,104.16,133.91,165.67,221.91,279.26,340.38,391.48]}}]},{"l":"Landscape 9 \u00d7 5 cm","q":[250,500,1000,2500,5000,7500,10000,15000,20000,25000,30000],"p":[{"g":300,"t":"300gsm coated paper","std":{"d":[4,6],"p":[48.7,53.75,57.5,65.0,93.16,122.44,148.09,197.07,236.31,293.16,330.53]},"ft":{"d":[2,2],"p":[109.75,112.75,117.24,126.25,155.47,184.76,210.38,259.38,298.61,397.81,435.17]},"ns":{"d":[1,1],"p":[152.76,155.84,166.77,182.31,218.52,248.41,280.96,330.99,377.4,481.26,538.49]}},{"g":400,"t":"400gsm coated paper","std":{"d":[5,7],"p":[51.59,56.25,60.9,73.25,108.04,141.4,173.41,237.65,312.76,366.05,424.61]}},{"g":500,"t":"500gsm coated paper","std":{"d":[7,9],"p":[50.85,55.1,61.22,74.1,104.16,133.91,165.67,221.91,279.26,340.38,391.48]}}]},{"l":"Portrait 5 \u00d7 9 cm","q":[250,500,1000,2500,5000,7500,10000,15000,20000,25000,30000],"p":[{"g":300,"t":"300gsm coated paper","std":{"d":[4,6],"p":[48.7,53.75,57.5,65.0,93.16,122.44,148.09,197.07,236.31,293.16,330.53]},"ft":{"d":[2,2],"p":[109.75,112.75,117.24,126.25,155.47,184.76,210.38,259.38,298.61,397.81,435.17]},"ns":{"d":[1,1],"p":[152.76,155.84,166.77,182.31,218.52,248.41,280.96,330.99,377.4,481.26,538.49]}},{"g":400,"t":"400gsm coated paper","std":{"d":[5,7],"p":[51.59,56.25,60.9,73.25,108.04,141.4,173.41,237.65,312.76,366.05,424.61]}},{"g":500,"t":"500gsm coated paper","std":{"d":[7,9],"p":[50.85,55.1,61.22,74.1,104.16,133.91,165.67,221.91,279.26,340.38,391.48]}}]},{"l":"Square 5.5 \u00d7 5.5 cm","q":[250,500,1000,2500,5000,7500,10000,15000,20000,25000,30000],"p":[{"g":300,"t":"300gsm coated paper","std":{"d":[4,6],"p":[43.67,51.25,51.25,56.25,72.0,92.35,111.51,146.2,177.44,207.65,230.82]},"ft":{"d":[2,2],"p":[104.72,105.97,107.31,113.77,134.32,154.65,173.8,208.5,239.72,269.94,293.11]},"ns":{"d":[1,1],"p":[147.65,148.91,156.62,169.6,196.94,217.7,243.61,279.04,317.3,348.14,390.89]}},{"g":400,"t":"400gsm coated paper","std":{"d":[5,7],"p":[45.55,51.25,53.75,61.25,82.3,106.82,130.9,178.39,217.89,277.6,315.89]}},{"g":500,"t":"500gsm coated paper","std":{"d":[7,9],"p":[50.85,55.1,61.22,74.1,104.16,133.91,165.67,221.91,279.26,340.38,391.48]}}]}]},"st":{"f":[{"l":"Landscape 8.5 \u00d7 5.5 cm","q":[500,1000,2500,5000,10000,15000,20000],"p":[{"g":300,"t":"300gsm matt coated paper","std":{"d":[5,7],"p":[75.82,97.93,142.01,201.71,326.2,448.81,586.59]}},{"g":400,"t":"400gsm matt coated paper","std":{"d":[5,7],"p":[94.11,123.16,167.4,216.18,341.44,494.01,666.96]}},{"g":500,"t":"500gsm matt coated paper","std":{"d":[7,9],"p":[187.11,266.31,533.12,981.91,1877.74,2802.74,3646.0]}}]},{"l":"Portrait 5.5 \u00d7 8.5 cm","q":[500,1000,2500,5000,10000,15000,20000],"p":[{"g":300,"t":"300gsm matt coated paper","std":{"d":[5,7],"p":[75.82,97.93,142.01,201.71,326.2,448.81,586.59]}},{"g":400,"t":"400gsm matt coated paper","std":{"d":[5,7],"p":[94.11,123.16,167.4,216.18,341.44,494.01,666.96]}},{"g":500,"t":"500gsm matt coated paper","std":{"d":[7,9],"p":[187.11,266.31,533.12,981.91,1877.74,2802.74,3646.0]}}]},{"l":"Landscape 9 \u00d7 5 cm","q":[500,1000,2500,5000,10000,15000,20000],"p":[{"g":300,"t":"300gsm matt coated paper","std":{"d":[5,7],"p":[74.33,95.55,138.03,195.51,320.69,433.55,566.86]}},{"g":400,"t":"400gsm matt coated paper","std":{"d":[5,7],"p":[92.05,119.96,162.5,213.38,330.25,477.51,645.19]}},{"g":500,"t":"500gsm matt coated paper","std":{"d":[7,9],"p":[136.79,197.44,358.31,659.62,1249.25,1830.11,2444.49]}}]},{"l":"Portrait 5 \u00d7 9 cm","q":[500,1000,2500,5000,10000,15000,20000],"p":[{"g":300,"t":"300gsm matt coated paper","std":{"d":[5,7],"p":[74.33,95.55,138.03,195.51,320.69,433.55,566.86]}},{"g":400,"t":"400gsm matt coated paper","std":{"d":[5,7],"p":[92.05,119.96,162.5,213.38,330.25,477.51,645.19]}},{"g":500,"t":"500gsm matt coated paper","std":{"d":[7,9],"p":[136.79,197.44,358.31,659.62,1249.25,1830.11,2444.49]}}]},{"l":"Square 5.5 \u00d7 5.5 cm","q":[500,1000,2500,5000,10000,15000,20000],"p":[{"g":300,"t":"300gsm matt coated paper","std":{"d":[5,7],"p":[61.08,75.55,103.1,146.26,230.79,313.91,379.95]}},{"g":400,"t":"400gsm matt coated paper","std":{"d":[5,7],"p":[74.0,92.88,122.22,159.03,243.74,334.3,433.11]}},{"g":500,"t":"500gsm matt coated paper","std":{"d":[7,9],"p":[187.11,266.31,533.12,981.91,1877.74,2802.74,3646.0]}}]}]},"em":{"f":[{"l":"Landscape 8.5 \u00d7 5.5 cm","q":[100,250,500,1000,2500,5000,7500,10000,15000,20000],"p":[{"g":300,"t":"300gsm matt coated paper","std":{"d":[5,7],"p":[87.97,106.48,136.21,153.09,259.92,417.74,587.62,762.04,1112.67,1456.4]}},{"g":400,"t":"400gsm matt coated paper","std":{"d":[5,7],"p":[92.44,110.22,130.76,177.18,321.29,566.23,807.79,1054.48,1535.36,2039.09]}},{"g":500,"t":"500gsm matt coated paper","std":{"d":[5,7],"p":[102.9,136.56,178.27,274.17,570.37,1071.21,1566.34,2066.32,3062.84,4021.39]}},{"g":350,"t":"350gsm SBS board, matt","std":{"d":[5,7],"p":[93.89,114.86,151.18,194.19,369.42,618.69,887.94,1159.12,1709.1,2257.81]}}]},{"l":"Portrait 5.5 \u00d7 8.5 cm","q":[100,250,500,1000,2500,5000,7500,10000,15000,20000],"p":[{"g":300,"t":"300gsm matt coated paper","std":{"d":[5,7],"p":[87.97,106.48,136.21,153.09,259.92,417.74,587.62,762.04,1112.67,1456.4]}},{"g":400,"t":"400gsm matt coated paper","std":{"d":[5,7],"p":[92.44,110.22,130.76,177.18,321.29,566.23,807.79,1054.48,1535.36,2039.09]}},{"g":500,"t":"500gsm matt coated paper","std":{"d":[5,7],"p":[102.9,136.56,178.27,274.17,570.37,1071.21,1566.34,2066.32,3062.84,4021.39]}},{"g":350,"t":"350gsm SBS board, matt","std":{"d":[5,7],"p":[93.89,114.86,151.18,194.19,369.42,618.69,887.94,1159.12,1709.1,2257.81]}}]},{"l":"Landscape 9 \u00d7 5 cm","q":[250,500,1000,2500,5000,7500,10000],"p":[{"g":350,"t":"350gsm offset paper","std":{"d":[5,7],"p":[115.67,140.15,175.81,289.22,468.47,657.96,876.13]}}]},{"l":"Portrait 5 \u00d7 9 cm","q":[250,500,1000,2500,5000,7500,10000],"p":[{"g":350,"t":"350gsm offset paper","std":{"d":[5,7],"p":[115.67,140.15,175.81,289.22,468.47,657.96,876.13]}}]},{"l":"Square 5.5 \u00d7 5.5 cm","q":[250,500,1000,2500,5000,7500,10000],"p":[{"g":350,"t":"350gsm offset paper","std":{"d":[5,7],"p":[115.67,140.15,175.81,289.22,468.47,657.96,876.13]}}]}]}};
    const SNB0 = { std: "Standard", ft: "Fast Track", ns: "Night Shift" };
    const DESC = { bc: "double sided full color", st: "double sided full color, soft-touch finish", em: "double sided full color, relief (embossed) finish on one side" };
    PRODUCTS = []; const labels = [], seen = {};
    for (const it of body.bcs) {
      const pr = BCD[String(it && it.pr)], fx = parseInt(it && it.f, 10), sp = String(it && it.s);
      const fo = pr && pr.f[fx], po = fo && fo.p.find(x => x.g === parseInt(it.w, 10)), qx = fo ? fo.q.indexOf(parseInt(it.q, 10)) : -1;
      if (!po || !po[sp] || qx < 0 || !(po[sp].p[qx] > 0) || seen[it.pr]) return res.status(400).json({ error: "Please choose size, quantity, paper and speed." });
      seen[it.pr] = 1;
      const qn = String(fo.q[qx]).replace(/\B(?=(\d{3})+(?!\d))/g, "."), dd = po[sp].d;
      const sn = SNB0[sp] + ", production " + (dd[0] === dd[1] ? dd[0] + " working day" + (dd[0] > 1 ? "s" : "") : dd[0] + "–" + dd[1] + " working days");
      PRODUCTS.push({ name: qn + " business cards — " + fo.l + ", " + po.t + ", " + DESC[it.pr] + ", " + sn, amount: Math.round(po[sp].p[qx] * 100), quantity: 1 });
      labels.push(qn + " business cards, " + po.g + "gsm, " + SNB0[sp]);
    }
    if (!PRODUCTS.length) return res.status(400).json({ error: "No products selected." });
    label = labels.join("; ").slice(0, 490);
  } else if (body.paper === "a4f") {
    // A4 flyers (vip-studio-a4-flyers.html): Flyeralarm price IVA escl. × 1.6 × 1.22, cents. Rolling 09:00 cut-off, never closes. Keep in sync with the page.
    const A4F = { "130": { std: [5589, 7644, 9046, 11062], ft: [11244, 13301, 14701, 16717], ns: [14937, 16994, 18394, 20986] }, "170": { std: [7371, 9475, 11320, 14800], ft: [13026, 15130, 16975, 20455], ns: [16719, 18823, 20668, 24726] }, "250": { std: [5684, 9990, 12221, 15975], ft: [11341, 15645, 17876, 21630], ns: [15034, 19338, 21570, 25901] } };
    const QS = [100, 250, 500, 1000], SN = { std: "Standard, production 4–6 working days", ft: "Fast Track, production 2 working days", ns: "Night Shift, production 1 working day" };
    const w = String(body.w), sp = String(body.s), qi = QS.indexOf(parseInt(body.q, 10));
    if (!A4F[w] || !A4F[w][sp] || qi < 0) return res.status(400).json({ error: "Please choose quantity, paper and speed." });
    const qn = String(QS[qi]).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    PRODUCTS = [{ name: qn + " flyers — A4, " + w + "gsm glossy paper, double sided full color, " + SN[sp], amount: A4F[w][sp][qi], quantity: 1 }];
    label = qn + " A4 flyers, " + w + "gsm glossy, " + SN[sp].split(",")[0];
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
    if (body.paper === "a0") { const aq = Math.max(1, Math.min(50, parseInt(body.qty, 10) || 1)); PRODUCTS[0].quantity = aq; label = aq + "x A0 poster, 180gsm"; PRODUCTS.push({ name: "UPS shipping", amount: 2000, quantity: 1 }); }
    if (/^pst[27]b?$/.test(body.paper)) { const pq = Math.max(1, Math.min(20, parseInt(body.qty, 10) || 1)); PRODUCTS[0].quantity = pq; label = pq + "x 50 A2 posters, " + paper.label; }
    if (body.paper === "photoposter" || body.paper === "photopostermatt") { const xq = Math.max(1, Math.min(20, parseInt(body.qty, 10) || 1)); PRODUCTS[0].quantity = xq; label = xq + "x photo poster 60 x 90 cm" + (body.paper === "photopostermatt" ? ", matt lamination" : ""); }
    if (body.paper === "rodolfo") { const rq = Math.max(1, Math.min(20, parseInt(body.qty, 10) || 1)); PRODUCTS[0].quantity = rq; label = rq + "x photobook A4, 52 pages"; }
    if (body.paper === "sarah") { const sq = Math.max(1, Math.min(20, parseInt(body.qty, 10) || 1)); PRODUCTS[0].quantity = sq; label = sq + "x fabric banner 12 x 4 ft"; }
    if (body.paper === "mk") PRODUCTS.push({ name: "UPS shipping to Madrid", amount: 5600, quantity: 1 });
  }
  const ref = String(body.ref || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  const email = String(body.email || "").slice(0, 200);
  const page = /^vip-studio[a-z0-9-]*\.html$/.test(String(body.page || "")) ? body.page : "vip-studio.html";

  if (body.provider === "nexi") return nexiCheckout(res, zone.amount > 0 ? PRODUCTS.concat([{ name: "Shipping — " + zone.label, amount: zone.amount, quantity: 1 }]) : PRODUCTS, ref, email, page);

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
  p.append("success_url", `${SITE}/${page}?paid=1&ref=${encodeURIComponent(ref)}&session_id={CHECKOUT_SESSION_ID}`);
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
