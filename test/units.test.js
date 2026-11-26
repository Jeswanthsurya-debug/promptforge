import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../lib/rate-limit.js";
import { parsePromptRequest } from "../lib/validate.js";
import { polishWithGemini } from "../lib/gemini.js";
import { readJson } from "../lib/http.js";

test("validate trims the prompt and ignores unknown languages", () => {
  assert.deepEqual(parsePromptRequest({ prompt: "  Hi  ", language: "Klingon" }), {
    prompt: "Hi",
    language: "",
  });
  assert.equal(parsePromptRequest({ prompt: "Hi", language: "Rust" }).language, "Rust");
});

test("validate rejects missing, non-string and oversized prompts", () => {
  for (const body of [null, {}, { prompt: 42 }, { prompt: "   " }]) {
    assert.throws(() => parsePromptRequest(body), { status: 400 });
  }
  assert.throws(() => parsePromptRequest({ prompt: "x".repeat(4001) }), { status: 413 });
});

test("rate limiter blocks after the limit and resets with the window", () => {
  let time = 0;
  const limited = createRateLimiter(
    { windowMs: 1000, maxRequests: 2, maxTrackedClients: 10 },
    () => time,
  );
  assert.deepEqual([limited("a"), limited("a"), limited("a")], [false, false, true]);
  assert.equal(limited("b"), false);
  time = 1000;
  assert.equal(limited("a"), false);
});

test("rate limiter bounds memory when many clients appear", () => {
  const limited = createRateLimiter(
    { windowMs: 1000, maxRequests: 1, maxTrackedClients: 2 },
    () => 0,
  );
  limited("a");
  limited("b");
  assert.equal(limited("c"), false);
});

test("gemini returns null without a key", async () => {
  assert.equal(await polishWithGemini("Explain DNS", "", { apiKey: "" }), null);
});

test("gemini returns the model text on success", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: " Better prompt " }] } }] }),
  });
  assert.equal(await polishWithGemini("x", "Go", { apiKey: "k", fetchImpl }), "Better prompt");
});

test("gemini returns null on HTTP errors and network failures", async () => {
  const notOk = async () => ({ ok: false });
  const broken = async () => { throw new Error("offline"); };
  assert.equal(await polishWithGemini("x", "", { apiKey: "k", fetchImpl: notOk }), null);
  assert.equal(await polishWithGemini("x", "", { apiKey: "k", fetchImpl: broken }), null);
});

test("readJson accepts pre-parsed and string bodies and rejects bad JSON", async () => {
  assert.deepEqual(await readJson({ body: { a: 1 } }), { a: 1 });
  assert.deepEqual(await readJson({ body: '{"a":2}' }), { a: 2 });
  await assert.rejects(readJson({ body: "{bad" }), { status: 400 });
});
