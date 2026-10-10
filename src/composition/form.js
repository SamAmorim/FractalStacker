import { STYLE_PRESETS } from "../config/styles.js";
import { clamp, fractalSignature } from "../core/math.js";
import { state } from "../core/state.js";

export function getStyle() {
  return STYLE_PRESETS[state.music.style] || STYLE_PRESETS.downtempo;
}

export function getPhraseBars() {
  const style = getStyle();
  const form = style.form || {};
  return form.phraseBars || style.phraseBars || 8;
}

function getFormSections() {
  const form = getStyle().form || {};
  return form.sections && form.sections.length
    ? form.sections
    : [{ name: "Respiro", energy: 0.3, theme: "A" }];
}

export function updateForm(barIndex) {
  const compose = state.compose;
  const phraseBars = getPhraseBars();
  compose.phraseIndex = Math.floor(barIndex / phraseBars);
  compose.phraseBar = barIndex % phraseBars;

  if (!state.music.autoForm) {
    compose.section = "Manual";
    compose.energy = clamp(state.music.energy, 0, 1);
    return;
  }

  const sections = getFormSections();
  const section = sections[compose.phraseIndex % sections.length];
  const arc = (compose.phraseBar / Math.max(1, phraseBars - 1)) * 0.1;
  const drift = (fractalSignature(barIndex, state.fractalDepth, 3) - 0.5) * 0.12;
  const bias = (clamp(state.music.energy, 0, 1) - 0.6) * 0.5;
  compose.section = section.name;
  compose.energy = clamp(section.energy + arc + drift + bias, 0.05, 1);
}

export function metricWeight(stepInBar) {
  if (stepInBar === 0) return 1;
  if (stepInBar === 8) return 0.85;
  if (stepInBar % 4 === 0) return 0.7;
  if (stepInBar % 2 === 0) return 0.45;
  return 0.25;
}
