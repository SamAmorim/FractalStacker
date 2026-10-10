import { state } from "../core/state.js";

export const MIDI_STORAGE_KEY = "fractalstacker.midi.v1";

export function serializeMidiMaps() {
  return {
    schema: "fractalstacker.midi",
    version: 1,
    updatedAt: new Date().toISOString(),
    ccMap: Object.assign({}, state.midi.ccMap || {}),
    noteMap: Object.assign({}, state.midi.noteMap || {}),
    padMap: Object.assign({}, state.midi.padMap || {}),
    modes: Object.assign({}, state.midi.modes || {}),
    pitchBendTarget: state.midi.pitchBendTarget || null,
    aftertouchTarget: state.midi.aftertouchTarget || null,
    defaultMapEnabled: Boolean(state.midi.defaultMapEnabled),
    factoryPresetsEnabled: Boolean(state.midi.factoryPresetsEnabled),
    clockSyncEnabled: Boolean(state.midi.clockSyncEnabled),
    channelFilter: Number(state.midi.channelFilter),
    embedInScenes: Boolean(state.midi.embedInScenes),
    ledFeedback: Boolean(state.midi.ledFeedback),
    selectedInputId: state.midi.selectedInputId || "all"
  };
}

export function applyMidiMapsPayload(payload, options) {
  const opts = options || {};
  if (!payload || typeof payload !== "object") {
    return false;
  }
  if (payload.schema && payload.schema !== "fractalstacker.midi") {
    return false;
  }

  if (payload.ccMap && typeof payload.ccMap === "object") {
    state.midi.ccMap = Object.assign({}, payload.ccMap);
  } else if (!opts.merge) {
    state.midi.ccMap = {};
  }

  if (payload.noteMap && typeof payload.noteMap === "object") {
    state.midi.noteMap = Object.assign({}, payload.noteMap);
  } else if (!opts.merge) {
    state.midi.noteMap = {};
  }

  if (payload.padMap && typeof payload.padMap === "object") {
    state.midi.padMap = Object.assign({}, payload.padMap);
  } else if (!opts.merge) {
    state.midi.padMap = {};
  }

  if (payload.modes && typeof payload.modes === "object") {
    state.midi.modes = Object.assign({}, payload.modes);
  } else if (!opts.merge) {
    state.midi.modes = {};
  }

  if ("pitchBendTarget" in payload) {
    state.midi.pitchBendTarget = payload.pitchBendTarget || null;
  }
  if ("aftertouchTarget" in payload) {
    state.midi.aftertouchTarget = payload.aftertouchTarget || null;
  }
  if ("defaultMapEnabled" in payload) {
    state.midi.defaultMapEnabled = Boolean(payload.defaultMapEnabled);
  }
  if ("factoryPresetsEnabled" in payload) {
    state.midi.factoryPresetsEnabled = Boolean(payload.factoryPresetsEnabled);
  }
  if ("clockSyncEnabled" in payload) {
    state.midi.clockSyncEnabled = Boolean(payload.clockSyncEnabled);
  }
  if ("channelFilter" in payload) {
    const ch = Number(payload.channelFilter);
    state.midi.channelFilter = Number.isFinite(ch) ? ch : -1;
  }
  if ("embedInScenes" in payload) {
    state.midi.embedInScenes = Boolean(payload.embedInScenes);
  }
  if ("ledFeedback" in payload) {
    state.midi.ledFeedback = Boolean(payload.ledFeedback);
  }
  if ("selectedInputId" in payload && payload.selectedInputId) {
    state.midi.selectedInputId = String(payload.selectedInputId);
  }

  return true;
}

export function persistMidiMaps() {
  try {
    if (typeof window.localStorage === "undefined") {
      return false;
    }
    window.localStorage.setItem(MIDI_STORAGE_KEY, JSON.stringify(serializeMidiMaps()));
    return true;
  } catch (error) {
    return false;
  }
}

export function loadMidiMaps() {
  try {
    if (typeof window.localStorage === "undefined") {
      return false;
    }
    const raw = window.localStorage.getItem(MIDI_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    return applyMidiMapsPayload(JSON.parse(raw));
  } catch (error) {
    return false;
  }
}

export function exportMidiMapsFile() {
  const blob = new Blob([JSON.stringify(serializeMidiMaps(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "fractalstacker-midi-maps.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function importMidiMapsFromText(text) {
  const payload = JSON.parse(text);
  if (!applyMidiMapsPayload(payload)) {
    throw new Error("JSON MIDI invalido");
  }
  persistMidiMaps();
  return true;
}
