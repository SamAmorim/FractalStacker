import { EQUATIONS } from "../algorithms/equations/index.js";
import { updateInstrumentMix } from "../audio/buses.js";
import { clamp } from "../core/math.js";
import { state } from "../core/state.js";
import { setMidiLearnArmed, tagMappableControls } from "../midi/learn.js";
import { dom } from "./dom.js";
import {
  renderEquationLibrary,
  renderEquationLiveInspector,
  renderEquationMonitor
} from "./equation-panel.js";
import { appendLog } from "./log.js";
import { renderMidiMappingStatus } from "./midi-panel.js";
import { renderPlotInstrumentOptions } from "./plot-target.js";

function instrumentControlId(instId, field) {
  return "inst-" + instId + "-" + field;
}

function getPadMappingForInstrument(instId) {
  const mapped = Object.keys(state.midi.padMap).find(function (noteNumber) {
    return state.midi.padMap[noteNumber] === instId;
  });
  return mapped || null;
}

function instrumentControlBlock(inst) {
  const eqOptions = Object.keys(EQUATIONS)
    .map(function (key) {
      const selected = inst.equation === key ? " selected" : "";
      return "<option value=\"" + key + "\"" + selected + ">" + EQUATIONS[key].name + "</option>";
    })
    .join("");

  const enabledId = instrumentControlId(inst.id, "enabled");
  const eqId = instrumentControlId(inst.id, "equation");
  const volumeId = instrumentControlId(inst.id, "volume");
  const panId = instrumentControlId(inst.id, "pan");
  const densityId = instrumentControlId(inst.id, "density");
  const harmonicMixId = instrumentControlId(inst.id, "harmonicMix");
  const harmonicTiltId = instrumentControlId(inst.id, "harmonicTilt");
  const detuneId = instrumentControlId(inst.id, "detune");
  const octaveId = instrumentControlId(inst.id, "octave");
  const padLearnActive = state.midi.padLearnInstrumentId === inst.id;
  const padMapped = getPadMappingForInstrument(inst.id);
  const padText = padMapped ? "pad note " + padMapped : "pad --";

  function rangeInput(id, field, min, max, step, value, label) {
    const fill = (clamp((value - min) / (max - min), 0, 1) * 100).toFixed(1);
    return (
      "<input id=\"" + id + "\" data-midi-map=\"" + id + "\" type=\"range\" min=\"" + min + "\" max=\"" + max +
      "\" step=\"" + step + "\" value=\"" + value + "\" data-field=\"" + field + "\" style=\"--fill:" + fill + "%\"" +
      (label ? " aria-label=\"" + label + "\"" : "") + ">"
    );
  }

  function rangeControl(id, field, label, valueText, min, max, step, value) {
    return (
      "<div class=\"control\">" +
      "<label for=\"" + id + "\">" + label + " <span class=\"value\" data-value=\"" + field + "\">" + valueText + "</span></label>" +
      rangeInput(id, field, min, max, step, value) +
      "</div>"
    );
  }

  return (
    "<article class=\"inst-row\" data-inst=\"" + inst.id + "\">" +
    "<header class=\"inst-head\">" +
    "<div class=\"inst-meta\">" +
    "<div class=\"inst-name\">" + inst.name + "</div>" +
    "<div class=\"inst-type\">" + inst.type + "</div>" +
    "</div>" +
    "<label class=\"inst-toggle\"><input id=\"" + enabledId + "\" data-midi-map=\"" + enabledId + "\" type=\"checkbox\" data-field=\"enabled\"" + (inst.enabled ? " checked" : "") + "> On</label>" +
    "</header>" +
    "<div class=\"inst-body\">" +
    "<div class=\"control span-2\">" +
    "<label for=\"" + eqId + "\">Equation</label>" +
    "<select id=\"" + eqId + "\" data-midi-map=\"" + eqId + "\" data-field=\"equation\">" + eqOptions + "</select>" +
    "</div>" +
    rangeControl(volumeId, "volume", "Volume", inst.volume.toFixed(2), 0, 1, 0.01, inst.volume) +
    rangeControl(panId, "pan", "Pan", inst.pan.toFixed(2), -1, 1, 0.01, inst.pan) +
    rangeControl(densityId, "density", "Density", inst.density.toFixed(2), 0, 1, 0.01, inst.density) +
    rangeControl(harmonicMixId, "harmonicMix", "Harm Mix", inst.harmonicMix.toFixed(2), 0, 1, 0.01, inst.harmonicMix) +
    rangeControl(harmonicTiltId, "harmonicTilt", "Harm Tilt", inst.harmonicTilt.toFixed(2), 0, 1, 0.01, inst.harmonicTilt) +
    "<div class=\"control\">" +
    "<label for=\"" + detuneId + "\">Detune/Oct <span class=\"value\" data-value=\"detune\">" + inst.detune.toFixed(0) + " ct, oct " + inst.octave + "</span></label>" +
    rangeInput(detuneId, "detune", -60, 60, 1, inst.detune) +
    rangeInput(octaveId, "octave", -3, 3, 1, inst.octave, inst.name + " octave") +
    "</div>" +
    "</div>" +
    "<footer class=\"inst-foot\">" +
    "<button type=\"button\" class=\"pad-learn-btn" + (padLearnActive ? " on" : "") + "\" data-pad-learn=\"" + inst.id + "\">Assign Pad</button>" +
    "<div class=\"inst-pad-map\" data-pad-label=\"" + inst.id + "\">" + padText + "</div>" +
    "</footer>" +
    "</article>"
  );
}

