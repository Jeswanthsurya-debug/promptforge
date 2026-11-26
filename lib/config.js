/** Central place for every limit and setting, so nothing is a magic number. */

export const MAX_BODY_BYTES = 20_000;
export const MAX_PROMPT_CHARS = 4_000;

export const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
  maxTrackedClients: 10_000,
};

export const GEMINI = {
  defaultModel: "gemini-2.5-flash",
  timeoutMs: 15_000,
  maxOutputTokens: 800,
  temperature: 0.4,
};

export const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};
