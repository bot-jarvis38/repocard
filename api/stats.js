// Read-only funnel counts, served from inside the Vercel runtime (where the
// Blob token resolves). Lets us measure signups/paid-intent headlessly via curl.
// Returns counts only — never email addresses.
module.exports = async (req, res) => {
  const out = { paid_intent: 0, subscribers: 0, total: 0, store: "none" };
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { list } = require("@vercel/blob");
      let cursor;
      const blobs = [];
      do {
        const r = await list({ token: process.env.BLOB_READ_WRITE_TOKEN, cursor, limit: 1000 });
        blobs.push(...r.blobs);
        cursor = r.cursor;
      } while (cursor);
      out.paid_intent = blobs.filter((b) => b.pathname.startsWith("paid-intent/")).length;
      out.subscribers = blobs.filter((b) => b.pathname.startsWith("subscribers/")).length;
      out.total = blobs.length;
      out.store = "blob";
    } catch (e) {
      out.error = (e && e.message) || "list failed";
    }
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(out);
};
