// POST /api/upload-url
// Body: { entryId, sector, valueChain, fileName, contentType, size }
// Returns a short-lived presigned URL the browser uses to PUT the file straight into S3.
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, BUCKET, MAX_FILE_MB, checkConfig, checkAuth, slug, safeFileName, validId, cleanText } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!checkConfig(res) || !checkAuth(req, res)) return;

  const { entryId, sector, valueChain, fileName, contentType, size } = req.body || {};
  if (!validId(entryId)) return res.status(400).json({ error: "Invalid entry id" });
  if (!cleanText(sector) || !cleanText(valueChain)) return res.status(400).json({ error: "Sector and value chain are required" });
  if (!fileName) return res.status(400).json({ error: "File name is required" });
  if (Number(size) > MAX_FILE_MB * 1024 * 1024) {
    return res.status(400).json({ error: `File is larger than ${MAX_FILE_MB} MB` });
  }

  const key = `documents/${slug(sector)}/${slug(valueChain)}/${entryId}/${safeFileName(fileName)}`;
  const type = cleanText(contentType, 200) || "application/octet-stream";

  try {
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: type }),
      { expiresIn: 900 } // 15 minutes
    );
    res.status(200).json({ url, key, contentType: type });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create upload URL: " + err.message });
  }
}
