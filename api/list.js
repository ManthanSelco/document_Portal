// GET /api/list
// Returns every saved submission, newest first, with 1-hour links to open each file.
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, BUCKET, checkConfig, checkAuth } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!checkConfig(res) || !checkAuth(req, res)) return;

  try {
    const keys = [];
    let token;
    do {
      const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "metadata/", ContinuationToken: token }));
      for (const o of out.Contents || []) if (o.Key.endsWith(".json")) keys.push(o.Key);
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);

    const entries = await Promise.all(
      keys.map(async (key) => {
        try {
          const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
          const entry = JSON.parse(await obj.Body.transformToString());
          entry.files = await Promise.all(
            (entry.files || []).map(async (f) => ({
              ...f,
              url: await getSignedUrl(
                s3,
                new GetObjectCommand({
                  Bucket: BUCKET,
                  Key: f.key,
                  ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(f.name || "file")}`,
                }),
                { expiresIn: 3600 }
              ),
            }))
          );
          return entry;
        } catch (e) {
          console.error("Skipping", key, e.message);
          return null;
        }
      })
    );

    const list = entries.filter(Boolean).sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ entries: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load documents: " + err.message });
  }
}
