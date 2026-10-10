import { audio } from "../audio/engine.js";
import { state } from "../core/state.js";
import { applyFxParams, applyFxSpaceMacro } from "../effects/fx-chain.js";
import { getSceneBlendTimeConstant } from "../scenes/scenes.js";
import { resetDodecaphonicSequence } from "../theory/dodecaphonic.js";
import { renderEquationLiveInspector, renderEquationMonitor } from "./equation-panel.js";
import { renderMidiMappingStatus } from "./midi-panel.js";
import { refreshEngineStatus } from "./status.js";

export function setControlValue(controlId, value) {
  const control = document.getElementById(controlId);
  if (!control) {
    return false;
  }

  if (control.type === "checkbox") {
    control.checked = Boolean(value);
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (control.tagName === "SELECT") {
    const targetValue = String(value);
    const hasOption = Array.from(control.options || []).some(function (option) {
      return option.value === targetValue;
    });
    if (!hasOption) {
      return false;
    }
    control.value = targetValue;
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  let numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return false;
  }

  const min = Number(control.min);
  const max = Number(control.max);
  const step = Number(control.step);

  if (Number.isFinite(min)) {
    numeric = Math.max(min, numeric);
  }
  if (Number.isFinite(max)) {
    numeric = Math.min(max, numeric);
  }
  if (Number.isFinite(step) && step > 0) {
    numeric = Math.round((numeric - (Number.isFinite(min) ? min : 0)) / step) * step + (Number.isFinite(min) ? min : 0);
  }

  control.value = String(numeric);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

export function bindRangeControl(id, valueId, formatter, callback) {
  const input = document.getElementById(id);
  const valueEl = document.getElementById(valueId);
  if (!input || !valueEl) {
    return;
  }

  const update = function () {
    const numeric = Number(input.value);
    callback(numeric);
    valueEl.textContent = formatter(numeric);
    refreshEngineStatus();
    renderEquationLiveInspector();
    renderMidiMappingStatus();
  };

  input.addEventListener("input", update);
  update();
}

export function bindGlobalControls() {
  bindRangeControl("bpm", "bpmVal", function (value) {
    return value.toFixed(0);
  }, function (value) {
    const previous = state.bpm;
    state.bpm = value;
    const delta = value - previous;
    if (Math.abs(delta) > 0.001) {
      state.monitor.bpmDelta = delta;
      state.monitor.lastBpmChangeAt = Date.now();
      state.monitor.trend = delta > 0 ? "Acelerando" : "Desacelerando";
      state.monitor.lastBpm = value;
    }
    applyFxParams();
  });

  bindRangeControl("rootHz", "rootHzVal", function (value) {
    return value.toFixed(0) + " Hz";
  }, function (value) {
    state.rootHz = value;
  });

  bindRangeControl("globalDetune", "globalDetuneVal", function (value) {
    return value.toFixed(0) + " cents";
  }, function (value) {
    state.globalDetune = value;
  });

  bindRangeControl("fractalDepth", "fractalDepthVal", function (value) {
    return value.toFixed(0);
  }, function (value) {
    state.fractalDepth = value;
  });

  bindRangeControl("chaos", "chaosVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    state.chaos = value;
  });

  bindRangeControl("swing", "swingVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    state.swing = value;
  });

  bindRangeControl("microtonal", "microtonalVal", function (value) {
    return value.toFixed(0) + " cents";
  }, function (value) {
    state.microtonalCents = value;
  });

  bindRangeControl("masterVolume", "masterVolumeVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    state.masterVolume = value;
    if (audio.masterGain) {
      audio.masterGain.gain.setTargetAtTime(value, audio.ctx.currentTime, getSceneBlendTimeConstant(0.02));
    }
  });

  bindRangeControl("envAttack", "envAttackVal", function (value) {
    return value.toFixed(3) + " s";
  }, function (value) {
    state.envelope.attack = value;
  });

  bindRangeControl("envDecay", "envDecayVal", function (value) {
    return value.toFixed(2) + " s";
  }, function (value) {
    state.envelope.decay = value;
  });

  bindRangeControl("envSustain", "envSustainVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    state.envelope.sustain = value;
  });

  bindRangeControl("envRelease", "envReleaseVal", function (value) {
    return value.toFixed(2) + " s";
  }, function (value) {
    state.envelope.release = value;
  });

  const scaleSelect = document.getElementById("scaleSelect");
  scaleSelect.addEventListener("change", function (event) {
    state.scale = event.target.value;
    if (state.scale === "dodecaphonicRow") {
      resetDodecaphonicSequence();
    }
    renderEquationMonitor();
    renderEquationLiveInspector();
  });

  const performanceMode = document.getElementById("performanceMode");
  performanceMode.addEventListener("change", function (event) {
    state.performanceMode = event.target.value;
    renderEquationMonitor();
    renderEquationLiveInspector();
    refreshEngineStatus();
  });
}

