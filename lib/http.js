import { MAX_BODY_BYTES, SECURITY_HEADERS } from "./config.js";

const JSON_TYPE = "application/json; charset=utf-8";

/** An error that carries the HTTP status (and headers) to answer with. */
export class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

/** Writes a response with security headers. Objects are sent as JSON. */
export function send(res, status, body, { type = JSON_TYPE, headers = {} } = {}) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
    ...headers,
  });
  const isRaw = typeof body === "string" || Buffer.isBuffer(body);
  res.end(isRaw ? body : JSON.stringify(body));
}

/** Answers with the error's status. Unexpected errors never leak details. */
export function sendError(res, error) {
  if (error instanceof HttpError) {
    send(res, error.status, { error: error.message }, { headers: error.headers });
  } else {
    send(res, 500, { error: "Something went wrong" });
  }
}

/** Best-effort client identifier, used only for rate limiting. */
export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";
  return String(forwarded).split(",")[0].trim();
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

/** Reads a JSON body, whether pre-parsed (Vercel) or streamed (Node http). */
export async function readJson(req, maxBytes = MAX_BODY_BYTES) {
  if (req.body !== undefined && req.body !== null) {
    const isParsed = typeof req.body === "object" && !Buffer.isBuffer(req.body);
    return isParsed ? req.body : parseJson(String(req.body));
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "Body too large");
    chunks.push(chunk);
  }
  return parseJson(Buffer.concat(chunks).toString("utf8") || "{}");
}
