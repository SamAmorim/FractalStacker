import { DEFAULT_MIDI_CONTROL_MAP } from "../config/midi-defaults.js";
import { state } from "../core/state.js";
import { dom } from "../ui/dom.js";
import { renderInstrumentRack } from "../ui/instrument-rack.js";
import { appendLog } from "../ui/log.js";
import { renderMidiMappingStatus } from "../ui/midi-panel.js";
import { persistMidiMaps } from "./storage.js";

const MIDI_BUTTON_IDS = [
  "powerBtn",
  "sceneSaveBtn",
  "sceneRecallBtn",
  "scenePrevBtn",
  "sceneNextBtn",
  "reharmonizeBtn",
  "graphFocusBtn"
];

export function tagMappableControls() {
  document.querySelectorAll("input, select").forEach(function (control) {
    if (control.id && !control.closest(".midi-panel")) {
      control.setAttribute("data-midi-map", control.id);
    }
  });

  MIDI_BUTTON_IDS.forEach(function (id) {
    const button = document.getElementById(id);
    if (button) {
      button.setAttribute("data-midi-map", id);
    }
  });

  updateMidiLearnTargetStyles();
}

function updateMidiLearnTargetStyles() {
  Array.from(document.querySelectorAll("[data-midi-map]")).forEach(function (control) {
    control.classList.remove("midi-learn-target");
  });

  if (!state.midi.pendingTargetId) {
    return;
  }

  const target = document.getElementById(state.midi.pendingTargetId);
  if (target) {
    target.classList.add("midi-learn-target");
  }
}

export function formatMidiMapLine(cc, targetId, source) {
  return "CC" + cc + " -> " + targetId + " [" + source + "]";
}

export function getControlDisplayValue(controlId) {
  const control = document.getElementById(controlId);
  if (!control) {
    return "n/a";
  }

  if (control.tagName === "BUTTON") {
    if (controlId === "powerBtn") {
      return state.powered ? "PLAY/ON" : "STOP/OFF";
    }
    return control.textContent.trim() || controlId;
  }

  if (control.tagName === "SELECT") {
    const option = control.options[control.selectedIndex];
    return option ? option.text : control.value;
  }

  if (control.type === "checkbox") {
    return control.checked ? "ON" : "OFF";
  }

  return String(control.value);
}

export function collectMappedControlIds() {
  const mapped = {};

  if (state.midi.defaultMapEnabled) {
    Object.keys(DEFAULT_MIDI_CONTROL_MAP).forEach(function (cc) {
      mapped[DEFAULT_MIDI_CONTROL_MAP[cc]] = true;
    });
  }

  Object.keys(state.midi.ccMap || {}).forEach(function (cc) {
    mapped[state.midi.ccMap[cc]] = true;
  });

  Object.keys(state.midi.noteMap || {}).forEach(function (note) {
    mapped[state.midi.noteMap[note]] = true;
  });

  if (state.midi.pitchBendTarget) {
    mapped[state.midi.pitchBendTarget] = true;
  }
  if (state.midi.aftertouchTarget) {
    mapped[state.midi.aftertouchTarget] = true;
  }

  return Object.keys(mapped).sort();
}

export function cancelMidiLearn() {
  const wasLearning = state.midi.learnArmed || state.midi.padLearnInstrumentId;
  state.midi.learnArmed = false;
  state.midi.pendingTargetId = null;
  state.midi.padLearnInstrumentId = null;
  if (dom.midiLearnBtn) {
    dom.midiLearnBtn.classList.remove("on");
    dom.midiLearnBtn.textContent = "Learn";
    dom.midiLearnBtn.setAttribute("aria-pressed", "false");
  }
  updateMidiLearnTargetStyles();
  if (wasLearning) {
    renderInstrumentRack();
    renderMidiMappingStatus();
    appendLog("midi learn cancelado");
  }
}

export function setMidiLearnArmed(isArmed) {
  state.midi.learnArmed = Boolean(isArmed);
  if (!state.midi.learnArmed) {
    state.midi.pendingTargetId = null;
  } else {
    state.midi.padLearnInstrumentId = null;
  }

  if (dom.midiLearnBtn) {
    dom.midiLearnBtn.classList.toggle("on", state.midi.learnArmed);
    dom.midiLearnBtn.textContent = state.midi.learnArmed ? "Learn: alvo" : "Learn";
    dom.midiLearnBtn.setAttribute("aria-pressed", state.midi.learnArmed ? "true" : "false");
  }

  updateMidiLearnTargetStyles();
  renderMidiMappingStatus();
}

export function setMidiLearnTarget(controlId) {
  if (!state.midi.learnArmed) {
    return;
  }

  state.midi.pendingTargetId = controlId;
  if (dom.midiLearnBtn) {
    dom.midiLearnBtn.textContent = "Learn: toque";
  }
  updateMidiLearnTargetStyles();
  renderMidiMappingStatus();
  appendLog("midi learn -> " + controlId + " (tecla, pad, botao, knob, pitch bend ou aftertouch)");
}

export function clearMidiMappings() {
  state.midi.ccMap = {};
  state.midi.noteMap = {};
  state.midi.padMap = {};
  state.midi.modes = {};
  state.midi.pitchBendTarget = null;
  state.midi.aftertouchTarget = null;
  state.midi.pendingTargetId = null;
  state.midi.padLearnInstrumentId = null;
  setMidiLearnArmed(false);
  persistMidiMaps();
  renderInstrumentRack();
  renderMidiMappingStatus();
  appendLog("midi maps cleared");
}