export function renderInstrumentRack() {
  dom.instrumentRack.innerHTML = state.instruments.map(instrumentControlBlock).join("");
  Array.from(dom.instrumentRack.querySelectorAll(".inst-row")).forEach(function (row) {
    const instId = row.getAttribute("data-inst");
    const inst = state.instruments.find(function (item) {
      return item.id === instId;
    });
    if (!inst) {
      return;
    }

    Array.from(row.querySelectorAll("[data-field]")).forEach(function (input) {
      const field = input.getAttribute("data-field");
      input.addEventListener("input", function (event) {
        if (field === "enabled") {
          inst.enabled = event.target.checked;
        } else if (field === "equation") {
          inst.equation = event.target.value;
        } else if (field === "octave") {
          inst.octave = Number(event.target.value);
        } else if (field === "detune") {
          inst.detune = Number(event.target.value);
        } else if (
          field === "volume" ||
          field === "density" ||
          field === "pan" ||
          field === "harmonicMix" ||
          field === "harmonicTilt"
        ) {
          inst[field] = Number(event.target.value);
        }
        updateInstrumentMix(inst);
        updateInstrumentRowValues(row, inst);
        renderEquationMonitor();
        renderEquationLibrary();
        renderEquationLiveInspector();
        renderMidiMappingStatus();
      });

      if (input.type === "checkbox") {
        input.addEventListener("change", function (event) {
          inst.enabled = event.target.checked;
          updateInstrumentMix(inst);
          renderEquationMonitor();
          renderEquationLiveInspector();
          renderMidiMappingStatus();
        });
      }

      if (input.tagName === "SELECT") {
        input.addEventListener("change", function (event) {
          inst.equation = event.target.value;
          renderEquationMonitor();
          renderEquationLibrary();
          renderEquationLiveInspector();
          renderMidiMappingStatus();
        });
      }
    });

    updateInstrumentRowValues(row, inst);

    const padLearnBtn = row.querySelector("[data-pad-learn]");
    if (padLearnBtn) {
      padLearnBtn.addEventListener("click", function () {
        state.midi.padLearnInstrumentId = inst.id;
        setMidiLearnArmed(false);
        renderInstrumentRack();
        renderMidiMappingStatus();
        appendLog("pad learn -> " + inst.name + " (toque um pad MIDI)");
      });
    }
  });

  tagMappableControls();
  renderPlotInstrumentOptions();
  renderMidiMappingStatus();
}

function updateInstrumentRowValues(row, inst) {
  const volumeValue = row.querySelector("[data-value='volume']");
  const panValue = row.querySelector("[data-value='pan']");
  const densityValue = row.querySelector("[data-value='density']");
  const harmonicMixValue = row.querySelector("[data-value='harmonicMix']");
  const harmonicTiltValue = row.querySelector("[data-value='harmonicTilt']");
  const detuneValue = row.querySelector("[data-value='detune']");
  if (volumeValue) {
    volumeValue.textContent = inst.volume.toFixed(2);
  }
  if (panValue) {
    panValue.textContent = inst.pan.toFixed(2);
  }
  if (densityValue) {
    densityValue.textContent = inst.density.toFixed(2);
  }
  if (harmonicMixValue) {
    harmonicMixValue.textContent = inst.harmonicMix.toFixed(2);
  }
  if (harmonicTiltValue) {
    harmonicTiltValue.textContent = inst.harmonicTilt.toFixed(2);
  }
  if (detuneValue) {
    detuneValue.textContent = inst.detune.toFixed(0) + " ct, oct " + inst.octave;
  }
}
