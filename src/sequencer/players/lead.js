import { degreeToSemitone, nearestChordTone, semitoneToHz } from "../../composition/harmony.js";
import { getMotifSlot } from "../../composition/motif.js";
import { clamp } from "../../core/math.js";
import { state } from "../../core/state.js";
import { legacyPitched, play, rest } from "./common.js";

export function playLead(inst, eq, ctx) {
  const chord = ctx.chord;
  if (ctx.legacy || !chord) {
    return legacyPitched(inst, eq, ctx, 0.5);
  }

  const slot = getMotifSlot(inst, ctx.phraseIndex, ctx.phraseBar, ctx.phraseBars, ctx.stepInBar);
  if (!slot) {
    return rest("motif-gap", 1);
  }
  const threshold = clamp(1 - (inst.density * 0.6 + ctx.energy * 0.65), 0.05, 0.95);
  if (slot.weight < threshold) {
    return rest("motif-thinned", threshold);
  }

  let semitone = degreeToSemitone(chord.degree + slot.degree);
  if (ctx.metric >= 0.7) {
    semitone = nearestChordTone(semitone, chord);
  }
  if (eq.combined > 0.93 && state.chaos > 0.3) {
    semitone += 12;
  }

  return play([{
    frequency: semitoneToHz(semitone + inst.octave * 12),
    velocity: clamp(0.4 + slot.weight * 0.4 + ctx.energy * 0.15, 0, 1),
    duration: slot.length * ctx.stepSec * 0.92,
    value: eq.combined
  }], "motif deg " + slot.degree + " / " + chord.name, threshold);
}
