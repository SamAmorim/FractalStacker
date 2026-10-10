import { EQUATIONS } from "../algorithms/equations/index.js";
import { updateInstrumentMix } from "../audio/buses.js";
import { STYLE_PRESETS } from "../config/styles.js";
import { clamp } from "../core/math.js";
import { getInstrumentById, state } from "../core/state.js";
import { applyFxParams } from "../effects/fx-chain.js";
import { isValidToneRow, normalizeToneRow, resetDodecaphonicSequence } from "../theory/dodecaphonic.js";
import { setControlValue } from "../ui/controls.js";
import {
  renderEquationLibrary,
  renderEquationLiveInspector,
  renderEquationMonitor
} from "../ui/equation-panel.js";
import { renderPerformanceHud } from "../ui/hud.js";
import { renderInstrumentRack } from "../ui/instrument-rack.js";
import { appendLog } from "../ui/log.js";
import { renderMidiMappingStatus } from "../ui/midi-panel.js";
import { sceneStatusMessage, setSceneStatus, syncSceneUiFromState } from "../ui/scenes-panel.js";
import { refreshEngineStatus } from "../ui/status.js";

const SCENE_STORAGE_KEY = "fractalstacker.liveScenes.v1";

const SCENE_SLOTS = ["A", "B", "C"];

export function sanitizeSceneSlot(slot) {
  const normalized = String(slot || "").toUpperCase();
  return SCENE_SLOTS.indexOf(normalized) >= 0 ? normalized : SCENE_SLOTS[0];
}

export function getSceneBlendTimeConstant(defaultTau) {
  const fallback = Math.max(0.005, Number(defaultTau) || 0.02);
  if (Date.now() < state.sceneTransition.untilMs) {
    return Math.max(fallback, state.sceneTransition.timeConstant || fallback);
  }
  return fallback;
}

function armSceneTransition(seconds) {
  const sec = clamp(Number(seconds) || 0, 0, 4);
  if (sec <= 0.001) {
    state.sceneTransition.untilMs = 0;
    state.sceneTransition.timeConstant = 0.006;
    return;
  }
  state.sceneTransition.untilMs = Date.now() + sec * 1000 + 240;
  state.sceneTransition.timeConstant = clamp(sec * 0.35, 0.02, 0.9);
}

function isValidSceneSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }
  if (!snapshot.transport || !snapshot.fx || !snapshot.envelope || !Array.isArray(snapshot.instruments)) {
    return false;
  }
  return true;
}

function createSceneSnapshot(slot) {
  const safeSlot = sanitizeSceneSlot(slot);
  return {
    schema: "fractalstacker.scene",
    version: 1,
    slot: safeSlot,
    updatedAt: new Date().toISOString(),
    transport: {
      bpm: state.bpm,
      rootHz: state.rootHz,
      globalDetune: state.globalDetune,
      fractalDepth: state.fractalDepth,
      chaos: state.chaos,
      swing: state.swing,
      microtonalCents: state.microtonalCents,
      masterVolume: state.masterVolume,
      scale: state.scale,
      performanceMode: state.performanceMode
    },
    envelope: {
      attack: state.envelope.attack,
      decay: state.envelope.decay,
      sustain: state.envelope.sustain,
      release: state.envelope.release
    },
    fx: {
      enabled: state.fx.enabled,
      wahEnabled: state.fx.wahEnabled,
      delayEnabled: state.fx.delayEnabled,
      reverbEnabled: state.fx.reverbEnabled,
      wahRate: state.fx.wahRate,
      wahDepth: state.fx.wahDepth,
      delayTime: state.fx.delayTime,
      delayFeedback: state.fx.delayFeedback,
      delayMix: state.fx.delayMix,
      reverbAmount: state.fx.reverbAmount
    },
    music: Object.assign({}, state.music),
    instruments: state.instruments.map(function (inst) {
      return {
        id: inst.id,
        enabled: inst.enabled,
        equation: inst.equation,
        volume: inst.volume,
        pan: inst.pan,
        density: inst.density,
        harmonicMix: inst.harmonicMix,
        harmonicTilt: inst.harmonicTilt,
        detune: inst.detune,
        octave: inst.octave
      };
    }),
    graph: {
      plotInstrumentId: state.plotInstrumentId,
      plotAutoCycle: state.plotAutoCycle,
      plotCycleUnit: state.plotCycleUnit,
      plotCycleBars: state.plotCycleBars,
      plotFrozen: state.plotFrozen
    },
    dodecaphonic: {
      row: state.dodecaphonic.row.slice(),
      positions: Object.assign({}, state.dodecaphonic.positions)
    }
  };
}

