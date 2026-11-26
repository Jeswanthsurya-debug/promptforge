/**
 * Renders analysis results. DOM nodes are created once and updated in place,
 * so typing never rebuilds the page.
 */
import { analyze, forge } from "/lib/analyzer.js";

const ARC_LENGTH = 327; // circumference of the r=52 ring drawn in index.html
const LOW_SCORE = 50;
const EMPTY_FORGED = "Your improved prompt appears here.";
const IDLE_GRADE = "Start typing";

function createRow() {
  const item = document.createElement("li");
  const top = document.createElement("div");
  const label = document.createElement("span");
  const value = document.createElement("span");
  const bar = document.createElement("div");
  const fill = document.createElement("i");
  const tip = document.createElement("small");

  top.className = "top";
  bar.className = "bar";
  top.append(label, value);
  bar.append(fill);
  item.append(top, bar, tip);
  return { item, label, value, fill, tip };
}

export function createView() {
  const byId = (id) => document.getElementById(id);
  const el = {
    meta: byId("meta"), arc: byId("arc"), num: byId("num"), grade: byId("grade"),
    dims: byId("dims"), vague: byId("vague"), forged: byId("forged"),
  };
  let rows = null;
  let lastKey = null;
  let lastResult = null;

  function ensureRows(count) {
    if (rows) return;
    rows = Array.from({ length: count }, createRow);
    el.dims.append(...rows.map((row) => row.item));
    void el.dims.offsetWidth; // flush layout so the first bars animate from 0
  }

  function renderDimensions(dimensions) {
    el.dims.hidden = dimensions.length === 0;
    if (!dimensions.length) return;
    ensureRows(dimensions.length);
    dimensions.forEach((dimension, index) => {
      const row = rows[index];
      const isLow = dimension.score < LOW_SCORE;
      row.label.textContent = dimension.label;
      row.value.textContent = dimension.score;
      row.fill.style.width = `${dimension.score}%`;
      row.fill.classList.toggle("low", isLow);
      row.tip.textContent = dimension.tip;
      row.tip.hidden = !isLow;
    });
  }

  /**
   * Updates every output for the given prompt. Does nothing when the input is
   * unchanged since the last call.
   * @returns {{analysis: object, forged: string, changed: boolean}}
   */
  function render(text, language) {
    const key = `${language}\u0000${text}`;
    if (key === lastKey) return { ...lastResult, changed: false };

    const analysis = analyze(text);
    const forged = forge(text, language, analysis);

    el.meta.textContent = `${analysis.words} words, about ${analysis.tokens} tokens`;
    el.num.textContent = analysis.score;
    el.arc.style.strokeDashoffset = ARC_LENGTH - (ARC_LENGTH * analysis.score) / 100;
    el.arc.classList.toggle("low", analysis.score < LOW_SCORE);
    el.grade.textContent = analysis.words ? analysis.grade : IDLE_GRADE;
    renderDimensions(analysis.dimensions);

    el.vague.hidden = analysis.vague.length === 0;
    el.vague.textContent = analysis.vague.length
      ? `Vague words: ${analysis.vague.join(", ")}. Replace them with something measurable.`
      : "";
    el.forged.textContent = forged || EMPTY_FORGED;

    lastKey = key;
    lastResult = { analysis, forged };
    return { ...lastResult, changed: true };
  }

  return { render, showImproved: (text) => { el.forged.textContent = text; } };
}
