// Lightweight funnel beacon: records a pageview or card-generation event as a
// blob under views/ so we can tell "no traffic" apart from "traffic, no convert".
// Counts only; emails/PII never touched here.
module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  if (!body || typeof body !== "object") body = {};

  const kind = (body.kind || "").toString() === "generate" ? "generate" : "pageview";
  const repo = (body.repo || "").toString().slice(0, 120);
  const record = { kind, repo, ts: new Date().toISOString() };

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = require("@vercel/blob");
      const key = "views/" + kind + "-" + record.ts.replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 8) + ".json";
      await put(key, JSON.stringify(record), { access: "public", contentType: "application/json", addRandomSuffix: false });
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true });
      return;
    } catch (e) { /* fall through */ }
  }
  res.status(200).json({ ok: true, store: "noop" });
};
