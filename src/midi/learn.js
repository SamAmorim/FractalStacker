import { DEFAULT_MIDI_CONTROL_MAP } from "../config/midi-defaults.js";
import { state } from "../core/state.js";
import { dom } from "../ui/dom.js";
import { renderInstrumentRack } from "../ui/instrument-rack.js";
import { appendLog } from "../ui/log.js";
import { renderMidiMappingStatus } from "../ui/midi-panel.js";

export function tagMappableControls() {
  const controls = document.querySelectorAll("input, select");
  controls.forEach(function (control) {
    if (control.id) {
      control.setAttribute("data-midi-map", control.id);
    }
  });
  updateMidiLearnTargetStyles();
}

function updateMidiLearnTargetStyles() {
  Array.from(document.querySelectorAll("[data-midi-map]"))
    .forEach(function (control) {
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

  Object.keys(state.midi.ccMap).forEach(function (cc) {
    mapped[state.midi.ccMap[cc]] = true;
  });

  return Object.keys(mapped).sort();
}

export function setMidiLearnArmed(isArmed) {
  state.midi.learnArmed = Boolean(isArmed);
  if (!state.midi.learnArmed) {
    state.midi.pendingTargetId = null;
  }

  if (dom.midiLearnBtn) {
    dom.midiLearnBtn.classList.toggle("on", state.midi.learnArmed);
    dom.midiLearnBtn.textContent = state.midi.learnArmed ? "MIDI Learn: Click Param" : "MIDI Learn: Off";
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
    dom.midiLearnBtn.textContent = "MIDI Learn: Move Knob";
  }
  updateMidiLearnTargetStyles();
  renderMidiMappingStatus();
  appendLog("midi learn target -> " + controlId);
}

export function clearMidiMappings() {
  state.midi.ccMap = {};
  state.midi.padMap = {};
  state.midi.pendingTargetId = null;
  state.midi.padLearnInstrumentId = null;
  setMidiLearnArmed(false);
  renderInstrumentRack();
  renderMidiMappingStatus();
  appendLog("midi maps cleared");
}
