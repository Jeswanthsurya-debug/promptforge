/**
 * Prompt analysis engine.
 *
 * Pure and dependency-free, so the exact same code runs in the browser
 * (live feedback while typing) and on the server (API and tests).
 */

/** Per-language conventions injected into the rewritten prompt. */
export const LANGS = {
  Python: ["Follow PEP 8 and use type hints", "Add pytest unit tests"],
  JavaScript: ["Use modern ES2023+ syntax, no unused variables", "Add tests with node:test or Jest"],
  TypeScript: ["Enable strict typing, avoid `any`", "Add tests with Vitest or Jest"],
  Java: ["Follow Google Java Style, prefer immutability", "Add JUnit 5 tests"],
  "C#": ["Use nullable reference types and async/await", "Add xUnit tests"],
  "C++": ["Use C++20, RAII and smart pointers, no raw new/delete", "Add GoogleTest cases"],
  Go: ["Handle every error explicitly, run gofmt", "Add table-driven tests"],
  Rust: ["Avoid unsafe and unwrap in library code, satisfy clippy", "Add unit tests"],
  Kotlin: ["Prefer val, null safety and coroutines", "Add JUnit tests"],
  Swift: ["Use Swift concurrency, avoid force unwraps", "Add XCTest cases"],
  PHP: ["Use PHP 8.3 strict types and PSR-12", "Add PHPUnit tests"],
  Ruby: ["Follow RuboCop defaults", "Add RSpec tests"],
  SQL: ["Use parameterised queries, explain index choices", "State the target dialect"],
  Bash: ["Use `set -euo pipefail`, quote all variables", "Pass shellcheck"],
  Dart: ["Use sound null safety and effective Dart style", "Add widget or unit tests"],
};

/**
 * @typedef {object} DimensionResult
 * @property {string} id     Stable identifier, e.g. "role".
 * @property {string} label  Human readable name.
 * @property {string} tip    How to improve this dimension.
 * @property {number} score  0 to 100.
 */

/**
 * @typedef {object} Analysis
 * @property {number} score            Overall score, 0 to 100.
 * @property {string} grade            Human readable grade.
 * @property {DimensionResult[]} dimensions
 * @property {string[]} vague          Vague words found in the prompt.
 * @property {number} words
 * @property {number} tokens           Rough estimate (4 characters per token).
 * @property {string} script           Detected writing system, "Latin" by default.
 */

const MAX_SCORE = 100;
const VAGUE_PENALTY_EACH = 10;
const VAGUE_PENALTY_CAP = 30;
const CHARS_PER_TOKEN = 4;
const NON_LATIN_SCORE_PER_WORD = 4;
const COVERED_THRESHOLD = 60;
const GRADES = [
  [85, "Production-ready"],
  [65, "Solid"],
  [40, "Needs structure"],
];
const LOWEST_GRADE = "Too vague";

const VAGUE_WORDS = new Set([
  "something", "stuff", "things", "thing", "good", "nice",
  "better", "best", "etc", "some", "cool", "awesome", "whatever",
]);

