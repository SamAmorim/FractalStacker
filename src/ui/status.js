import { audio } from "../audio/engine.js";
import { MAX_VOICES } from "../config/constants.js";
import { state } from "../core/state.js";
import { dom } from "./dom.js";

export function refreshEngineStatus() {
  const powerLabel = state.powered ? "ON" : "OFF";
  const mode = state.performanceMode.toUpperCase();
  const voices = audio.ready ? audio.activeVoices : 0;
  const maxVoices = MAX_VOICES[state.performanceMode];
  const fxLabel = state.fx.enabled ? "FX preview on" : "FX preview off";
  const midiLabel = state.midi.connected ? "MIDI linked" : "MIDI none";
  const learnLabel = state.midi.learnArmed ? "cc-learn" : (state.midi.padLearnInstrumentId ? "pad-learn" : "learn-off");
  const viewLabel = state.graphsOnly ? "view graphs" : "view studio";
  dom.engineStatus.textContent =
    "Power " +
    powerLabel +
    " | BPM " +
    state.bpm.toFixed(0) +
    " | " +
    state.music.style +
    (state.compose.chord ? " " + state.compose.chord.name : "") +
    " | mode " +
    mode +
    " | voices " +
    voices +
    "/" +
    maxVoices +
    " | " +
    fxLabel +
    " | " +
      midiLabel +
      " | " +
      learnLabel +
      " | " +
      viewLabel;
}
