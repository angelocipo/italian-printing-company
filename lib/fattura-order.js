// VIP Studio order -> FatturaPA XML draft (TD01) to import in Aruba (Fatture -> Carica/Importa XML).
// Same builder as the other site. The number is left as BOZZA-<ref>: set the real n/2026 in Aruba,
// since both sites share one invoice sequence. Stripe amounts are VAT-inclusive (22%).
const { buildFatturaPAXml } = require("./fattura-xml");

const SELLER = {
  name: "Printing Italy di Angelo Cipolla", vatNumber: "02452700590",
  address: "Via Lorenzo Bonincontri 26", cap: "00147", city: "Roma", province: "RM", regimeFiscale: "RF01",
};

const COUNTRIES = { italy: "IT", italia: "IT", "united kingdom": "GB", uk: "GB", england: "GB", "great britain": "GB", "united states": "US", usa: "US", us: "US", france: "FR", germany: "DE", deutschland: "DE", spain: "ES", "españa": "ES", netherlands: "NL", holland: "NL", belgium: "BE", switzerland: "CH", austria: "AT", portugal: "PT", ireland: "IE", sweden: "SE", denmark: "DK", norway: "NO", finland: "FI", poland: "PL", greece: "GR", canada: "CA", australia: "AU", japan: "JP", china: "CN", india: "IN", brazil: "BR", mexico: "MX", "united arab emirates": "AE", uae: "AE", "saudi arabia": "SA", qatar: "QA", bahrain: "BH", kuwait: "KW", israel: "IL", turkey: "TR", russia: "RU", "south korea": "KR", korea: "KR", singapore: "SG", "hong kong": "HK", "south africa": "ZA", luxembourg: "LU", monaco: "MC", "san marino": "SM" };
function iso(country, fallback) {
  const c = String(country || "").trim();
  if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  return COUNTRIES[c.toLowerCase()] || (fallback || "").toUpperCase() || c;
}

// d = { ref, total (cents), lines: [{ name, qty, amount (cents) }] }, s = Stripe session, f = page form fields
function fatturaFromOrder(d, s, f) {
  const cd = (s && s.customer_details) || {};
  const ca = cd.address || {};
  const country = iso(f.country, ca.country) || "IT";
  let city = String(f.city || ca.city || "").trim(), province = "";
  const m = / \(?([A-Z]{2})\)?$/.exec(city);
  if (country === "IT" && m) { province = m[1]; city = city.slice(0, m.index).trim(); }
  if (country === "IT" && !province && ca.state && /^[A-Z]{2}$/.test(ca.state)) province = ca.state;
  const sdiPec = String(f.sdi || "").trim();
  const customer = {
    type: f.company ? "azienda" : "privato",
    name: f.name || cd.name || "", company: f.company || "", vat: f.vat || "", cf: "",
    pec: sdiPec.includes("@") ? sdiPec : "", sdi: sdiPec.includes("@") ? "" : sdiPec,
    address: f.billing || [ca.line1, ca.line2].filter(Boolean).join(" ") || "-",
    cap: f.postcode || ca.postal_code || "", city: city || "-", province, country,
  };
  const ref = String(d.ref || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const progressivo = (ref.slice(-5) || "00001").padStart(5, "0");
  const { xml, warnings } = buildFatturaPAXml({
    invoiceNumber: "BOZZA-" + ref.slice(0, 14), progressivo, ref: d.ref, date: new Date(),
    totalCents: d.total, customer,
    lines: d.lines.map(l => ({ description: l.name, quantity: l.qty || 1, unitPrice: l.amount / 100 / (l.qty || 1), vatRate: 22 })),
  }, SELLER);
  warnings.unshift("Numero fattura da assegnare in Aruba (continua la numerazione 2026)");
  if (!f.name && !f.company && !f.vat && !f.billing) warnings.push("Dati fattura non ancora compilati dal cliente: completa in Aruba");
  return { filename: "IT" + SELLER.vatNumber + "_" + progressivo + ".xml", xml, warnings };
}

module.exports = { fatturaFromOrder };
