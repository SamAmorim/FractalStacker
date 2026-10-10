import { clamp } from "../core/math.js";
import { state } from "../core/state.js";

export function harmonicPartialWeight(inst, equationValue, harmonicIndex, variant) {
  const mix = clamp(inst.harmonicMix, 0, 1);
  const tilt = clamp(inst.harmonicTilt, 0, 1);
  const exponent = 0.65 + (1 - tilt) * 2.35;
  const base = 1 / Math.pow(harmonicIndex, exponent);
  const fold = Math.abs(
    Math.sin(
      (equationValue * Math.PI * 2 + variant * 0.7) * harmonicIndex * (1 + mix * 1.8)
    )
  );
  const phaseCoupling = 0.68 + 0.32 * Math.abs(Math.cos((inst.seedOffset + variant * 13) * 0.11 * harmonicIndex));
  return base * (0.44 + fold * 0.56) * phaseCoupling;
}

export function sampleHarmonicWave(inst, xNorm, equationValue) {
  const x = clamp(xNorm, 0, 1);
  const eq = clamp(typeof equationValue === "number" ? equationValue : inst.lastValue, 0, 1);
  const harmonics = state.performanceMode === "eco" ? 8 : state.performanceMode === "balanced" ? 14 : 20;
  let sum = 0;
  let norm = 0;

  for (let harmonic = 1; harmonic <= harmonics; harmonic += 1) {
    const weight = harmonicPartialWeight(inst, eq, harmonic, 0.18);
    const phase = harmonic * (x * Math.PI * 2) + (eq * 1.9 + inst.harmonicMix * 0.8) * harmonic;
    sum += weight * Math.sin(phase);
    norm += Math.abs(weight);
  }

  const normalized = sum / Math.max(0.0001, norm);
  return clamp(0.5 + normalized * 0.46, 0, 1);
}
