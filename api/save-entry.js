// POST /api/save-entry
// Saves the form details for one submission as JSON in S3:
//   metadata/<entryId>.json                           (used by the portal to list documents)
//   documents/<sector>/<value-chain>/<entryId>/_details.json  (handy when browsing the bucket)
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET, checkConfig, checkAuth, slug, validId, cleanText } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!checkConfig(res) || !checkAuth(req, res)) return;

  const b = req.body || {};
  if (!validId(b.id)) return res.status(400).json({ error: "Invalid entry id" });

  const entry = {
    id: b.id,
    name: cleanText(b.name, 300),
    sector: cleanText(b.sector, 120),
    valueChain: cleanText(b.valueChain, 120),
    documentType: cleanText(b.documentType, 120),
    documentDate: cleanText(b.documentDate, 20),
    description: cleanText(b.description, 5000),
    uploadedAt: new Date().toISOString(),
    files: [],
  };
  if (!entry.name || !entry.sector || !entry.valueChain || !entry.documentType) {
    return res.status(400).json({ error: "Name, sector, value chain and document type are required" });
  }

  const folder = `documents/${slug(entry.sector)}/${slug(entry.valueChain)}/${entry.id}/`;
  const files = Array.isArray(b.files) ? b.files : [];
  for (const f of files) {
    if (typeof f?.key !== "string" || !f.key.startsWith(folder)) {
      return res.status(400).json({ error: "File does not belong to this entry" });
    }
    entry.files.push({
      key: f.key,
      name: cleanText(f.name, 300),
      size: Number(f.size) || 0,
      type: cleanText(f.type, 200),
    });
  }
  if (!entry.files.length) return res.status(400).json({ error: "At least one file is required" });

  const body = JSON.stringify(entry, null, 2);
  try {
    await Promise.all([
      s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: `metadata/${entry.id}.json`, Body: body, ContentType: "application/json" })),
      s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: `${folder}_details.json`, Body: body, ContentType: "application/json" })),
    ]);
    res.status(200).json({ ok: true, entry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save details: " + err.message });
  }
}
