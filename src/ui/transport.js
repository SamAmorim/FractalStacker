import { audio, ensureAudio, hardSilence, restoreMasterLevel } from "../audio/engine.js";
import { killAllVoices } from "../audio/voices.js";
import { state } from "../core/state.js";
import { initMidi } from "../midi/input.js";
import { cancelMidiLearn, clearMidiMappings, setMidiLearnArmed, setMidiLearnTarget } from "../midi/learn.js";
import { startScheduler, stopScheduler } from "../sequencer/scheduler.js";
import { applyFxOnlyFromScene } from "../scenes/scenes.js";
import { dom } from "./dom.js";
import { renderPerformanceHud } from "./hud.js";
import { renderInstrumentRack } from "./instrument-rack.js";
import { appendLog } from "./log.js";
import { refreshEngineStatus } from "./status.js";
import { drawEquationCartesian, drawHarmonicCartesian } from "../visuals/cartesian.js";
import { drawChannelRack } from "../visuals/channel-rack.js";
import { onDemoModeChanged } from "../visuals/demo-slides.js";

function syncDemoChrome() {
  if (dom.demoChrome) {
    dom.demoChrome.hidden = !state.graphsOnly;
  }
  document.body.classList.toggle("demo-tech", Boolean(state.graphsOnly && state.demoTech));
  if (dom.demoTechToggle) {
    dom.demoTechToggle.classList.toggle("on", Boolean(state.demoTech));
    dom.demoTechToggle.setAttribute("aria-pressed", state.demoTech ? "true" : "false");
    dom.demoTechToggle.textContent = state.demoTech ? "Tech On" : "Tech";
  }
  if (dom.demoChromeMeta) {
    const bpm = Math.round(state.bpm || 0);
    dom.demoChromeMeta.textContent = (state.demoTech ? "DEMO · TECH  " : "DEMO  ") + bpm + " BPM";
  }
}

export function setDemoTech(enabled, silent) {
  state.demoTech = Boolean(enabled);
  syncDemoChrome();
  if (!silent) {
    appendLog(state.demoTech ? "demo tech overlay ON" : "demo tech overlay OFF");
  }
  refreshEngineStatus();
}

export function setGraphsOnlyMode(enabled, silent) {
  state.graphsOnly = Boolean(enabled);
  document.body.classList.toggle("graphs-only", state.graphsOnly);
  if (!state.graphsOnly) {
    state.demoTech = false;
  }
  if (state.graphsOnly) {
    window.scrollTo(0, 0);
  }

  if (dom.graphFocusBtn) {
    dom.graphFocusBtn.classList.toggle("on", state.graphsOnly);
    dom.graphFocusBtn.textContent = state.graphsOnly ? "Studio" : "Modo Demo";
    dom.graphFocusBtn.setAttribute("aria-pressed", state.graphsOnly ? "true" : "false");
  }

  syncDemoChrome();
  onDemoModeChanged(state.graphsOnly);
  window.requestAnimationFrame(function () {
    drawEquationCartesian();
    drawHarmonicCartesian();
    drawChannelRack();
    renderPerformanceHud();
  });

  if (!silent) {
    appendLog(state.graphsOnly ? "modo demo ON (G sair · D tech)" : "modo demo OFF");
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
  syncDemoChrome();
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
    if (!window.confirm("Apagar todos os mapeamentos MIDI aprendidos?")) {
      return;
    }
    clearMidiMappings();
  });

  if (dom.graphFocusBtn) {
    dom.graphFocusBtn.addEventListener("click", function () {
      setGraphsOnlyMode(!state.graphsOnly);
      refreshEngineStatus();
    });
  }

  if (dom.demoExitBtn) {
    dom.demoExitBtn.addEventListener("click", function () {
      setGraphsOnlyMode(false);
      refreshEngineStatus();
    });
  }

  if (dom.demoTechToggle) {
    dom.demoTechToggle.addEventListener("click", function () {
      if (!state.graphsOnly) {
        return;
      }
      setDemoTech(!state.demoTech);
    });
  }

  if (dom.sceneRecallFxBtn) {
    dom.sceneRecallFxBtn.addEventListener("click", function () {
      applyFxOnlyFromScene(state.scenes.selectedSlot, "button");
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (state.midi.learnArmed || state.midi.padLearnInstrumentId) {
        event.preventDefault();
        cancelMidiLearn();
        return;
      }
      if (state.graphsOnly) {
        setGraphsOnlyMode(false);
        refreshEngineStatus();
      }
      return;
    }

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

    if ((event.key === "d" || event.key === "D") && state.graphsOnly) {
      event.preventDefault();
      setDemoTech(!state.demoTech);
    }
  });

  document.addEventListener("click", function (event) {
    if (!state.midi.learnArmed) {
      return;
    }

    if (event.target.closest(".midi-panel") || event.target.closest("#midiLearnBtn") || event.target.closest("#midiClearBtn") || event.target.closest(".demo-chrome")) {
      return;
    }

    const mappedControl = event.target.closest("[data-midi-map]");
    if (!mappedControl) {
      return;
    }

    const controlId = mappedControl.getAttribute("data-midi-map");
    if (!controlId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setMidiLearnTarget(controlId);
  }, true);

  syncDemoChrome();
}
