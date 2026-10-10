import { degreeToSemitone, semitoneToHz } from "../../composition/harmony.js";
import { clamp } from "../../core/math.js";
import { state } from "../../core/state.js";
import { foldToRegister, gateThreshold, legacyPitched, play, rest } from "./common.js";

function pickBassSemitone(chord, eq, ctx, downbeat) {
  const fifth = chord.root + chord.intervals[2];
  if (downbeat) {
    return { semitone: chord.root, octaveUp: false };
  }
  if (ctx.metric >= 0.7) {
    return { semitone: eq.combined > 0.84 ? fifth : chord.root, octaveUp: false };
  }
  const choices = [chord.root, fifth, chord.root, chord.root + chord.intervals[1]];
  const index = Math.floor(eq.combined * 4.999) % 5;
  if (index === 4) {
    return { semitone: chord.root, octaveUp: true };
  }
  return { semitone: choices[index], octaveUp: false };
}

export function playBass(inst, eq, ctx) {
  const chord = ctx.chord;
  if (ctx.legacy || !chord) {
    return legacyPitched(inst, eq, ctx, 0.8);
  }

  const s = ctx.stepInBar;
  const downbeat = ctx.chordChanged && s === 0;
  const approach = ctx.lastBarOfChord && s === 14 && ctx.energy > 0.3 && ctx.nextChord;
  let weight = ctx.metric;
  if (s % 4 === 2 && ctx.energy > 0.5) {
    weight += 0.3;
  }
  if (s % 2 === 1 && ctx.energy < 0.8) {
    weight = 0;
  }
  const threshold = gateThreshold(inst, weight, ctx.energy);
  if (!downbeat && !approach && (weight <= 0 || eq.combined <= threshold)) {
    return rest("bass-rest", threshold);
  }

  let semitone;
  let octaveUp = false;
  let reason;
  if (approach) {
    const target = ctx.nextChord.root;
    semitone = state.music.complexity > 0.6 && eq.combined > 0.5
      ? target - 1
      : degreeToSemitone(ctx.nextChord.degree + (eq.combined > 0.5 ? 1 : -1));
    reason = "approach->" + ctx.nextChord.name;
  } else {
    const pick = pickBassSemitone(chord, eq, ctx, downbeat);
    semitone = pick.semitone;
    octaveUp = pick.octaveUp;
    reason = downbeat ? "chord-root" : "chord-tone";
  }

  const frequency = semitoneToHz(foldToRegister(semitone, inst.octave) + (octaveUp ? 12 : 0));
  const previous = state.compose.bassLastHz;
  const glide = previous && !downbeat && ctx.rng() < 0.15 + state.chaos * 0.25 && Math.abs(Math.log2(frequency / previous)) < 0.6;
  state.compose.bassLastHz = frequency;

  const holdSteps = downbeat ? (ctx.energy < 0.5 ? 6 : 3) : ctx.energy < 0.45 ? 3 : 1.6;
  return play([{
    frequency: frequency,
    velocity: clamp(0.55 + weight * 0.3 + (downbeat ? 0.12 : 0), 0, 1),
    duration: ctx.stepSec * holdSteps,
    value: eq.combined,
    glideFrom: glide ? previous : null
  }], reason, threshold);
}
