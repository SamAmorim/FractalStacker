import { audio } from "../audio/engine.js";
import { PHI, PHI_SENSITIVITY_PRESETS } from "../config/constants.js";
import { SCALE_LIBRARY } from "../config/scales.js";
import { clamp } from "../core/math.js";
import { state } from "../core/state.js";

function nearestScaleCentsDistance(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return 0;
  }

  const intervals = SCALE_LIBRARY[state.scale].intervals;
  let best = Infinity;

  for (let octave = -5; octave <= 6; octave += 1) {
    for (let i = 0; i < intervals.length; i += 1) {
      const semitone = intervals[i] + octave * 12;
      const reference = state.rootHz * Math.pow(2, semitone / 12);
      if (!Number.isFinite(reference) || reference <= 0) {
        continue;
      }
      const cents = Math.abs(1200 * Math.log2(frequency / reference));
      if (cents < best) {
        best = cents;
      }
    }
  }

  return Number.isFinite(best) ? best : 0;
}

export function updateKeyMonitor() {
  const minStep = state.scheduler.currentStep - 64;
  state.monitor.recentFrequencies = state.monitor.recentFrequencies.filter(function (entry) {
    return entry.step >= minStep;
  });

  if (!state.monitor.recentFrequencies.length) {
    state.monitor.keyStatus = "Aguardando notas";
    state.monitor.keyCents = 0;
    return;
  }

  const recent = state.monitor.recentFrequencies.slice(-10);
  let centsSum = 0;
  recent.forEach(function (entry) {
    centsSum += nearestScaleCentsDistance(entry.frequency);
  });
  const avgCents = centsSum / Math.max(1, recent.length);
  state.monitor.keyCents = avgCents;

  if (avgCents <= 16) {
    state.monitor.keyStatus = "No tom";
    return;
  }

  if (avgCents <= 34) {
    state.monitor.keyStatus = Math.abs(state.microtonalCents) > 8 ? "Microtonal" : "Quase no tom";
    return;
  }

  state.monitor.keyStatus = "Fora do tom";
}

export function updateGoldenRatioMonitor() {
  const byInstrument = {};
  const recent = state.monitor.recentFrequencies.slice(-32);
  recent.forEach(function (entry) {
    if (entry && entry.instId && Number.isFinite(entry.frequency) && entry.frequency > 0) {
      byInstrument[entry.instId] = entry.frequency;
    }
  });

  const active = state.instruments.map(function (inst) {
    const runtime = state.equationDebug[inst.id];
    const runtimeFreq = runtime && Number.isFinite(runtime.frequency) ? runtime.frequency : 0;
    const frequency = runtimeFreq > 0 ? runtimeFreq : byInstrument[inst.id];
    return {
      name: inst.name,
      frequency: frequency
    };
  }).filter(function (entry) {
    return Number.isFinite(entry.frequency) && entry.frequency > 0;
  });

  if (active.length < 2) {
    state.monitor.phiText = "--";
    state.monitor.phiClass = "";
    state.monitor.phiRatio = PHI;
    state.monitor.phiDiff = Infinity;
    return;
  }

  let best = null;
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const hi = Math.max(active[i].frequency, active[j].frequency);
      const lo = Math.min(active[i].frequency, active[j].frequency);
      if (lo <= 0) {
        continue;
      }
      const ratio = hi / lo;
      const diff = Math.abs(ratio - PHI);
      if (!best || diff < best.diff) {
        best = {
          a: active[i].name,
          b: active[j].name,
          ratio: ratio,
          diff: diff
        };
      }
    }
  }

  if (!best) {
    state.monitor.phiText = "--";
    state.monitor.phiClass = "";
    state.monitor.phiRatio = PHI;
    state.monitor.phiDiff = Infinity;
    return;
  }

  state.monitor.phiRatio = best.ratio;
  state.monitor.phiDiff = best.diff;

  const phiPreset = PHI_SENSITIVITY_PRESETS[state.phiSensitivity] || PHI_SENSITIVITY_PRESETS.balanced;

  if (best.diff <= phiPreset.hit) {
    state.monitor.phiText = best.a + "/" + best.b + " " + best.ratio.toFixed(3) + " phi";
    state.monitor.phiClass = "phi-hit";
    return;
  }

  if (best.diff <= phiPreset.near) {
    state.monitor.phiText = "Quase phi " + best.a + "/" + best.b + " " + best.ratio.toFixed(3);
    state.monitor.phiClass = "phi-near";
    return;
  }

  state.monitor.phiText = "Distante phi " + best.ratio.toFixed(3);
  state.monitor.phiClass = "";
}

function bandAverage(minHz, maxHz) {
  if (!audio.ctx || !audio.meterFreqData || !audio.meterFreqData.length) {
    return 0;
  }

  const nyquist = audio.ctx.sampleRate * 0.5;
  const binCount = audio.meterFreqData.length;
  const start = clamp(Math.floor((minHz / nyquist) * binCount), 0, binCount - 1);
  const end = clamp(Math.floor((maxHz / nyquist) * binCount), start, binCount - 1);

  let sum = 0;
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    sum += audio.meterFreqData[i] / 255;
    count += 1;
  }

  return count ? sum / count : 0;
}

export function updateAudioMonitorSnapshot() {
  if (!audio.ready || !audio.meterAnalyser || !audio.meterTimeData || !audio.meterFreqData) {
    state.monitor.peak = 0;
    state.monitor.low = 0;
    state.monitor.mid = 0;
    state.monitor.high = 0;
    state.monitor.clipping = false;
    state.monitor.advice = "Power off: sem leitura de audio.";
    return;
  }

  audio.meterAnalyser.getFloatTimeDomainData(audio.meterTimeData);
  audio.meterAnalyser.getByteFrequencyData(audio.meterFreqData);

  let peak = 0;
  for (let i = 0; i < audio.meterTimeData.length; i += 1) {
    peak = Math.max(peak, Math.abs(audio.meterTimeData[i]));
  }

  const now = Date.now();
  if (peak >= 0.985) {
    state.monitor.clipHoldUntil = now + 900;
  }

  state.monitor.peak = peak;
  state.monitor.clipping = now < state.monitor.clipHoldUntil;
  state.monitor.low = bandAverage(20, 180);
  state.monitor.mid = bandAverage(180, 2200);
  state.monitor.high = bandAverage(2200, 9000);

  const tips = [];
  if (state.monitor.low < 0.18) {
    tips.push("Falta grave");
  }
  if (state.monitor.mid < 0.18) {
    tips.push("Falta medio");
  }
  if (state.monitor.high < 0.15) {
    tips.push("Falta agudo");
  }
  if (state.monitor.low > 0.78 && state.monitor.mid < 0.32) {
    tips.push("Grave dominando");
  }
  if (state.monitor.high > 0.82) {
    tips.push("Agudo agressivo");
  }
  if (peak > 0.93) {
    tips.push("Headroom baixo");
  }
  state.monitor.advice = tips.length ? tips.join(" | ") : "Mix equilibrado.";
}

export function refreshTempoTrend() {
  const elapsed = Date.now() - state.monitor.lastBpmChangeAt;
  if (elapsed > 2800) {
    state.monitor.bpmDelta = 0;
    state.monitor.trend = "Estavel";
  }
}
