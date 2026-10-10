import { EQUATIONS } from "../algorithms/equations/index.js";
import { SCALE_LIBRARY } from "../config/scales.js";
import { clamp } from "../core/math.js";
import { state } from "../core/state.js";
import { noteNameFromSemitone } from "../theory/notes.js";
import { dom } from "./dom.js";

export function renderEquationLibrary() {
  const usage = {};
  state.instruments.forEach(function (inst) {
    usage[inst.equation] = (usage[inst.equation] || 0) + 1;
  });

  const cards = Object.keys(EQUATIONS).map(function (key) {
    const eq = EQUATIONS[key];
    const count = usage[key] || 0;
    const activeClass = count > 0 ? " active" : "";
    return (
      "<article class=\"equation-card" + activeClass + "\">" +
      "<h3>" + eq.name + "</h3>" +
      "<p>" + eq.formula + "</p>" +
      "<div class=\"eq-usage\">used by " + count + " layer(s)</div>" +
      "</article>"
    );
  });
  dom.equationLibrary.innerHTML = cards.join("");
}

export function renderEquationMonitor() {
  const lines = [];
  lines.push("Scale: " + SCALE_LIBRARY[state.scale].label);
  lines.push("Fractal Depth: " + state.fractalDepth + " | Chaos: " + state.chaos.toFixed(2));
  lines.push("Microtonalidade: " + state.microtonalCents.toFixed(0) + " cents");
  if (state.scale === "dodecaphonicRow" && state.dodecaphonic.row.length) {
    lines.push("Serie 12: " + state.dodecaphonic.row.map(noteNameFromSemitone).join(" - "));
  }
  lines.push("");
  state.instruments.forEach(function (inst) {
    const eq = EQUATIONS[inst.equation];
    const debug = state.equationDebug[inst.id];
    const status = inst.enabled ? "ON " : "OFF";
    const triggerText = debug && debug.trigger ? "TRIG" : "----";
    const frequencyText = debug && debug.frequency ? debug.frequency.toFixed(1) + "Hz" : "--";
    const rawValue = debug ? debug.raw.toFixed(3) : "0.000";
    const finalValue = debug ? debug.combined.toFixed(3) : inst.lastValue.toFixed(3);
    lines.push(
      inst.name +
      " [" +
      status +
      "] -> " +
      eq.name +
      " | raw=" +
      rawValue +
      " | out=" +
      finalValue +
      " | " +
      triggerText +
      " | " +
      frequencyText
    );
  });
  lines.push("");
  lines.push("Inspector abaixo mostra cada termo da equacao em tempo real.");
  dom.equationMonitor.textContent = lines.join("\n");
}

function equationBar(label, value, normalized) {
  const barRatio = clamp(typeof normalized === "number" ? normalized : value, 0, 1);
  const numeric = typeof value === "number" ? value : 0;
  return (
    "<div class=\"eq-bar-row\">" +
    "<span>" + label + "</span>" +
    "<div class=\"eq-bar-track\"><div class=\"eq-bar-fill\" style=\"width:" + (barRatio * 100).toFixed(1) + "%\"></div></div>" +
    "<span>" + numeric.toFixed(3) + "</span>" +
    "</div>"
  );
}

export function renderEquationLiveInspector() {
  if (!dom.equationLiveGrid) {
    return;
  }

  const cards = state.instruments.map(function (inst) {
    const eq = EQUATIONS[inst.equation] || EQUATIONS.fibonacci;
    const debug = state.equationDebug[inst.id] || {
      step: 0,
      raw: 0,
      fractal: 0,
      random: 0,
      combined: 0,
      threshold: 1,
      deterministicPulse: false,
      trigger: false,
      triggerReason: "idle",
      frequency: null,
      detailText: "idle"
    };

    const cardClass = "eq-live-card" + (inst.enabled ? "" : " muted") + (debug.trigger ? " trigger" : "");
    const triggerLedClass = "eq-led" + (debug.trigger ? " on" : "");
    const frequencyText = typeof debug.frequency === "number" ? debug.frequency.toFixed(2) + " Hz" : "--";
    const randomNorm = state.chaos > 0 ? clamp(debug.random / (state.chaos * 0.2), 0, 1) : 0;
    const threshold = typeof debug.threshold === "number" ? debug.threshold : 1;

    return (
      "<article class=\"" + cardClass + "\">" +
      "<div class=\"eq-live-head\">" +
      "<span class=\"eq-live-title\"><span class=\"" + triggerLedClass + "\"></span>" + inst.name + " :: " + eq.name + "</span>" +
      "<span>step " + debug.step + "</span>" +
      "</div>" +
      "<div class=\"eq-live-formula\">" + eq.formula + "</div>" +
      equationBar("raw", debug.raw) +
      equationBar("fractal", debug.fractal) +
      equationBar("random", debug.random, randomNorm) +
      equationBar("output", debug.combined) +
      "<div class=\"eq-live-meta\">" +
      "threshold=" + threshold.toFixed(3) + " | pulse=" + (debug.deterministicPulse ? "yes" : "no") + " | gate=" + (debug.trigger ? "on" : "off") + "\n" +
      "freq=" + frequencyText + " | reason=" + debug.triggerReason + "\n" +
      debug.detailText +
      "</div>" +
      "</article>"
    );
  });

  dom.equationLiveGrid.innerHTML = cards.join("");
}
