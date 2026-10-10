import {
  PAD_BPM_PRESETS,
  SCENE_MIDI_RECALL_MAP,
  SCENE_MIDI_SAVE_MAP
} from "../config/midi-defaults.js";
import { state } from "../core/state.js";
import { persistMidiMaps } from "./storage.js";

export function modeKey(kind, code) {
  return kind + ":" + code;
}

export function inferDefaultMode(targetId, source) {
  const control = document.getElementById(targetId);
  if (!control) {
    return "absolute";
  }
  if (control.tagName === "BUTTON") {
    return "click";
  }
  if (control.type === "checkbox") {
    return source === "cc" ? "momentary" : "toggle";
  }
  if (targetId === "bpm" && (source === "note" || source === "key")) {
    return "tap";
  }
  return "absolute";
}

export function getBindingMode(kind, code, targetId, source) {
  const key = modeKey(kind, code);
  if (state.midi.modes && state.midi.modes[key]) {
    return state.midi.modes[key];
  }
  return inferDefaultMode(targetId, source || kind);
}

export function setBindingMode(kind, code, mode) {
  if (!state.midi.modes) {
    state.midi.modes = {};
  }
  state.midi.modes[modeKey(kind, code)] = mode;
  persistMidiMaps();
}

export function describeNoteConflicts(noteNumber) {
  const note = String(noteNumber);
  const conflicts = [];
  if (state.midi.noteMap[note]) {
    conflicts.push("noteMap -> " + state.midi.noteMap[note]);
  }
  if (state.midi.padMap[note]) {
    conflicts.push("pad -> " + state.midi.padMap[note]);
  }
  if (PAD_BPM_PRESETS[noteNumber]) {
    conflicts.push("factory BPM " + PAD_BPM_PRESETS[noteNumber]);
  }
  if (SCENE_MIDI_RECALL_MAP[noteNumber]) {
    conflicts.push("factory scene recall " + SCENE_MIDI_RECALL_MAP[noteNumber]);
  }
  if (SCENE_MIDI_SAVE_MAP[noteNumber]) {
    conflicts.push("factory scene save " + SCENE_MIDI_SAVE_MAP[noteNumber]);
  }
  return conflicts;
}

export function describeCcConflicts(cc) {
  const key = String(cc);
  const conflicts = [];
  if (state.midi.ccMap[key]) {
    conflicts.push("ccMap -> " + state.midi.ccMap[key]);
  }
  return conflicts;
}

/** Claim a note for a new binding; clears other maps on that note. */
export function claimNote(noteNumber, kind, targetId) {
  const note = String(noteNumber);
  const conflicts = describeNoteConflicts(noteNumber);
  delete state.midi.noteMap[note];
  delete state.midi.padMap[note];
  delete state.midi.modes[modeKey("note", note)];
  delete state.midi.modes[modeKey("pad", note)];

  if (kind === "pad") {
    state.midi.padMap[note] = targetId;
    state.midi.modes[modeKey("pad", note)] = "toggle";
  } else {
    state.midi.noteMap[note] = targetId;
    state.midi.modes[modeKey("note", note)] = inferDefaultMode(targetId, "note");
  }

  persistMidiMaps();
  return conflicts;
}

export function claimCc(cc, targetId) {
  const key = String(cc);
  const conflicts = describeCcConflicts(cc);
  state.midi.ccMap[key] = targetId;
  state.midi.modes[modeKey("cc", key)] = inferDefaultMode(targetId, "cc");
  persistMidiMaps();
  return conflicts;
}

export function removeBinding(kind, code) {
  const key = String(code);
  if (kind === "cc") {
    delete state.midi.ccMap[key];
  } else if (kind === "note") {
    delete state.midi.noteMap[key];
  } else if (kind === "pad") {
    delete state.midi.padMap[key];
  } else if (kind === "pb") {
    state.midi.pitchBendTarget = null;
  } else if (kind === "at") {
    state.midi.aftertouchTarget = null;
  }
  delete state.midi.modes[modeKey(kind, key)];
  persistMidiMaps();
}

export function listBindings() {
  const rows = [];

  Object.keys(state.midi.ccMap || {}).sort(function (a, b) {
    return Number(a) - Number(b);
  }).forEach(function (cc) {
    rows.push({
      kind: "cc",
      code: cc,
      label: "CC " + cc,
      target: state.midi.ccMap[cc],
      mode: getBindingMode("cc", cc, state.midi.ccMap[cc], "cc")
    });
  });

  Object.keys(state.midi.noteMap || {}).sort(function (a, b) {
    return Number(a) - Number(b);
  }).forEach(function (note) {
    rows.push({
      kind: "note",
      code: note,
      label: "NOTE " + note,
      target: state.midi.noteMap[note],
      mode: getBindingMode("note", note, state.midi.noteMap[note], "note")
    });
  });

  Object.keys(state.midi.padMap || {}).sort(function (a, b) {
    return Number(a) - Number(b);
  }).forEach(function (note) {
    rows.push({
      kind: "pad",
      code: note,
      label: "PAD " + note,
      target: state.midi.padMap[note],
      mode: "toggle"
    });
  });

  if (state.midi.pitchBendTarget) {
    rows.push({
      kind: "pb",
      code: "pb",
      label: "PITCH BEND",
      target: state.midi.pitchBendTarget,
      mode: "absolute"
    });
  }

  if (state.midi.aftertouchTarget) {
    rows.push({
      kind: "at",
      code: "at",
      label: "AFTERTOUCH",
      target: state.midi.aftertouchTarget,
      mode: "absolute"
    });
  }

  return rows;
}

export const MODE_OPTIONS = ["absolute", "relative", "toggle", "momentary", "tap", "click"];
