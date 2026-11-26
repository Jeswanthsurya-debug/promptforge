import test from "node:test";
import assert from "node:assert/strict";
import { LANGS, analyze, detectScript, forge, grade, wordsOf } from "../public/lib/analyzer.js";

const STRONG = `You are a senior Python engineer. Write a function that parses CSV files for our
finance team because reports are slow. It must handle 1 million rows, never load the full
file in memory, and avoid third-party libraries. Return a code block and a table of edge
cases. Example: input "a,b" output ["a","b"].`;

test("empty prompt scores zero", () => {
  assert.equal(analyze("").score, 0);
  assert.equal(analyze("   ").dimensions.length, 0);
});

test("strong prompt beats vague prompt", () => {
  assert.ok(analyze(STRONG).score > analyze("write something good").score + 30);
});

test("vague words are flagged and penalised", () => {
  const result = analyze("Write something nice about stuff");
  assert.deepEqual([...result.vague].sort(), ["nice", "something", "stuff"]);
});

test("score stays within 0..100", () => {
  for (const prompt of ["a", STRONG, "x ".repeat(2000)]) {
    const { score } = analyze(prompt);
    assert.ok(score >= 0 && score <= 100);
  }
});

test("demo prompts score weak < okay < strong", () => {
  const weak = analyze("Write me something good about sorting").score;
  const okay = analyze("Explain how quicksort works for beginners in 5 bullet points.").score;
  assert.ok(weak < okay && okay < analyze(STRONG).score);
});

test("grade thresholds", () => {
  assert.equal(grade(90), "Production-ready");
  assert.equal(grade(70), "Solid");
  assert.equal(grade(50), "Needs structure");
  assert.equal(grade(10), "Too vague");
});

test("detects non-Latin scripts", () => {
  assert.equal(detectScript("வணக்கம் உலகம்"), "Tamil");
  assert.equal(detectScript("नमस्ते"), "Devanagari");
  assert.equal(detectScript("hello"), "Latin");
});

test("non-Latin prompts get a neutral, length-based score", () => {
  const result = analyze("வணக்கம் உலகம் இது ஒரு சோதனை");
  assert.equal(result.script, "Tamil");
  assert.ok(result.dimensions.every((d) => d.score === result.dimensions[0].score));
});

test("wordsOf counts Unicode words", () => {
  assert.equal(wordsOf("héllo wörld 42").length, 3);
});

test("analyze reuses the cached result for identical text", () => {
  assert.equal(analyze("Explain DNS"), analyze("  Explain DNS  "));
});

test("forge adds language conventions for every supported language", () => {
  for (const [language, rules] of Object.entries(LANGS)) {
    assert.ok(forge("Sort a list", language).includes(rules[0]), language);
  }
});

test("forge keeps the task, fills gaps, and is empty for empty input", () => {
  const output = forge("Sort a list");
  assert.ok(output.includes("Sort a list"));
  assert.ok(output.includes("[Add length, tone, and anything to avoid]"));
  assert.equal(forge(""), "");
});

test("forge gives the same result with or without a precomputed analysis", () => {
  const prompt = "Explain DNS to beginners in 5 bullet points";
  assert.equal(forge(prompt, "Go"), forge(prompt, "Go", analyze(prompt)));
});