export function persistScenes() {
  try {
    if (typeof window.localStorage === "undefined") {
      return false;
    }

    const payload = {
      schema: "fractalstacker.scenes",
      version: 1,
      updatedAt: new Date().toISOString(),
      selectedSlot: state.scenes.selectedSlot,
      quantize: state.scenes.quantize,
      transitionSec: state.scenes.transitionSec,
      slots: state.scenes.slots
    };
    window.localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    setSceneStatus("Erro ao salvar scenes: " + error.message, true);
    return false;
  }
}

export function loadScenes() {
  syncSceneUiFromState();

  try {
    if (typeof window.localStorage === "undefined") {
      setSceneStatus(sceneStatusMessage(state.scenes.selectedSlot), false);
      return;
    }

    const raw = window.localStorage.getItem(SCENE_STORAGE_KEY);
    if (!raw) {
      setSceneStatus(sceneStatusMessage(state.scenes.selectedSlot), false);
      return;
    }

    const payload = JSON.parse(raw);
    if (!payload || payload.version !== 1 || !payload.slots) {
      setSceneStatus("Storage de scenes invalido (schema divergente).", true);
      return;
    }

    state.scenes.selectedSlot = sanitizeSceneSlot(payload.selectedSlot || state.scenes.selectedSlot);
    state.scenes.quantize = payload.quantize === "immediate" || payload.quantize === "beat" || payload.quantize === "bar"
      ? payload.quantize
      : state.scenes.quantize;
    state.scenes.transitionSec = clamp(Number(payload.transitionSec) || state.scenes.transitionSec, 0, 4);

    SCENE_SLOTS.forEach(function (slot) {
      const snapshot = payload.slots[slot];
      state.scenes.slots[slot] = isValidSceneSnapshot(snapshot) ? snapshot : null;
    });

    syncSceneUiFromState();
    setSceneStatus("Scenes carregadas do storage local.", false);
  } catch (error) {
    setSceneStatus("Erro ao carregar scenes: " + error.message, true);
  }
}

export function setSelectedSceneSlot(slot, showStatus) {
  state.scenes.selectedSlot = sanitizeSceneSlot(slot);
  syncSceneUiFromState();
  persistScenes();
  renderMidiMappingStatus();
  if (showStatus !== false) {
    setSceneStatus(sceneStatusMessage(state.scenes.selectedSlot), false);
  }
}

export function shiftSceneSlot(direction) {
  const currentIndex = SCENE_SLOTS.indexOf(sanitizeSceneSlot(state.scenes.selectedSlot));
  const nextIndex = (currentIndex + direction + SCENE_SLOTS.length) % SCENE_SLOTS.length;
  setSelectedSceneSlot(SCENE_SLOTS[nextIndex], true);
}

export function saveSceneSlot(slot, sourceLabel) {
  const safeSlot = sanitizeSceneSlot(slot || state.scenes.selectedSlot);
  const snapshot = createSceneSnapshot(safeSlot);
  state.scenes.slots[safeSlot] = snapshot;
  setSelectedSceneSlot(safeSlot, false);
  persistScenes();
  setSceneStatus("Cena " + safeSlot + " salva via " + sourceLabel + " (JSON v1).", false);
  appendLog("scene " + safeSlot + " saved (" + sourceLabel + ")");
  return true;
}

