import { audio } from "../audio/engine.js";
import { MAX_VOICES } from "../config/constants.js";
import { state } from "../core/state.js";
import { dom } from "./dom.js";

function statusItem(key, value, tone) {
  const item = document.createElement("span");
  item.className = "st-item" + (tone ? " st-" + tone : "");
  const k = document.createElement("span");
  k.className = "st-k";
  k.textContent = key;
  const v = document.createElement("span");
  v.className = "st-v";
  v.textContent = value;
  item.append(k, v);
  return item;
}

export function refreshEngineStatus() {
  const voices = audio.ready ? audio.activeVoices : 0;
  const maxVoices = MAX_VOICES[state.performanceMode];
  const wetLayers = state.instruments.filter(function (inst) {
    return inst.fx && (inst.fx.delayEnabled || inst.fx.reverbEnabled || Number(inst.fx.sendAmount) > 0.01);
  }).length;
  const learnLabel = state.midi.learnArmed
    ? "armado"
    : (state.midi.padLearnInstrumentId ? "pad" : "off");
  const viewLabel = state.graphsOnly
    ? (state.demoTech ? "demo+tech" : "demo")
    : "studio";

  dom.engineStatus.replaceChildren(
    statusItem("power", state.powered ? "on" : "off", state.powered ? "ok" : "mute"),
    statusItem("bpm", state.bpm.toFixed(0)),
    statusItem("estilo", state.music.style + (state.compose.chord ? " " + state.compose.chord.name : "")),
    statusItem("modo", state.performanceMode),
    statusItem("vozes", voices + "/" + maxVoices),
    statusItem("fx", (state.fx.enabled ? "on" : "off") + " · " + wetLayers + " wet", state.fx.enabled ? null : "mute"),
    statusItem("midi", state.midi.connected ? "linked" : "none", state.midi.connected ? "ok" : "mute"),
    statusItem("learn", learnLabel, learnLabel === "off" ? "mute" : "warn"),
    statusItem("clock", state.midi.clockSyncEnabled ? "sync" : "off", state.midi.clockSyncEnabled ? "ok" : "mute"),
    statusItem("view", viewLabel)
  );
}
