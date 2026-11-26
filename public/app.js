/** Entry point: wires the page together. */
import { LANGS } from "/lib/analyzer.js";
import { createDemoPlayer } from "/js/demo.js";
import { fetchHealth, requestPolish } from "/js/api.js";
import { createView } from "/js/view.js";

const DEBOUNCE_MS = 120;
const byId = (id) => document.getElementById(id);

const editor = byId("editor");
const languageSelect = byId("lang");
const copyButton = byId("copy");
const polishButton = byId("polish");
const status = byId("status");
const view = createView();
let polished = "";

Object.keys(LANGS).forEach((name) => languageSelect.append(new Option(name, name)));

function refresh() {
  const { forged, changed } = view.render(editor.value, languageSelect.value);
  if (!changed) return;
  polished = "";
  status.textContent = "";
  copyButton.disabled = !forged;
  polishButton.disabled = !forged;
}

const demo = createDemoPlayer({
  editor, languageSelect, button: byId("play"), note: byId("demo-note"), onFrame: refresh,
});

let debounceTimer;
editor.addEventListener("input", () => {
  demo.stop();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, DEBOUNCE_MS);
});
languageSelect.addEventListener("change", refresh);
byId("play").addEventListener("click", demo.toggle);
document.querySelectorAll(".demo").forEach((button) => {
  button.addEventListener("click", () => demo.load(button.dataset.demo));
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(polished || byId("forged").textContent);
    status.textContent = "Copied.";
  } catch {
    status.textContent = "Copy failed. Select the text and copy it manually.";
  }
});

polishButton.addEventListener("click", async () => {
  status.textContent = "Polishing…";
  polishButton.disabled = true;
  try {
    const result = await requestPolish(editor.value, languageSelect.value);
    polished = result.improved;
    view.showImproved(polished);
    status.textContent =
      result.source === "gemini" ? "Polished with Gemini." : "Showing the local rewrite.";
  } catch (error) {
    status.textContent = error.message || "Could not polish. Try again.";
  }
  polishButton.disabled = false;
});

refresh();
fetchHealth().then(({ ai }) => { polishButton.hidden = !ai; });
