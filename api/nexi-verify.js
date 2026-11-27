// Verifies the Nexi XPay "Pagamento semplice" return: the MAC proves Nexi signed the result.
// GET /api/nexi-verify?<all query params Nexi sent back to the return page>
// Env vars: NEXI_MAC_KEY.
const crypto = require("crypto");
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const q = req.query || {};
  const key = process.env.NEXI_MAC_KEY;
  if (!key) return res.status(500).json({ ok: false, error: "Nexi is not configured" });
  const s = (k) => String(q[k] == null ? "" : q[k]);
  if (!s("mac") || !s("codTrans")) return res.status(400).json({ ok: false, error: "Missing Nexi parameters" });
  const str = "codTrans=" + s("codTrans") + "esito=" + s("esito") + "importo=" + s("importo") + "divisa=" + s("divisa") + "data=" + s("data") + "orario=" + s("orario") + "codAut=" + s("codAut") + key;
  const expect = crypto.createHash("sha1").update(str).digest("hex");
  const given = s("mac").toLowerCase();
  const macOk = expect.length === given.length && crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(given));
  return res.status(200).json({ ok: macOk && s("esito") === "OK", macValid: macOk, esito: s("esito"), codTrans: s("codTrans"), importo: s("importo"), codAut: s("codAut") });
};
