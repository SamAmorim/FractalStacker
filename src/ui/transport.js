import { audio, ensureAudio, hardSilence, restoreMasterLevel } from "../audio/engine.js";
import { killAllVoices } from "../audio/voices.js";
import { state } from "../core/state.js";
import { initMidi } from "../midi/input.js";
import { clearMidiMappings, setMidiLearnArmed, setMidiLearnTarget } from "../midi/learn.js";
import { startScheduler, stopScheduler } from "../sequencer/scheduler.js";
import { dom } from "./dom.js";
import { renderPerformanceHud } from "./hud.js";
import { renderInstrumentRack } from "./instrument-rack.js";
import { appendLog } from "./log.js";
import { refreshEngineStatus } from "./status.js";
import { drawEquationCartesian, drawHarmonicCartesian } from "../visuals/cartesian.js";
import { drawChannelRack } from "../visuals/channel-rack.js";

export function setGraphsOnlyMode(enabled, silent) {
  state.graphsOnly = Boolean(enabled);
  document.body.classList.toggle("graphs-only", state.graphsOnly);
  if (state.graphsOnly) {
    window.scrollTo(0, 0);
  }

  if (dom.graphFocusBtn) {
    dom.graphFocusBtn.classList.toggle("on", state.graphsOnly);
    dom.graphFocusBtn.textContent = state.graphsOnly ? "Voltar Studio" : "Modo Graficos";
    dom.graphFocusBtn.setAttribute("aria-pressed", state.graphsOnly ? "true" : "false");
  }

  drawEquationCartesian();
  drawHarmonicCartesian();
  drawChannelRack();
  renderPerformanceHud();

  if (!silent) {
    appendLog(state.graphsOnly ? "modo graficos ON" : "modo graficos OFF");
  }
}

export async function togglePower() {
  await ensureAudio();

  if (!state.powered) {
    restoreMasterLevel();
    await audio.ctx.resume();
    state.powered = true;
    dom.powerBtn.textContent = "Power Off";
    dom.powerBtn.classList.add("on");
    dom.powerBtn.setAttribute("aria-pressed", "true");
    appendLog("engine started");
    startScheduler();
  } else {
    state.powered = false;
    stopScheduler();
    state.scenes.pendingRecall = null;
    killAllVoices();
    hardSilence();
    await audio.ctx.suspend();
    dom.powerBtn.textContent = "Power On";
    dom.powerBtn.classList.remove("on");
    dom.powerBtn.setAttribute("aria-pressed", "false");
    appendLog("engine stopped");
  }

  refreshEngineStatus();
}

function runTogglePower() {
  togglePower().catch(function (error) {
    appendLog("power error: " + error.message);
    refreshEngineStatus();
  });
}

export function bindButtons() {
  dom.powerBtn.addEventListener("click", runTogglePower);

  dom.midiBtn.addEventListener("click", function () {
    initMidi();
  });

  dom.midiLearnBtn.addEventListener("click", function () {
    state.midi.padLearnInstrumentId = null;
    setMidiLearnArmed(!state.midi.learnArmed);
    renderInstrumentRack();
  });

  dom.midiClearBtn.addEventListener("click", function () {
    clearMidiMappings();
  });

  if (dom.graphFocusBtn) {
    dom.graphFocusBtn.addEventListener("click", function () {
      setGraphsOnlyMode(!state.graphsOnly);
      refreshEngineStatus();
    });
  }

  document.addEventListener("keydown", function (event) {
    const tag = (event.target && event.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      return;
    }

    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      runTogglePower();
      return;
    }

    if (event.key === "g" || event.key === "G") {
      event.preventDefault();
      setGraphsOnlyMode(!state.graphsOnly);
      refreshEngineStatus();
      return;
    }

    if (event.key === "Escape" && state.graphsOnly) {
      setGraphsOnlyMode(false);
      refreshEngineStatus();
    }
  });

  document.addEventListener("click", function (event) {
    if (!state.midi.learnArmed) {
      return;
    }

    const mappedControl = event.target.closest("[data-midi-map]");
    if (!mappedControl) {
      return;
    }

    const controlId = mappedControl.getAttribute("data-midi-map");
    if (controlId) {
      setMidiLearnTarget(controlId);
    }
  });
}
