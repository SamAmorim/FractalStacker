import { harmonicPartialWeight } from "../algorithms/harmonics.js";
import { audio } from "./engine.js";
import { state } from "../core/state.js";

const WAVE_CACHE_LIMIT = 384;
const EQ_STEPS = 48;
const waveCache = new Map();

function createHarmonicPeriodicWave(inst, equationValue, variant) {
  const harmonicCount = state.performanceMode === "eco" ? 8 : state.performanceMode === "balanced" ? 14 : 20;
  const real = new Float32Array(harmonicCount + 1);
  const imag = new Float32Array(harmonicCount + 1);
  let norm = 0;

  for (let harmonic = 1; harmonic <= harmonicCount; harmonic += 1) {
    const weight = harmonicPartialWeight(inst, equationValue, harmonic, variant);
    const angle = harmonic * (0.23 + inst.harmonicMix * 0.95 + equationValue * 0.47 + variant * 0.31);
    real[harmonic] = weight * Math.sin(angle);
    imag[harmonic] = weight * Math.cos(angle);
    norm += Math.abs(weight);
  }

  const normalize = Math.max(0.0001, norm);
  for (let harmonic = 1; harmonic <= harmonicCount; harmonic += 1) {
    real[harmonic] /= normalize;
    imag[harmonic] /= normalize;
  }

  return audio.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

// PeriodicWave tables are expensive to build on the main thread; equation values
// are quantized so recurring timbres reuse the same wave.
function getHarmonicPeriodicWave(inst, equationValue, variant) {
  const eq = Math.round(Math.min(1, Math.max(0, Number(equationValue) || 0)) * EQ_STEPS) / EQ_STEPS;
  const key = inst.id + "|" + state.performanceMode + "|" + eq + "|" + variant.toFixed(2) + "|" +
    inst.harmonicMix.toFixed(2) + "|" + inst.harmonicTilt.toFixed(2) + "|" + inst.seedOffset;
  let wave = waveCache.get(key);
  if (!wave) {
    if (waveCache.size >= WAVE_CACHE_LIMIT) {
      waveCache.delete(waveCache.keys().next().value);
    }
    wave = createHarmonicPeriodicWave(inst, eq, variant);
    waveCache.set(key, wave);
  }
  return wave;
}

export function createHarmonicOscillator(inst, when, frequency, equationValue, variant, detuneCents) {
  const osc = audio.ctx.createOscillator();
  osc.setPeriodicWave(getHarmonicPeriodicWave(inst, equationValue, variant));
  osc.frequency.setValueAtTime(Math.max(20, frequency), when);
  osc.detune.setValueAtTime(detuneCents, when);
  return osc;
}
