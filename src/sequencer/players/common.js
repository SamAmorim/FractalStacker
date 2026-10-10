import { clamp } from "../../core/math.js";
import { computeNoteFrequency } from "../pitch.js";
import { getTriggerDecision } from "../trigger.js";

export function gateThreshold(inst, weight, energy) {
  return clamp(1 - inst.density * (0.3 + weight * 0.7) * (0.45 + energy * 0.75), 0.02, 0.98);
}

export function rest(reason, threshold) {
  return { trigger: false, events: [], reason: reason, threshold: typeof threshold === "number" ? threshold : 1 };
}

export function play(events, reason, threshold) {
  return { trigger: events.length > 0, events: events, reason: reason, threshold: typeof threshold === "number" ? threshold : 0 };
}

export function legacyPitched(inst, eq, ctx, holdSteps) {
  const decision = getTriggerDecision(inst, eq.combined, ctx.step);
  if (!decision.trigger) {
    return rest(decision.reason, decision.threshold);
  }
  return play([{
    frequency: computeNoteFrequency(inst, eq.combined, ctx.step),
    velocity: 0.55 + eq.combined * 0.4,
    duration: ctx.stepSec * holdSteps,
    value: eq.combined
  }], "classic:" + decision.reason, decision.threshold);
}

export function legacyGate(inst, eq, ctx) {
  return getTriggerDecision(inst, eq.combined, ctx.step);
}

export function foldToRegister(semitone, octave) {
  const pitchClass = ((semitone % 12) + 12) % 12;
  return (pitchClass > 7 ? pitchClass - 12 : pitchClass) + octave * 12;
}
