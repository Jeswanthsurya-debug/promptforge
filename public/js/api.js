/** Thin client for the PromptForge API. */

/** @returns {Promise<{ai: boolean}>} Never throws; assumes no AI when offline. */
export async function fetchHealth() {
  try {
    const response = await fetch("/api/health");
    return await response.json();
  } catch {
    return { ai: false };
  }
}

/**
 * Asks the server to polish a prompt (Gemini, or the local rewrite).
 * @returns {Promise<{improved: string, source: "gemini"|"local"}>}
 * @throws {Error} With a user-readable message when the request fails.
 */
export async function requestPolish(prompt, language) {
  const response = await fetch("/api/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, language }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
