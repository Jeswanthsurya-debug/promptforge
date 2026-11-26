/** Demo prompts and the auto-playing walkthrough. */

export const DEMOS = {
  weak: { language: "", text: "Write me something good about sorting" },
  okay: { language: "", text: "Explain how quicksort works for beginners in 5 bullet points." },
  strong: {
    language: "Python",
    text:
      "You are a senior Python engineer. Write a function that sorts 1 million log lines " +
      "by timestamp for our SRE team because reports are slow. It must use at most 200 MB " +
      "of memory, avoid third-party libraries, and never load the full file at once. " +
      'Return a code block and a table of edge cases. Example: input "2026-11-25 ERROR db" ' +
      "output sorted lines.",
  },
};

const STEPS = [
  ["weak", "Step 1 of 3: a weak prompt"],
  ["okay", "Step 2 of 3: add an audience and a format"],
  ["strong", "Step 3 of 3: add role, limits and an example"],
];
const CHARS_PER_FRAME = 4;
const FRAME_MS = 35;
const PAUSE_MS = 1600;
const IDLE_LABEL = "Watch demo";
const RUNNING_LABEL = "Stop demo";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {object} parts
 * @param {HTMLTextAreaElement} parts.editor
 * @param {HTMLSelectElement} parts.languageSelect
 * @param {HTMLElement} parts.button
 * @param {HTMLElement} parts.note       Live region for the step captions.
 * @param {() => void} parts.onFrame     Called after each change to the editor.
 */
export function createDemoPlayer({ editor, languageSelect, button, note, onFrame }) {
  let runId = 0;

  function stop() {
    runId += 1;
    button.textContent = IDLE_LABEL;
  }

  function load(key) {
    stop();
    languageSelect.value = DEMOS[key].language;
    editor.value = DEMOS[key].text;
    onFrame();
  }

  async function play() {
    const myRun = ++runId;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    button.textContent = RUNNING_LABEL;

    for (const [key, caption] of STEPS) {
      const { language, text } = DEMOS[key];
      const chunk = reducedMotion ? text.length : CHARS_PER_FRAME;
      languageSelect.value = language;
      note.textContent = caption;

      for (let end = chunk; end < text.length + chunk; end += chunk) {
        if (myRun !== runId) return;
        editor.value = text.slice(0, end);
        onFrame();
        await sleep(reducedMotion ? 0 : FRAME_MS);
      }
      await sleep(reducedMotion ? 0 : PAUSE_MS);
    }
    if (myRun === runId) {
      note.textContent = "Done. The same task went from vague to production-ready.";
      button.textContent = IDLE_LABEL;
    }
  }

  function toggle() {
    if (button.textContent === RUNNING_LABEL) {
      stop();
      note.textContent = "";
    } else {
      play();
    }
  }

  return { load, stop, toggle };
}
