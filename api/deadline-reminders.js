// Vercel Cron (see vercel.json "crons"): runs daily at 07:00 UTC and emails Angelo about
// every VIP Studio deadline that falls 12–36 hours from now ("1 day prior").
// Deadlines are read from create-checkout-session.js, so they stay in sync.
const { PAPERS, RANA, DEADLINE } = require("./create-checkout-session.js");
const SITE = "https://www.italianprintingcompany.com";
const TO = "info@italianprintingcompany.com";
const rome = (t) => new Date(t).toLocaleString("en-GB", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function events() {
  const ev = [];
  const add = (t, page, what) => { if (t) ev.push({ t, page, what }); };
  for (const k of ["170", "170g", "250", "250g"]) {
    const p = PAPERS[k];
    if (!p) continue;
    ["vip-studio.html", "vip-studio-ruchira.html"].forEach(pg => add(DEADLINE, pg, p.label + ": Fast Track price ends" + (p.after == null ? " (not available after)" : ", Night Shift price applies")));
  }
  for (const k of ["mag", "m170"]) {
    const p = PAPERS[k];
    if (!p) continue;
    add(p.deadline, "vip-studio-martina.html", "Magazines, " + p.label + ": Fast Track price ends, Night Shift price applies");
    add(p.closes, "vip-studio-martina.html", "Magazines, " + p.label + ": Night Shift ends, offer closes");
  }
  if (PAPERS.mk) {
    add(PAPERS.mk.closes, "vip-studio-mark.html", "100 bifold, 170gsm matte: Night Shift ends, offer closes");
  }
  if (PAPERS.cat20) add(PAPERS.cat20.closes, "vip-studio-cat.html", "500 magazines A5 (20 and 28 pages) and stickers (1.000 / 2.000): Night Shift ends, offer closes");
  if (PAPERS.arina) { add(PAPERS.arina.deadline, "vip-studio-arina.html", "50 magazines, 24 pages A4: Standard price ends, Express price applies"); add(PAPERS.arina.closes, "vip-studio-arina.html", "50 magazines, 24 pages A4: Express ends, offer closes"); }
  if (PAPERS.karl) {
    add(PAPERS.karl.deadline, "vip-studio-karl.html", "5,000 A4 flyers, 130gsm: Standard price ends, Fast Track price applies");
    add(PAPERS.karl.closes, "vip-studio-karl.html", "5,000 A4 flyers, 130gsm: Fast Track ends, offer closes");
  }
  for (const k of Object.keys(RANA)) {
    const r = RANA[k];
    if (r.after != null) add(r.deadline, "vip-studio-rana.html", r.name + ": price ends, express price applies");
    else add(r.deadline, "vip-studio-rana.html", r.name + ": offer closes");
    add(r.closes, "vip-studio-rana.html", r.name + ": express price ends, offer closes");
  }
  return ev;
}

module.exports = async (req, res) => {
  if (process.env.CRON_SECRET && req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).end();
  const now = Date.now(), from = now + 12 * 3600e3, to = now + 36 * 3600e3;
  const due = events().filter(e => e.t > from && e.t <= to).sort((a, b) => a.t - b.t);
  if (!due.length) return res.status(200).json({ sent: 0 });
  const byPage = {};
  due.forEach(e => (byPage[e.page] = byPage[e.page] || []).push(e));
  const body = Object.keys(byPage).map(pg =>
    SITE + "/" + pg + "\n" + byPage[pg].map(e => "  • " + rome(e.t) + " (Rome) — " + e.what).join("\n")
  ).join("\n\n");
  const r = await fetch("https://formsubmit.co/ajax/" + TO, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Origin: SITE, Referer: SITE + "/" },
    body: JSON.stringify({
      _subject: "VIP deadline tomorrow — contact your client (" + due.length + ")",
      _template: "box", _captcha: "false",
      message: "These VIP Studio deadlines expire in about 1 day:\n\n" + body + "\n\nContact the client before the time runs out."
    })
  });
  return res.status(200).json({ sent: due.length, formsubmit: r.status });
};
