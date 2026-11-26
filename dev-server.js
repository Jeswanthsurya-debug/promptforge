/** Zero-dependency local server: serves /public and the same API as Vercel. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./lib/handlers.js";
import { send } from "./lib/http.js";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "public");
const DEFAULT_PORT = 8080;

// Only these file types are ever served.
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

/** Maps a URL path to a file inside /public, or null if it escapes it. */
export function resolvePublicFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const file = resolve(PUBLIC_DIR, decoded === "/" ? "index.html" : decoded.slice(1));
  const isInside = file.startsWith(PUBLIC_DIR + sep);
  return isInside && MIME_TYPES[extname(file)] ? file : null;
}

async function serveStatic(res, urlPath) {
  const file = resolvePublicFile(urlPath);
  if (!file) return false;
  try {
    send(res, 200, await readFile(file), { type: MIME_TYPES[extname(file)] });
    return true;
  } catch {
    return false;
  }
}

export function createApp() {
  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname.startsWith("/api/") && (await handleApi(req, res, pathname))) return;
    if (req.method === "GET" && (await serveStatic(res, pathname))) return;
    send(res, 404, { error: "Not found" });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  createApp().listen(port, () => console.log(`PromptForge listening on :${port}`));
}
