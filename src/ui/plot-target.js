import { PHI_SENSITIVITY_PRESETS } from "../config/constants.js";
import { clamp } from "../core/math.js";
import { getInstrumentById, state } from "../core/state.js";
import { dom } from "./dom.js";
import { renderPerformanceHud } from "./hud.js";
import { drawEquationCartesian, drawHarmonicCartesian } from "../visuals/cartesian.js";
import { drawChannelRack } from "../visuals/channel-rack.js";

export function getSelectedPlotInstrument() {
  let selected = getInstrumentById(state.plotInstrumentId);
  if (!selected && state.instruments.length) {
    selected = state.instruments[0];
    state.plotInstrumentId = selected.id;
  }
  return selected;
}

export function renderPlotInstrumentOptions() {
  if (!dom.eqPlotInstrument) {
    return;
  }

  const options = state.instruments.map(function (inst) {
    const selected = inst.id === state.plotInstrumentId ? " selected" : "";
    return "<option value=\"" + inst.id + "\"" + selected + ">" + inst.name + "</option>";
  });
  dom.eqPlotInstrument.innerHTML = options.join("");

  const selected = getSelectedPlotInstrument();
  if (selected) {
    dom.eqPlotInstrument.value = selected.id;
    if (dom.eqPlotInstrumentVal) {
      dom.eqPlotInstrumentVal.textContent = selected.name;
    }
  }
}

function updatePlotCycleBarsLabel() {
  if (!dom.plotCycleBarsVal) {
    return;
  }
  const interval = Math.max(1, Math.round(state.plotCycleBars || 1));
  const unit = state.plotCycleUnit === "beat" ? (interval === 1 ? "beat" : "beats") : (interval === 1 ? "compasso" : "compassos");
  dom.plotCycleBarsVal.textContent = "a cada " + interval + " " + unit;
}

function syncGraphToolbarState() {
  const cycleLocked = state.plotFrozen || !state.plotAutoCycle;

  if (dom.autoPlotCycle) {
    dom.autoPlotCycle.disabled = !!state.plotFrozen;
  }
  if (dom.plotCycleUnit) {
    dom.plotCycleUnit.disabled = cycleLocked;
  }
  if (dom.plotCycleBars) {
    dom.plotCycleBars.disabled = cycleLocked;
  }
}

function setPlotInstrument(instId) {
  const next = getInstrumentById(instId);
  if (!next) {
    return;
  }

  state.plotInstrumentId = next.id;
  renderPlotInstrumentOptions();
  drawEquationCartesian();
  drawHarmonicCartesian();
  drawChannelRack();
  renderPerformanceHud();
}

export function advancePlotInstrument() {
  if (!state.instruments.length || state.plotFrozen) {
    return;
  }

  let currentIndex = state.instruments.findIndex(function (inst) {
    return inst.id === state.plotInstrumentId;
  });
  if (currentIndex < 0) {
    currentIndex = 0;
  }

  const next = state.instruments[(currentIndex + 1) % state.instruments.length];
  setPlotInstrument(next.id);
}

export function bindGraphControls() {
  if (dom.eqPlotInstrument) {
    dom.eqPlotInstrument.addEventListener("change", function (event) {
      setPlotInstrument(event.target.value);
    });
  }

  if (dom.autoPlotCycle) {
    dom.autoPlotCycle.checked = !!state.plotAutoCycle;
    dom.autoPlotCycle.addEventListener("change", function (event) {
      state.plotAutoCycle = !!event.target.checked;
      state.lastPlotCyclePulse = -1;
      updatePlotCycleBarsLabel();
      syncGraphToolbarState();
    });
  }

  if (dom.plotCycleUnit) {
    dom.plotCycleUnit.value = state.plotCycleUnit;
    dom.plotCycleUnit.addEventListener("change", function (event) {
      state.plotCycleUnit = event.target.value === "beat" ? "beat" : "bar";
      state.lastPlotCyclePulse = -1;
      updatePlotCycleBarsLabel();
      drawChannelRack();
    });
  }

  if (dom.plotCycleBars) {
    dom.plotCycleBars.value = String(state.plotCycleBars);
    dom.plotCycleBars.addEventListener("input", function (event) {
      const value = Number(event.target.value);
      state.plotCycleBars = clamp(Math.round(value), 1, 8);
      state.lastPlotCyclePulse = -1;
      updatePlotCycleBarsLabel();
    });
  }

  if (dom.freezePlotInstrument) {
    dom.freezePlotInstrument.checked = !!state.plotFrozen;
    dom.freezePlotInstrument.addEventListener("change", function (event) {
      state.plotFrozen = !!event.target.checked;
      state.lastPlotCyclePulse = -1;
      syncGraphToolbarState();
      drawChannelRack();
    });
  }

  if (dom.phiSensitivity) {
    dom.phiSensitivity.value = state.phiSensitivity;
    dom.phiSensitivity.addEventListener("change", function (event) {
      const selected = event.target.value;
      state.phiSensitivity = PHI_SENSITIVITY_PRESETS[selected] ? selected : "balanced";
      renderPerformanceHud();
    });
  }

  updatePlotCycleBarsLabel();
  syncGraphToolbarState();
}