// Compiled once. The `g` flag is only used with String.prototype.match, which
// resets lastIndex, so these are safe to share between calls.
const PATTERNS = {
  role: /\b(you are|act as|as an? [a-z]+ (expert|engineer|teacher|editor|analyst|reviewer))\b/i,
  task: /\b(write|create|build|explain|summari[sz]e|compare|generate|list|analy[sz]e|fix|translate|design|review|plan|draft|convert|refactor|debug)\b/i,
  contextHint: /\b(because|audience|goal|background|context|for (a|an|my|our|the))\b/i,
  constraint: /\b(must|should|never|avoid|only|at most|at least|no more than|within|exactly|do not|don't)\b|\d/gi,
  format: /\b(json|yaml|table|bullets?|markdown|csv|steps?|numbered|paragraphs?|sentences?|words|code block|headings?)\b/i,
  example: /\b(example|e\.g\.|for instance|such as|input:|output:)\b|```/i,
};

const NON_LATIN_SCRIPTS = [
  "Tamil", "Devanagari", "Arabic", "Cyrillic", "Han",
  "Hiragana", "Hangul", "Telugu", "Bengali",
].map((name) => [name, new RegExp(`\\p{Script=${name}}`, "u")]);

const matches = (pattern, text) => (pattern.test(text) ? MAX_SCORE : 0);

/** Each dimension scores 0-100; `weight` sets its share of the overall score. */
const DIMENSIONS = [
  {
    id: "role", label: "Role", weight: 1,
    tip: "Say who the model is, e.g. “You are a senior security reviewer.”",
    score: (text) => matches(PATTERNS.role, text),
  },
  {
    id: "task", label: "Task", weight: 2,
    tip: "Start with one clear action verb: write, compare, fix, summarise.",
    score: (text) => (PATTERNS.task.test(text) ? MAX_SCORE : 25),
  },
  {
    id: "context", label: "Context", weight: 1.5,
    tip: "Add the audience, goal and background the model cannot guess.",
    score: (text, wordCount) =>
      Math.min(MAX_SCORE, wordCount * 3 + (PATTERNS.contextHint.test(text) ? 25 : 0)),
  },
  {
    id: "constraints", label: "Constraints", weight: 1.5,
    tip: "Set limits: length, tone, what to avoid, what is required.",
    score: (text) => Math.min(MAX_SCORE, (text.match(PATTERNS.constraint) ?? []).length * 35),
  },
  {
    id: "format", label: "Output format", weight: 1.25,
    tip: "Name the shape of the answer: table, JSON, 5 bullets, numbered steps.",
    score: (text) => matches(PATTERNS.format, text),
  },
  {
    id: "examples", label: "Examples", weight: 0.75,
    tip: "Show one sample input and output so the model copies the pattern.",
    score: (text) => matches(PATTERNS.example, text),
  },
];

const TOTAL_WEIGHT = DIMENSIONS.reduce((sum, dimension) => sum + dimension.weight, 0);

/** Splits text into Unicode-aware words (letters and numbers). */
export const wordsOf = (text) => text.match(/[\p{L}\p{N}']+/gu) ?? [];

/** @returns {string} The first non-Latin script found, otherwise "Latin". */
export function detectScript(text) {
  return NON_LATIN_SCRIPTS.find(([, pattern]) => pattern.test(text))?.[0] ?? "Latin";
}

/** @param {number} score 0 to 100 @returns {string} */
export function grade(score) {
  return GRADES.find(([minimum]) => score >= minimum)?.[1] ?? LOWEST_GRADE;
}

const EMPTY_ANALYSIS = Object.freeze({
  score: 0, grade: grade(0), dimensions: [], vague: [], words: 0, tokens: 0, script: "Latin",
});

let lastText = null;
let lastAnalysis = null;

/**
 * Scores a prompt. The most recent result is cached, because the UI and the
 * rewrite step both ask about the same text. Treat the result as read-only.
 *
 * @param {string} [prompt]
 * @returns {Analysis}
 */
export function analyze(prompt = "") {
  const text = String(prompt).trim();
  if (text === lastText) return lastAnalysis;

  const words = wordsOf(text);
  const result = words.length ? scorePrompt(text, words) : EMPTY_ANALYSIS;
  lastText = text;
  lastAnalysis = result;
  return result;
}

function scorePrompt(text, words) {
  const script = detectScript(text);
  // Keyword checks are tuned for English. For other scripts we stay neutral
  // (length based) instead of unfairly scoring them zero.
  const neutralScore = Math.min(MAX_SCORE, words.length * NON_LATIN_SCORE_PER_WORD);
  const dimensions = DIMENSIONS.map(({ id, label, tip, score }) => ({
    id, label, tip,
    score: script === "Latin" ? Math.round(score(text, words.length)) : neutralScore,
  }));

  const weighted = dimensions.reduce((sum, d, i) => sum + d.score * DIMENSIONS[i].weight, 0);
  const vague = [...new Set(words.map((w) => w.toLowerCase()).filter((w) => VAGUE_WORDS.has(w)))];
  const penalty = Math.min(VAGUE_PENALTY_CAP, vague.length * VAGUE_PENALTY_EACH);
  const score = Math.max(0, Math.min(MAX_SCORE, Math.round(weighted / TOTAL_WEIGHT - penalty)));

  return {
    score, grade: grade(score), dimensions, vague, script,
    words: words.length,
    tokens: Math.ceil(text.length / CHARS_PER_TOKEN),
  };
}

/**
 * Rewrites a prompt into a structured one (role, task, context, constraints,
 * output format, quality bar), adding conventions for the chosen language.
 *
 * @param {string} [prompt]
 * @param {string} [language]  A key of LANGS, or "" for a general prompt.
 * @param {Analysis} [analysis]  Pass an existing analysis to avoid recomputing.
 * @returns {string} The improved prompt, or "" when the input is empty.
 */
export function forge(prompt = "", language = "", analysis = analyze(prompt)) {
  const task = String(prompt).trim();
  if (!task) return "";

  const covered = (id) =>
    (analysis.dimensions.find((d) => d.id === id)?.score ?? 0) >= COVERED_THRESHOLD;
  const expert = language ? `${language} engineer` : "domain expert";

  const sections = [
    ["Role", [`You are a senior ${expert} who answers precisely.`]],
    ["Task", [task]],
    ["Context", [covered("context")
      ? "Use every detail given in the task."
      : "[Who is this for? What is the goal? What is already known?]"]],
    ["Constraints", [
      "- Be specific; no filler or generic advice.",
      "- If something is ambiguous, state your assumption first, then continue.",
      ...(LANGS[language] ?? []).map((rule) => `- ${rule}`),
      ...(covered("constraints") ? [] : ["- [Add length, tone, and anything to avoid]"]),
    ]],
    ["Output format", [covered("format")
      ? "Follow the format requested in the task."
      : "[e.g. numbered steps, a table, or JSON]"]],
    ["Quality bar", [
      "Check your answer against every constraint before replying. " +
        "Reply in the same language as the task.",
    ]],
  ];
  return sections.map(([title, lines]) => `# ${title}\n${lines.join("\n")}`).join("\n\n");
}
