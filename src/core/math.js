import { PHI } from "../config/constants.js";
import { state } from "./state.js";

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function seededRandom() {
  state.seed = (state.seed * 48271) % 2147483647;
  return state.seed / 2147483647;
}

export function createRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted(rng, items, weights) {
  const total = weights.reduce(function (sum, weight) {
    return sum + Math.max(0, weight);
  }, 0);
  if (total <= 0) {
    return items[Math.floor(rng() * items.length)];
  }
  let roll = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= Math.max(0, weights[i]);
    if (roll <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function nthPrime(index) {
  let count = 0;
  let number = 1;
  while (count < index) {
    number += 1;
    let isPrime = true;
    for (let i = 2; i * i <= number; i += 1) {
      if (number % i === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) {
      count += 1;
    }
  }
  return number;
}

export function fractalSignature(step, depth, seedOffset) {
  let acc = 0;
  let norm = 0;
  for (let i = 1; i <= depth; i += 1) {
    const amp = 1 / Math.pow(2, i);
    const phase = (step + seedOffset * 2.7) * (0.08 * i * PHI);
    acc += Math.sin(phase) * amp;
    norm += amp;
  }
  return (acc / Math.max(0.0001, norm) + 1) * 0.5;
}

export function fibonacciAt(index) {
  const safe = Math.max(2, Math.floor(index));
  let a = 1;
  let b = 1;
  for (let i = 2; i < safe; i += 1) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  return b;
}
