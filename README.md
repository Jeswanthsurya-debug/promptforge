# PromptForge

**Challenge:** PromptWars – AI Prompt Challenge (Open Innovation track)
**Live demo:** _add your Vercel URL here_

## Problem statement

People lose time and money on AI tools because their prompts are vague, and nothing tells them *why* a prompt is weak.
Most prompt tools just rewrite the text. PromptForge **explains** the weakness first, so the writer learns, then produces a stronger prompt.

**PromptForge is a prompt clinic.** Paste any prompt and instantly get:
1. A 0–100 score with a grade (Too vague → Production-ready).
2. Six measured dimensions: Role, Task, Context, Constraints, Output format, Examples, each with a fix tip.
3. Vague-word detection ("something", "good", "stuff").
4. A structured rewrite, tuned for **15 programming languages** (Python, JavaScript, TypeScript, Java, C#, C++, Go, Rust, Kotlin, Swift, PHP, Ruby, SQL, Bash, Dart) and written to reply in **any human language** (Tamil, Hindi, Arabic, Chinese… are detected).
5. Optional one-click polish with Gemini (set `GEMINI_API_KEY`). Without a key the app works fully offline with the local engine.

## Demo

Press **Watch demo** to see a prompt typed, scored and improved automatically in about 15 seconds. Or press **Weak**, **Okay**, then **Strong** under the prompt box. The same task scores 8, 53 and 100 as you add role, constraints, format and an example, which shows exactly what the score rewards.

## How it maps to the challenge brief

| Brief | Where in the code |
|---|---|
| Understand prompts | `public/lib/analyzer.js` scoring engine |
| Use AI tools effectively | `lib/gemini.js` and `/api/enhance`, with a safe local fallback |
| Think creatively | Explain-first design, live scoring as you type, auto-playing demo |
| Solve assigned tasks | Turns any task into a structured, testable prompt |

## Architecture

```
public/            Browser app (plain HTML, CSS, ES modules, no build step)
  lib/analyzer.js    Pure scoring + rewrite engine, shared with the server
  js/view.js         Renders results by updating DOM nodes in place
  js/demo.js         Demo prompts and the auto-playing walkthrough
  js/api.js          Small API client
  app.js             Wires the page together
api/               Vercel serverless functions (3 one-line adapters)
lib/               Server modules, one job each
  handlers.js        Routes, shared by Vercel and the local server
  validate.js        Input validation
  rate-limit.js      Bounded fixed-window rate limiter
  gemini.js          Gemini client with timeout and fallback
  http.js, config.js Response helpers, limits and security headers
dev-server.js      Zero-dependency local server (same API as Vercel)
test/              30 tests with the built-in node:test runner
```

The same `analyzer.js` runs in the browser and on the server, so scores always match, and the API logic lives in one place for both Vercel and local use.

## Run

```bash
npm start            # http://localhost:8080
npm test
GEMINI_API_KEY=... npm start   # optional AI polish
```

## Deploy to Vercel

Import the repo on vercel.com, keep the root directory `./`, and press Deploy. There is no build step and no dependencies. `vercel.json` adds security and caching headers; `public/` is served statically and `api/` becomes serverless functions.

## Quality notes

- **Security:** strict CSP and security headers, no `innerHTML`, input validation, 20 KB body cap, 4,000-character prompt cap, rate limiting (30 requests per minute per IP, bounded memory), no secrets in code, path-traversal-safe static serving, non-root container.
- **Efficiency:** zero runtime dependencies; live scoring runs in the browser with no network call; regexes compiled once; the last analysis is cached so the rewrite never recomputes it; the UI updates existing DOM nodes instead of rebuilding them; static assets are cacheable and module-preloaded.
- **Code quality:** small single-purpose modules, JSDoc types, named constants instead of magic numbers, no duplicated logic between local and Vercel runtimes, consistent error handling through one `HttpError` type, `.editorconfig`.
- **Accessibility:** labelled controls, skip link, `aria-live` status and demo captions, visible focus, dark mode, reduced-motion support, responsive layout, `noscript` message.
- **Testing:** unit tests for scoring, rewriting, validation, rate limiting and the Gemini client (with a fake `fetch`); integration tests for the API, validation, headers, static files, path traversal and the Vercel functions.
