// Serverless function: capture email signups.
// Persistence strategy:
//   1) If a Vercel Blob store is linked (BLOB_READ_WRITE_TOKEN present), each
//      signup is written as its own blob under subscribers/ (no race conditions).
//   2) Otherwise, fall back to console.log so the end-to-end UI flow still works
//      and signups are visible in `vercel logs`.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Body may already be parsed by Vercel, or arrive as a raw string.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { body = {}; }
  }
  if (!body || typeof body !== "object") body = {};

  const email = (body.email || "").toString().trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Invalid email address." });
    return;
  }

  // "paid" = clicked the $7 unlock CTA (willingness-to-pay signal); else a plain notify signup.
  const intent = (body.intent || "").toString() === "paid" ? "paid" : "notify";
  const repo = (body.repo || "").toString().slice(0, 200);

  const record = {
    email,
    intent,
    repo,
    ts: new Date().toISOString(),
    ua: (req.headers["user-agent"] || "").slice(0, 200),
  };

  // Strategy 1: Vercel Blob (persistent, headless-readable).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = require("@vercel/blob");
      const prefix = intent === "paid" ? "paid-intent/" : "subscribers/";
      const key = prefix + record.ts.replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 8) + ".json";
      await put(key, JSON.stringify(record), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
      });
      res.status(200).json({ ok: true, store: "blob" });
      return;
    } catch (e) {
      console.log("REPOCARD_BLOB_ERROR", e && e.message);
      // fall through to logging
    }
  }

  // Strategy 2: log fallback (visible in `vercel logs`).
  console.log("REPOCARD_SIGNUP " + JSON.stringify(record));
  res.status(200).json({ ok: true, store: "log" });
};
