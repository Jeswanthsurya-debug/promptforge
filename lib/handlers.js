/**
 * API routes, shared by the local server (dev-server.js) and the Vercel
 * serverless functions in /api, so behaviour is identical everywhere.
 */
import { analyze, forge, LANGS } from "../public/lib/analyzer.js";
import { RATE_LIMIT } from "./config.js";
import { polishWithGemini } from "./gemini.js";
import { HttpError, clientIp, readJson, send, sendError } from "./http.js";
import { createRateLimiter } from "./rate-limit.js";
import { parsePromptRequest } from "./validate.js";

const isLimited = createRateLimiter(RATE_LIMIT);

/** Wraps a route that takes a prompt: rate limit, parse, validate. */
const promptRoute = (handle) => async (req, res) => {
  if (isLimited(clientIp(req))) {
    throw new HttpError(429, "Too many requests. Try again in a minute.", { "Retry-After": "60" });
  }
  const { prompt, language } = parsePromptRequest(await readJson(req));
  send(res, 200, await handle(prompt, language));
};

const routes = {
  "GET /api/health": (_req, res) =>
    send(res, 200, {
      ok: true,
      ai: Boolean(process.env.GEMINI_API_KEY),
      languages: Object.keys(LANGS),
    }),

  "POST /api/analyze": promptRoute((prompt, language) => {
    const analysis = analyze(prompt);
    return { ...analysis, forged: forge(prompt, language, analysis) };
  }),

  "POST /api/enhance": promptRoute(async (prompt, language) => {
    const improved = await polishWithGemini(prompt, language);
    return improved
      ? { improved, source: "gemini" }
      : { improved: forge(prompt, language), source: "local" };
  }),
};

/** @returns {Promise<boolean>} True if the request matched an API route. */
export async function handleApi(req, res, path) {
  const route = routes[`${req.method} ${path}`];
  if (!route) return false;
  try {
    await route(req, res);
  } catch (error) {
    sendError(res, error);
  }
  return true;
}

/** Adapts handleApi to a Vercel function for one fixed path. */
export const vercelHandler = (path) => async (req, res) => {
  const handled = await handleApi(req, res, path);
  if (!handled) send(res, 405, { error: "Method not allowed" });
};