function applySceneSnapshot(snapshot, slot, sourceLabel) {
  if (!isValidSceneSnapshot(snapshot)) {
    setSceneStatus("Cena " + sanitizeSceneSlot(slot) + " invalida.", true);
    return false;
  }

  armSceneTransition(state.scenes.transitionSec);

  const transport = snapshot.transport || {};
  setControlValue("bpm", transport.bpm);
  setControlValue("rootHz", transport.rootHz);
  setControlValue("globalDetune", transport.globalDetune);
  setControlValue("fractalDepth", transport.fractalDepth);
  setControlValue("chaos", transport.chaos);
  setControlValue("swing", transport.swing);
  setControlValue("microtonal", transport.microtonalCents);
  setControlValue("masterVolume", transport.masterVolume);
  setControlValue("scaleSelect", transport.scale);
  setControlValue("performanceMode", transport.performanceMode);

  const envelope = snapshot.envelope || {};
  setControlValue("envAttack", envelope.attack);
  setControlValue("envDecay", envelope.decay);
  setControlValue("envSustain", envelope.sustain);
  setControlValue("envRelease", envelope.release);

  const fx = snapshot.fx || {};
  setControlValue("fxEnabled", fx.enabled);
  setControlValue("wahEnabled", fx.wahEnabled);
  setControlValue("delayEnabled", fx.delayEnabled);
  setControlValue("reverbEnabled", fx.reverbEnabled);
  setControlValue("wahRate", fx.wahRate);
  setControlValue("wahDepth", fx.wahDepth);
  setControlValue("delayTime", fx.delayTime);
  setControlValue("delayFeedback", fx.delayFeedback);
  setControlValue("delayMix", fx.delayMix);
  setControlValue("reverbAmount", fx.reverbAmount);

  const music = snapshot.music;
  if (music) {
    if (STYLE_PRESETS[music.style] && music.style !== state.music.style) {
      setControlValue("styleSelect", music.style);
    }
    setControlValue("autoForm", music.autoForm);
    setControlValue("harmonicRhythm", music.harmonicRhythm);
    setControlValue("complexity", music.complexity);
    setControlValue("energy", music.energy);
    setControlValue("motifMemory", music.motifMemory);
    setControlValue("humanize", music.humanize);
    setControlValue("sidechain", music.sidechain);
    setControlValue("arpPattern", music.arpPattern);
    setControlValue("arpRate", music.arpRate);
    setControlValue("arpOctaves", music.arpOctaves);
    if (Number.isFinite(music.seed) && music.seed !== state.music.seed) {
      state.music.seed = music.seed;
      state.compose.progressionPhrase = -1;
      state.compose.progressionBank = {};
      state.compose.motifBank = {};
      state.compose.motifPhrase = -1;
    }
  }

  const byId = {};
  snapshot.instruments.forEach(function (item) {
    if (item && item.id) {
      byId[item.id] = item;
    }
  });

  state.instruments.forEach(function (inst) {
    const next = byId[inst.id];
    if (!next) {
      return;
    }

    const nextVolume = Number(next.volume);
    const nextPan = Number(next.pan);
    const nextDensity = Number(next.density);
    const nextHarmonicMix = Number(next.harmonicMix);
    const nextHarmonicTilt = Number(next.harmonicTilt);
    const nextDetune = Number(next.detune);
    const nextOctave = Number(next.octave);

    inst.enabled = typeof next.enabled === "boolean" ? next.enabled : inst.enabled;
    if (next.equation && EQUATIONS[next.equation]) {
      inst.equation = next.equation;
    }
    inst.volume = Number.isFinite(nextVolume) ? clamp(nextVolume, 0, 1) : inst.volume;
    inst.pan = Number.isFinite(nextPan) ? clamp(nextPan, -1, 1) : inst.pan;
    inst.density = Number.isFinite(nextDensity) ? clamp(nextDensity, 0, 1) : inst.density;
    inst.harmonicMix = Number.isFinite(nextHarmonicMix) ? clamp(nextHarmonicMix, 0, 1) : inst.harmonicMix;
    inst.harmonicTilt = Number.isFinite(nextHarmonicTilt) ? clamp(nextHarmonicTilt, 0, 1) : inst.harmonicTilt;
    inst.detune = Number.isFinite(nextDetune) ? clamp(nextDetune, -60, 60) : inst.detune;
    inst.octave = Number.isFinite(nextOctave) ? clamp(Math.round(nextOctave), -3, 3) : inst.octave;
    updateInstrumentMix(inst);
  });

  if (snapshot.graph) {
    setControlValue("autoPlotCycle", snapshot.graph.plotAutoCycle);
    setControlValue("plotCycleUnit", snapshot.graph.plotCycleUnit);
    setControlValue("plotCycleBars", snapshot.graph.plotCycleBars);
    setControlValue("freezePlotInstrument", snapshot.graph.plotFrozen);

    if (snapshot.graph.plotInstrumentId && getInstrumentById(snapshot.graph.plotInstrumentId)) {
      setControlValue("eqPlotInstrument", snapshot.graph.plotInstrumentId);
    }
  }

  if (snapshot.dodecaphonic && isValidToneRow(snapshot.dodecaphonic.row)) {
    state.dodecaphonic.row = normalizeToneRow(snapshot.dodecaphonic.row);
    state.dodecaphonic.positions = Object.assign({}, snapshot.dodecaphonic.positions || {});
  } else if (state.scale === "dodecaphonicRow") {
    resetDodecaphonicSequence();
  }

  renderInstrumentRack();
  renderEquationLibrary();
  renderEquationMonitor();
  renderEquationLiveInspector();
  renderPerformanceHud();
  refreshEngineStatus();
  applyFxParams();

  const source = sourceLabel || "manual";
  setSceneStatus("Cena " + sanitizeSceneSlot(slot) + " aplicada via " + source + ".", false);
  appendLog("scene " + sanitizeSceneSlot(slot) + " applied (" + source + ")");
  return true;
}

