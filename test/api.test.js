import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../dev-server.js";
import analyzeFunction from "../api/analyze.js";
import healthFunction from "../api/health.js";

let server;
let base;

before(async () => {
  server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const post = (path, body, raw) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });

/** Calls a Vercel function with a minimal fake request and response. */
async function callFunction(fn, req) {
  const out = {};
  const res = {
    writeHead: (status, headers) => Object.assign(out, { status, headers }),
    end: (body) => { out.body = JSON.parse(body); },
  };
  await fn({ headers: {}, socket: {}, ...req }, res);
  return out;
}

test("health reports languages", async () => {
  const body = await (await fetch(`${base}/api/health`)).json();
  assert.equal(body.ok, true);
  assert.ok(body.languages.includes("Python"));
});

test("analyze returns score and forged prompt", async () => {
  const response = await post("/api/analyze", { prompt: "Write a Go parser", language: "Go" });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(body.score >= 0);
  assert.match(body.forged, /gofmt/);
});

test("rejects empty, invalid and oversized input", async () => {
  assert.equal((await post("/api/analyze", { prompt: "" })).status, 400);
  assert.equal((await post("/api/analyze", null, "{bad")).status, 400);
  assert.equal((await post("/api/analyze", { prompt: "x".repeat(5000) })).status, 413);
});

test("enhance falls back to the local rewrite without an API key", async () => {
  delete process.env.GEMINI_API_KEY;
  const body = await (await post("/api/enhance", { prompt: "Explain DNS" })).json();
  assert.equal(body.source, "local");
});

test("serves the app with security headers", async () => {
  const response = await fetch(base + "/");
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("content-security-policy").includes("default-src 'self'"));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(await response.text(), /^<!doctype html>/i);
});

test("serves every static asset with the right type", async () => {
  const assets = [
    ["/styles.css", /css/, ":root"],
    ["/app.js", /javascript/, "/**"],
    ["/lib/analyzer.js", /javascript/, "/**"],
    ["/js/view.js", /javascript/, "/**"],
    ["/js/demo.js", /javascript/, "/**"],
    ["/js/api.js", /javascript/, "/**"],
  ];
  for (const [path, type, start] of assets) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type"), type);
    assert.ok((await response.text()).startsWith(start), path);
  }
});

test("blocks path traversal, server files and unknown paths", async () => {
  for (const path of ["/../dev-server.js", "/%2e%2e/package.json", "/dev-server.js", "/nope.js", "/lib"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});

test("vercel analyze function works with a pre-parsed body", async () => {
  const out = await callFunction(analyzeFunction, { method: "POST", body: { prompt: "Explain DNS" } });
  assert.equal(out.status, 200);
  assert.ok(out.body.score >= 0);
});

test("vercel functions reject the wrong HTTP method", async () => {
  assert.equal((await callFunction(analyzeFunction, { method: "GET" })).status, 405);
  assert.equal((await callFunction(healthFunction, { method: "POST" })).status, 405);
});
