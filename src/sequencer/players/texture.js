import { semitoneToHz } from "../../composition/harmony.js";
import { clamp } from "../../core/math.js";
import { legacyGate, play, rest } from "./common.js";

export function playTexture(inst, eq, ctx) {
  if (ctx.legacy) {
    const decision = legacyGate(inst, eq, ctx);
    if (!decision.trigger) {
      return rest(decision.reason, decision.threshold);
    }
    return play([{ kind: "grain", velocity: 0.5 + eq.combined * 0.4, duration: 0, value: eq.combined }], "classic:grain", decision.threshold);
  }

  const events = [];
  const s = ctx.stepInBar;
  if (ctx.isPhraseEnd && s === 0 && ctx.energy > 0.3) {
    events.push({ kind: "swell", velocity: 0.45 + ctx.energy * 0.45, duration: ctx.stepSec * 16, value: eq.combined });
  }
  if (ctx.chordChanged && s === 0 && inst.density > 0.2) {
    events.push({
      kind: "air",
      frequency: ctx.chord ? semitoneToHz(ctx.chord.root) : null,
      velocity: 0.45 + ctx.energy * 0.3,
      duration: ctx.chordSteps * ctx.stepSec,
      value: eq.combined
    });
  }
  const grainThreshold = clamp(1 - inst.density * 0.22 * (0.5 + ctx.energy), 0.5, 0.99);
  if (s % 2 === 1 && eq.combined > grainThreshold) {
    events.push({ kind: "grain", velocity: 0.3 + eq.combined * 0.4, duration: 0, value: eq.combined });
  }

  if (!events.length) {
    return rest("texture-rest", grainThreshold);
  }
  return play(events, events.map(function (event) { return event.kind; }).join("+"), grainThreshold);
}