export function queueSceneRecall(slot, sourceLabel) {
  const safeSlot = sanitizeSceneSlot(slot || state.scenes.selectedSlot);
  const snapshot = state.scenes.slots[safeSlot];
  if (!snapshot) {
    setSceneStatus("Cena " + safeSlot + " vazia, nao ha recall.", true);
    return false;
  }

  const quantize = state.scenes.quantize;
  const source = sourceLabel || "manual";

  if (!state.powered || quantize === "immediate") {
    state.scenes.pendingRecall = null;
    return applySceneSnapshot(snapshot, safeSlot, source + " immediate");
  }

  state.scenes.pendingRecall = {
    slot: safeSlot,
    snapshot: snapshot,
    quantize: quantize,
    sourceLabel: source,
    requestedAt: Date.now()
  };

  const target = quantize === "beat" ? "proximo beat" : "proximo compasso";
  setSceneStatus("Cena " + safeSlot + " armada para " + target + ".", false);
  appendLog("scene " + safeSlot + " queued (" + quantize + ")");
  return true;
}

export function processPendingSceneRecall(step, isBeatStart, isBarStart) {
  const pending = state.scenes.pendingRecall;
  if (!pending) {
    return;
  }

  let shouldApply = false;
  if (pending.quantize === "beat") {
    shouldApply = isBeatStart;
  } else if (pending.quantize === "bar") {
    shouldApply = isBarStart;
  } else {
    shouldApply = true;
  }

  if (!shouldApply) {
    return;
  }

  state.scenes.pendingRecall = null;
  applySceneSnapshot(pending.snapshot, pending.slot, pending.sourceLabel + " q:" + pending.quantize + " s:" + step);
}
