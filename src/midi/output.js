import { state } from "../core/state.js";

function getPreferredOutput() {
  if (!state.midi.access || !state.midi.ledFeedback) {
    return null;
  }
  const outputs = Array.from(state.midi.access.outputs.values());
  if (!outputs.length) {
    return null;
  }
  if (state.midi.selectedOutputId && state.midi.selectedOutputId !== "none") {
    const match = outputs.find(function (output) {
      return output.id === state.midi.selectedOutputId;
    });
    if (match) {
      return match;
    }
  }
  return outputs[0];
}

export function sendPadLed(noteNumber, on) {
  const output = getPreferredOutput();
  if (!output) {
    return;
  }
  const note = clampNote(noteNumber);
  try {
    if (on) {
      output.send([0x90, note, 100]);
    } else {
      output.send([0x80, note, 0]);
    }
  } catch (error) {
    // Ignore disconnected outputs.
  }
}

function clampNote(noteNumber) {
  const note = Number(noteNumber) || 0;
  return Math.max(0, Math.min(127, Math.round(note)));
}

export function refreshPadLeds() {
  if (!state.midi.ledFeedback || !state.midi.access) {
    return;
  }
  Object.keys(state.midi.padMap || {}).forEach(function (note) {
    const instId = state.midi.padMap[note];
    const inst = state.instruments.find(function (item) {
      return item.id === instId;
    });
    sendPadLed(note, inst ? inst.enabled : false);
  });
}
