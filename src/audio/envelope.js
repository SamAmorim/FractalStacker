import { clamp } from "../core/math.js";
import { state } from "../core/state.js";

export function applyEnvelope(gainNode, when, hold, peak, shape) {
  const env = state.envelope;
  const attack = Math.max(shape.minAttack || 0.001, env.attack * shape.attackMul);
  const decay = Math.max(0.001, env.decay * shape.decayMul);
  const sustain = clamp(env.sustain * shape.sustainMul, 0.02, 1);
  const release = Math.max(shape.minRelease || 0.01, env.release * shape.releaseMul);
  const releaseStart = Math.max(when + attack + decay, when + hold);

  gainNode.gain.cancelScheduledValues(when);
  gainNode.gain.setValueAtTime(0.0001, when);
  gainNode.gain.linearRampToValueAtTime(peak, when + attack);
  gainNode.gain.linearRampToValueAtTime(peak * sustain, when + attack + decay);
  gainNode.gain.setValueAtTime(peak * sustain, releaseStart);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, releaseStart + release);

  return releaseStart + release;
}

export function percussiveEnvelope(gainNode, when, peak, decay) {
  gainNode.gain.setValueAtTime(0.0001, when);
  gainNode.gain.linearRampToValueAtTime(peak, when + 0.002);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  return when + decay;
}

export function filterSweep(param, when, from, to, time) {
  param.setValueAtTime(Math.max(20, from), when);
  param.exponentialRampToValueAtTime(Math.max(20, to), when + Math.max(0.005, time));
}

export function velocityCurve(velocity) {
  return Math.pow(clamp(velocity, 0, 1), 1.5);
}
