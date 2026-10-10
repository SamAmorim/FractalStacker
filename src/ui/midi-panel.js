import { DEFAULT_MIDI_CONTROL_MAP } from "../config/midi-defaults.js";
import { state } from "../core/state.js";
import { collectMappedControlIds, formatMidiMapLine, getControlDisplayValue } from "../midi/learn.js";
import { dom } from "./dom.js";

export function renderMidiMappingStatus() {
  if (!dom.midiMapStatus) {
    return;
  }

  const lines = [];
  lines.push("MIDI LEARN: " + (state.midi.learnArmed ? "ARMED" : "OFF"));
  if (state.midi.pendingTargetId) {
    lines.push("Target selecionado: " + state.midi.pendingTargetId + " (gire um knob)");
  }
  lines.push("PAD LEARN: " + (state.midi.padLearnInstrumentId ? state.midi.padLearnInstrumentId.toUpperCase() : "OFF"));

  const padKeys = Object.keys(state.midi.padMap).sort(function (a, b) {
    return Number(a) - Number(b);
  });
  lines.push("");
  lines.push("Pad Map:");
  if (!padKeys.length) {
    lines.push("(nenhum pad mapeado)");
  } else {
    padKeys.forEach(function (noteNumber) {
      lines.push("Note " + noteNumber + " -> toggle " + state.midi.padMap[noteNumber]);
    });
  }

  lines.push("");
  lines.push("Scene Shortcuts (fixo):");
  lines.push("Recall A/B/C -> notes 60, 61, 62");
  lines.push("Save   A/B/C -> notes 72, 73, 74");

  const customKeys = Object.keys(state.midi.ccMap).sort(function (a, b) {
    return Number(a) - Number(b);
  });

  lines.push("");
  lines.push("Custom Map:");
  if (!customKeys.length) {
    lines.push("(nenhum ainda)");
  } else {
    customKeys.forEach(function (cc) {
      lines.push(formatMidiMapLine(cc, state.midi.ccMap[cc], "custom"));
    });
  }

  lines.push("");
  lines.push("Default Fallback:");
  Object.keys(DEFAULT_MIDI_CONTROL_MAP).forEach(function (cc) {
    lines.push(formatMidiMapLine(cc, DEFAULT_MIDI_CONTROL_MAP[cc], "default"));
  });

  const mappedControls = collectMappedControlIds();
  lines.push("");
  lines.push("Knobs Mapeados (valor atual):");
  if (!mappedControls.length) {
    lines.push("(nenhum mapeado)");
  } else {
    mappedControls.forEach(function (controlId) {
      lines.push(controlId + " = " + getControlDisplayValue(controlId));
    });
  }

  dom.midiMapStatus.textContent = lines.join("\n");
}
