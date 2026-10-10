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
  const fx = inst.fx || {};
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
  const delayEnabledId = instrumentControlId(inst.id, "delayEnabled");
  const delaySyncId = instrumentControlId(inst.id, "delaySync");
  const delayPingPongId = instrumentControlId(inst.id, "delayPingPong");
  const delayTimeId = instrumentControlId(inst.id, "delayTime");
  const delayFeedbackId = instrumentControlId(inst.id, "delayFeedback");
  const delayMixId = instrumentControlId(inst.id, "delayMix");
  const reverbEnabledId = instrumentControlId(inst.id, "reverbEnabled");
  const reverbAmountId = instrumentControlId(inst.id, "reverbAmount");
  const reverbSizeId = instrumentControlId(inst.id, "reverbSize");
  const sendAmountId = instrumentControlId(inst.id, "sendAmount");
  const padLearnActive = state.midi.padLearnInstrumentId === inst.id;
  const padMapped = getPadMappingForInstrument(inst.id);
  const padText = padMapped ? "pad note " + padMapped + " (toggle)" : "pad --";

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
    "<div class=\"inst-fx span-2\">" +
    "<div class=\"inst-fx-title\">FX da camada</div>" +
    "<div class=\"inst-fx-grid\">" +
    "<label class=\"inst-toggle\"><input id=\"" + delayEnabledId + "\" data-midi-map=\"" + delayEnabledId + "\" type=\"checkbox\" data-field=\"delayEnabled\"" + (fx.delayEnabled ? " checked" : "") + "> Delay</label>" +
    "<div class=\"control\">" +
    "<label for=\"" + delaySyncId + "\">Dly Sync</label>" +
    "<select id=\"" + delaySyncId + "\" data-midi-map=\"" + delaySyncId + "\" data-field=\"delaySync\">" +
    "<option value=\"off\"" + ((fx.delaySync || "off") === "off" ? " selected" : "") + ">Free</option>" +
    "<option value=\"1/4\"" + (fx.delaySync === "1/4" ? " selected" : "") + ">1/4</option>" +
    "<option value=\"1/8\"" + (fx.delaySync === "1/8" ? " selected" : "") + ">1/8</option>" +
    "<option value=\"1/8d\"" + (fx.delaySync === "1/8d" ? " selected" : "") + ">1/8d</option>" +
    "<option value=\"1/16\"" + (fx.delaySync === "1/16" ? " selected" : "") + ">1/16</option>" +
    "</select></div>" +
    "<label class=\"inst-toggle\"><input id=\"" + delayPingPongId + "\" data-midi-map=\"" + delayPingPongId + "\" type=\"checkbox\" data-field=\"delayPingPong\"" + (fx.delayPingPong ? " checked" : "") + "> Ping-pong</label>" +
    rangeControl(delayTimeId, "delayTime", "Dly Time", Number(fx.delayTime || 0).toFixed(2) + " s", 0, 1.5, 0.01, fx.delayTime || 0) +
    rangeControl(delayFeedbackId, "delayFeedback", "Dly Fb", Number(fx.delayFeedback || 0).toFixed(2), 0, 0.95, 0.01, fx.delayFeedback || 0) +
    rangeControl(delayMixId, "delayMix", "Dly Mix", Number(fx.delayMix || 0).toFixed(2), 0, 1, 0.01, fx.delayMix || 0) +
    "<label class=\"inst-toggle\"><input id=\"" + reverbEnabledId + "\" data-midi-map=\"" + reverbEnabledId + "\" type=\"checkbox\" data-field=\"reverbEnabled\"" + (fx.reverbEnabled ? " checked" : "") + "> Reverb</label>" +
    rangeControl(reverbAmountId, "reverbAmount", "Rev Amt", Number(fx.reverbAmount || 0).toFixed(2), 0, 1, 0.01, fx.reverbAmount || 0) +
    rangeControl(reverbSizeId, "reverbSize", "Rev Size", Number(fx.reverbSize || 0.4).toFixed(2), 0, 1, 0.01, fx.reverbSize || 0.4) +
    rangeControl(sendAmountId, "sendAmount", "Send Rev", Number(fx.sendAmount || 0).toFixed(2), 0, 1, 0.01, fx.sendAmount || 0) +
    "</div>" +
    "</div>" +
    "</div>" +
    "<footer class=\"inst-foot\">" +
    "<button type=\"button\" class=\"pad-learn-btn" + (padLearnActive ? " on" : "") + "\" data-pad-learn=\"" + inst.id + "\">Assign Pad</button>" +
    "<div class=\"inst-pad-map\" data-pad-label=\"" + inst.id + "\">" + padText + "</div>" +
    "</footer>" +
    "</article>"
  );
}

const FX_FIELDS = {
  delayEnabled: true,
  delaySync: true,
  delayPingPong: true,
  delayTime: true,
  delayFeedback: true,
  delayMix: true,
  reverbEnabled: true,
  reverbAmount: true,
  reverbSize: true,
  sendAmount: true
};

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
    if (!inst.fx) {
      inst.fx = {};
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
        } else if (field === "delayEnabled" || field === "reverbEnabled" || field === "delayPingPong") {
          inst.fx[field] = event.target.checked;
        } else if (field === "delaySync") {
          inst.fx.delaySync = event.target.value || "off";
        } else if (FX_FIELDS[field]) {
          inst.fx[field] = Number(event.target.value);
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
          if (field === "enabled") {
            inst.enabled = event.target.checked;
          } else if (field === "delayEnabled" || field === "reverbEnabled") {
            inst.fx[field] = event.target.checked;
          }
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
        appendLog("pad learn -> " + inst.name + " (toque um pad para ligar/desligar)");
      });
    }
  });

  tagMappableControls();
  renderPlotInstrumentOptions();
  renderMidiMappingStatus();
}

function updateInstrumentRowValues(row, inst) {
  const fx = inst.fx || {};
  const setters = {
    volume: inst.volume.toFixed(2),
    pan: inst.pan.toFixed(2),
    density: inst.density.toFixed(2),
    harmonicMix: inst.harmonicMix.toFixed(2),
    harmonicTilt: inst.harmonicTilt.toFixed(2),
    detune: inst.detune.toFixed(0) + " ct, oct " + inst.octave,
    delayTime: Number(fx.delayTime || 0).toFixed(2) + " s",
    delayFeedback: Number(fx.delayFeedback || 0).toFixed(2),
    delayMix: Number(fx.delayMix || 0).toFixed(2),
    reverbAmount: Number(fx.reverbAmount || 0).toFixed(2),
    reverbSize: Number(fx.reverbSize || 0.4).toFixed(2),
    sendAmount: Number(fx.sendAmount || 0).toFixed(2)
  };

  Object.keys(setters).forEach(function (key) {
    const el = row.querySelector("[data-value='" + key + "']");
    if (el) {
      el.textContent = setters[key];
    }
  });
}
