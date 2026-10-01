// Local test server: `npm run dev` → http://localhost:3000
// Serves index.html and runs the same api/*.js handlers Vercel uses. Not needed for deployment.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

// Load .env (simple KEY=value lines)
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const PORT = Number(process.env.PORT || 3000);

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, "");
    const file = path.join(root, "api", `${name}.js`);
    if (!name || name.startsWith("_") || !fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Not found" }));
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    req.query = Object.fromEntries(url.searchParams);
    try { req.body = raw && (req.headers["content-type"] || "").includes("application/json") ? JSON.parse(raw) : undefined; }
    catch { req.body = undefined; }
    // Minimal Vercel-style helpers
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); return res; };
    try {
      const { default: handler } = await import(pathToFileURL(file).href);
      await handler(req, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(fs.readFileSync(path.join(root, "index.html")));
  }
  res.writeHead(404); res.end("Not found");
}).listen(PORT, () => {
  console.log(`Portal running at http://localhost:${PORT}`);
  if (!process.env.S3_BUCKET) console.log("Note: S3_BUCKET is not set — copy .env.example to .env and fill it in.");
});