export function bindFxControls() {
  const fxEnabled = document.getElementById("fxEnabled");
  const wahEnabled = document.getElementById("wahEnabled");
  const delayEnabled = document.getElementById("delayEnabled");
  const reverbEnabled = document.getElementById("reverbEnabled");
  const delayPingPong = document.getElementById("delayPingPong");
  const wahMode = document.getElementById("wahMode");
  const delaySync = document.getElementById("delaySync");

  fxEnabled.checked = state.fx.enabled;
  wahEnabled.checked = state.fx.wahEnabled;
  delayEnabled.checked = state.fx.delayEnabled;
  reverbEnabled.checked = state.fx.reverbEnabled;
  if (delayPingPong) {
    delayPingPong.checked = Boolean(state.fx.delayPingPong);
  }
  if (wahMode) {
    wahMode.value = state.fx.wahMode === "expression" ? "expression" : "lfo";
  }
  if (delaySync) {
    delaySync.value = state.fx.delaySync || "off";
  }

  fxEnabled.addEventListener("change", function (event) {
    state.fx.enabled = event.target.checked;
    applyFxParams();
    refreshEngineStatus();
  });
  wahEnabled.addEventListener("change", function (event) {
    state.fx.wahEnabled = event.target.checked;
    applyFxParams();
  });
  delayEnabled.addEventListener("change", function (event) {
    state.fx.delayEnabled = event.target.checked;
    applyFxParams();
  });
  reverbEnabled.addEventListener("change", function (event) {
    state.fx.reverbEnabled = event.target.checked;
    applyFxParams();
  });
  if (delayPingPong) {
    delayPingPong.addEventListener("change", function (event) {
      state.fx.delayPingPong = event.target.checked;
      applyFxParams();
    });
  }
  if (wahMode) {
    wahMode.addEventListener("change", function (event) {
      state.fx.wahMode = event.target.value === "expression" ? "expression" : "lfo";
      applyFxParams();
    });
  }
  if (delaySync) {
    delaySync.addEventListener("change", function (event) {
      state.fx.delaySync = event.target.value || "off";
      applyFxParams();
    });
  }

  bindRangeControl("wahRate", "wahRateVal", function (value) {
    return value.toFixed(1) + " Hz";
  }, function (value) {
    state.fx.wahRate = value;
    applyFxParams();
  });

  bindRangeControl("wahDepth", "wahDepthVal", function (value) {
    return value.toFixed(0) + " Hz";
  }, function (value) {
    state.fx.wahDepth = value;
    applyFxParams();
  });

  bindRangeControl("wahPosition", "wahPositionVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    state.fx.wahPosition = value;
    applyFxParams();
  });

  bindRangeControl("delayTime", "delayTimeVal", function (value) {
    return value.toFixed(2) + " s";
  }, function (value) {
    state.fx.delayTime = value;
    applyFxParams();
  });

  bindRangeControl("delayFeedback", "delayFeedbackVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    state.fx.delayFeedback = value;
    applyFxParams();
  });

  bindRangeControl("delayMix", "delayMixVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    state.fx.delayMix = value;
    applyFxParams();
  });

  bindRangeControl("reverbAmount", "reverbAmountVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    state.fx.reverbAmount = value;
    applyFxParams();
  });

  bindRangeControl("reverbSize", "reverbSizeVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    state.fx.reverbSize = value;
    applyFxParams();
  });

  bindRangeControl("fxSpace", "fxSpaceVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    applyFxSpaceMacro(value);
  });
}
