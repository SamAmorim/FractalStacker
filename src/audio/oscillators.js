import { harmonicPartialWeight } from "../algorithms/harmonics.js";
import { audio } from "./engine.js";
import { state } from "../core/state.js";

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

export function createHarmonicOscillator(inst, when, frequency, equationValue, variant, detuneCents) {
  const osc = audio.ctx.createOscillator();
  const wave = createHarmonicPeriodicWave(inst, equationValue, variant);
  osc.setPeriodicWave(wave);
  osc.frequency.setValueAtTime(Math.max(20, frequency), when);
  osc.detune.setValueAtTime(detuneCents, when);
  return osc;
}
