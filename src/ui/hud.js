import { clamp } from "../core/math.js";
import { state } from "../core/state.js";
import {
  refreshTempoTrend,
  updateAudioMonitorSnapshot,
  updateGoldenRatioMonitor,
  updateKeyMonitor
} from "../monitor/analysis.js";
import { renderProgression } from "./compose-panel.js";
import { dom } from "./dom.js";
import { drawPhiSpiral } from "../visuals/phi-spiral.js";

function setHudMeter(fillEl, valueEl, normalized) {
  if (!fillEl || !valueEl) {
    return;
  }
  const ratio = clamp(normalized, 0, 1);
  fillEl.style.width = (ratio * 100).toFixed(0) + "%";
  fillEl.classList.toggle("hot", ratio > 0.82);
  valueEl.textContent = (ratio * 100).toFixed(0) + "%";
}

function renderHudStepStrip() {
  if (!dom.hudStepStrip) {
    return;
  }

  const stepInBar = state.scheduler.currentStep % 16;
  const cells = [];
  for (let i = 0; i < 16; i += 1) {
    let className = "hud-step";
    if (i % 4 === 0) {
      className += " beat";
    }
    if (i === stepInBar) {
      className += " current";
    }
    cells.push("<span class=\"" + className + "\"></span>");
  }
  dom.hudStepStrip.innerHTML = cells.join("");
}

export function renderPerformanceHud() {
  if (!dom.performanceHud) {
    return;
  }

  refreshTempoTrend();
  updateAudioMonitorSnapshot();
  updateKeyMonitor();
  updateGoldenRatioMonitor();

  const stepInBar = state.scheduler.currentStep % 16;
  const beatInBar = Math.floor(stepInBar / 4) + 1;
  const barNumber = Math.floor(state.scheduler.currentStep / 16) + 1;
  const delta = state.monitor.bpmDelta;
  const signedDelta = (delta > 0 ? "+" : "") + delta.toFixed(1);

  if (dom.hudTempo) {
    const trend = Math.abs(delta) > 0.05 && state.monitor.trend !== "Estavel" ? " | " + signedDelta : "";
    dom.hudTempo.textContent = state.bpm.toFixed(1) + " BPM | 4/4" + trend;
  }
  if (dom.hudBarBeat) {
    dom.hudBarBeat.textContent = "Compasso " + barNumber + " | Beat " + beatInBar + "/4 | Step " + (stepInBar + 1) + "/16";
  }
  if (dom.hudHarmony) {
    const compose = state.compose;
    dom.hudHarmony.textContent = compose.chord
      ? compose.chord.name + " > " + (compose.nextChord ? compose.nextChord.name : "--")
      : (state.powered ? "livre" : "--");
    dom.hudHarmony.title = compose.section;
  }
  if (dom.hudKey) {
    dom.hudKey.textContent = state.monitor.keyStatus + " | " + state.monitor.keyCents.toFixed(1) + " ct";
  }

  if (dom.hudClip) {
    let clipText = "SAFE";
    if (state.monitor.clipping) {
      clipText = "CLIP";
    } else if (state.monitor.peak > 0.9) {
      clipText = "ALTO";
    }
    dom.hudClip.textContent = clipText;
    dom.hudClip.classList.toggle("alert", clipText !== "SAFE");
    dom.hudClip.classList.toggle("safe", clipText === "SAFE");
  }

  if (dom.hudPhi) {
    dom.hudPhi.textContent = state.monitor.phiText;
    dom.hudPhi.classList.toggle("phi-hit", state.monitor.phiClass === "phi-hit");
    dom.hudPhi.classList.toggle("phi-near", state.monitor.phiClass === "phi-near");
  }

  drawPhiSpiral();

  setHudMeter(dom.hudLowFill, dom.hudLowValue, state.monitor.low);
  setHudMeter(dom.hudMidFill, dom.hudMidValue, state.monitor.mid);
  setHudMeter(dom.hudHighFill, dom.hudHighValue, state.monitor.high);
  setHudMeter(dom.hudPeakFill, dom.hudPeakValue, state.monitor.peak);

  if (dom.hudAdvice) {
    const speedTag = state.bpm >= 150 ? "Rapido" : state.bpm <= 85 ? "Lento" : "Moderado";
    dom.hudAdvice.textContent =
      state.monitor.advice +
      " | Velocidade: " +
      speedTag +
      " | MIDI: " +
      (state.midi.connected ? "ON" : "OFF");
  }

  renderHudStepStrip();
  renderProgression();
}
