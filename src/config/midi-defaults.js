export const DEFAULT_MIDI_CONTROL_MAP = {
  1: "bpm",
  2: "rootHz",
  3: "chaos",
  4: "fractalDepth",
  5: "globalDetune",
  6: "microtonal",
  7: "masterVolume",
  8: "energy",
  9: "complexity",
  10: "motifMemory",
  11: "humanize",
  12: "delayMix",
  13: "reverbAmount",
  14: "sidechain",
  15: "harmonicRhythm",
  16: "fxEnabled",
  17: "wahEnabled",
  18: "wahPosition",
  19: "delayEnabled",
  20: "fxSpace",
  21: "reverbSize",
  22: "delaySync"
};

// Pads sem learn: presets de BPM (notas graves tipicas de pad bank).
export const PAD_BPM_PRESETS = {
  36: 90,
  37: 112,
  38: 128,
  39: 140
};

export const SCENE_MIDI_RECALL_MAP = {
  60: "A",
  61: "B",
  62: "C"
};

export const SCENE_MIDI_SAVE_MAP = {
  72: "A",
  73: "B",
  74: "C"
};

/** Virtual MIDI targets that are not plain DOM controls. */
export const VIRTUAL_MIDI_TARGETS = {
  fxSpace: true
};
