import { LANGS } from "../public/lib/analyzer.js";
import { MAX_PROMPT_CHARS } from "./config.js";
import { HttpError } from "./http.js";

/**
 * Validates a request body and returns a clean `{ prompt, language }`.
 * An unknown language is ignored rather than rejected.
 */
export function parsePromptRequest(body) {
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const language = Object.hasOwn(LANGS, body?.language) ? body.language : "";

  if (!prompt) throw new HttpError(400, "Prompt is required");
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new HttpError(413, `Prompt must be under ${MAX_PROMPT_CHARS} characters`);
  }
  return { prompt, language };
}
