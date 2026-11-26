import { GEMINI } from "./config.js";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function systemInstruction(language) {
  const target = language ? ` Target programming language: ${language}.` : "";
  return (
    "You rewrite weak AI prompts into clear, structured ones " +
    "(role, task, context, constraints, output format). " +
    `Keep the user's intent and language. Return only the improved prompt.${target}`
  );
}

/**
 * Asks Gemini to improve a prompt.
 *
 * @returns {Promise<string|null>} The improved prompt, or null when no API key
 *   is set or the call fails, so callers can fall back to the local rewrite.
 */
export async function polishWithGemini(prompt, language, options = {}) {
  const {
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || GEMINI.defaultModel,
    fetchImpl = fetch,
  } = options;
  if (!apiKey) return null;

  try {
    const response = await fetchImpl(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction(language) }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: GEMINI.maxOutputTokens,
          temperature: GEMINI.temperature,
        },
      }),
      signal: AbortSignal.timeout(GEMINI.timeoutMs),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}
