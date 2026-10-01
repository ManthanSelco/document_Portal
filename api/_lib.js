// Shared helpers for the API routes. Files starting with "_" are not exposed as routes by Vercel.
import { S3Client } from "@aws-sdk/client-s3";

// Credentials are read automatically from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.
// Checksum settings: newer SDK versions add checksum params to presigned PUT URLs,
// which breaks plain browser uploads. "WHEN_REQUIRED" turns that off.
// S3_ENDPOINT is only for local testing against an S3-compatible server; leave it empty for real AWS.
export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
});

export const BUCKET = process.env.S3_BUCKET;
export const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 100);

export function checkConfig(res) {
  if (!BUCKET || !process.env.AWS_REGION) {
    res.status(500).json({ error: "Server not configured: set S3_BUCKET and AWS_REGION in Vercel environment variables." });
    return false;
  }
  return true;
}

// Optional shared passcode. If PORTAL_PASSCODE is set, every request must send it.
export function checkAuth(req, res) {
  const pass = process.env.PORTAL_PASSCODE;
  if (!pass) return true;
  if (req.headers["x-portal-passcode"] === pass) return true;
  res.status(401).json({ error: "Passcode required" });
  return false;
}

export function slug(value) {
  const s = String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "other";
}

export function safeFileName(name) {
  const clean = String(name || "file")
    .normalize("NFKD")
    .replace(/[^\w.\- ()]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-150);
  return clean || "file";
}

export function validId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(id);
}

export function cleanText(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}
