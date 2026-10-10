import { EQUATIONS } from "./equations/index.js";
import { PHI } from "../config/constants.js";
import { clamp, fibonacciAt, fractalSignature, nthPrime, seededRandom } from "../core/math.js";
import { state } from "../core/state.js";

export function sampleEquationForPlot(inst, xNorm) {
  const x = clamp(xNorm, 0, 1);
  const key = inst.equation;

  if (key === "fibonacci") {
    const n = 2 + Math.floor(x * 20);
    return (fibonacciAt(n) % 89) / 89;
  }

  if (key === "logistic") {
    const r = 3.5 + state.chaos * 0.49;
    let v = 0.14 + ((inst.seedOffset % 17) / 23) + x * 0.12;
    v = clamp(v % 1, 0.001, 0.999);
    const iters = 4 + Math.floor(x * 28);
    for (let i = 0; i < iters; i += 1) {
      v = r * v * (1 - v);
    }
    return clamp(v, 0, 1);
  }

  if (key === "sineFold") {
    const k = 0.17 + state.chaos * 0.22;
    return (Math.sin((x * 64 + inst.seedOffset) * PHI * k) + 1) * 0.5;
  }

  if (key === "primeStep") {
    const primeIdx = 2 + Math.floor(x * 30);
    return (nthPrime(primeIdx) % 29) / 29;
  }

  if (key === "euclidGate") {
    const steps = 16;
    const pulses = Math.max(1, Math.round(inst.density * 11));
    const stepIndex = Math.floor(x * (steps - 1));
    const slot = (stepIndex * (pulses + 1) + inst.seedOffset) % steps;
    return slot < pulses ? 0.9 : 0.08;
  }

  if (key === "xorShift") {
    let value = ((x * 1024) | 0) + inst.seedOffset + 1;
    value ^= value << 13;
    value ^= value >> 17;
    value ^= value << 5;
    return ((value >>> 0) % 1024) / 1024;
  }

  return 0;
}

function computeEquationRuntimeDetails(inst, step) {
  const key = inst.equation;

  if (key === "fibonacci") {
    const n = (step + inst.seedOffset) % 18 + 2;
    let a = 1;
    let b = 1;
    for (let i = 2; i < n; i += 1) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    const modulo = b % 89;
    return {
      raw: modulo / 89,
      detailText: "n=" + n + " | F(n)=" + b + " | F mod 89=" + modulo
    };
  }

  if (key === "logistic") {
    if (typeof inst.eqState.logistic !== "number") {
      inst.eqState.logistic = 0.17 + (inst.seedOffset % 13) * 0.03;
    }
    const prev = inst.eqState.logistic;
    const r = 3.5 + state.chaos * 0.49;
    const next = r * prev * (1 - prev);
    inst.eqState.logistic = next;
    return {
      raw: clamp(next, 0, 1),
      detailText: "r=" + r.toFixed(3) + " | x_prev=" + prev.toFixed(3) + " | x_next=" + next.toFixed(3)
    };
  }

  if (key === "sineFold") {
    const k = 0.17 + state.chaos * 0.22;
    const angle = (step + inst.seedOffset) * PHI * k;
    const sine = Math.sin(angle);
    return {
      raw: (sine + 1) * 0.5,
      detailText: "k=" + k.toFixed(3) + " | angle=" + angle.toFixed(3) + " | sin=" + sine.toFixed(3)
    };
  }

  if (key === "primeStep") {
    const primeIndex = (step + inst.seedOffset) % 28 + 2;
    const prime = nthPrime(primeIndex);
    const modulo = prime % 29;
    return {
      raw: modulo / 29,
      detailText: "prime(" + primeIndex + ")=" + prime + " | prime mod 29=" + modulo
    };
  }

  if (key === "euclidGate") {
    const steps = 16;
    const pulses = Math.max(1, Math.round(inst.density * 11));
    const slot = (step * (pulses + 1) + inst.seedOffset) % steps;
    const gate = slot < pulses;
    return {
      raw: gate ? 0.9 : 0.08,
      detailText: "steps=" + steps + " | pulses=" + pulses + " | slot=" + slot + " | gate=" + (gate ? "1" : "0")
    };
  }

  if (key === "xorShift") {
    let x = (step + inst.seedOffset + 1) | 0;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    const unsigned = x >>> 0;
    const modulo = unsigned % 1024;
    return {
      raw: modulo / 1024,
      detailText: "x=" + unsigned + " | x mod 1024=" + modulo
    };
  }

  return {
    raw: 0,
    detailText: "equation runtime unavailable"
  };
}

export function evaluateEquation(inst, step) {
  const eq = EQUATIONS[inst.equation] || EQUATIONS.fibonacci;
  const equationRuntime = computeEquationRuntimeDetails(inst, step);
  const rawValue = clamp(equationRuntime.raw, 0, 1);
  const fract = fractalSignature(step + inst.seedOffset * 0.5, state.fractalDepth, inst.seedOffset);
  const randomFactor = seededRandom() * state.chaos * 0.2;
  const combined = clamp(rawValue * (0.72 - state.chaos * 0.2) + fract * (0.28 + state.chaos * 0.18) + randomFactor, 0, 1);
  inst.lastValue = combined;

  return {
    equationKey: inst.equation,
    equationName: eq.name,
    formula: eq.formula,
    raw: rawValue,
    fractal: fract,
    random: randomFactor,
    combined: combined,
    detailText: equationRuntime.detailText
  };
}
