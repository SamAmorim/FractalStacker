import { semitoneToHz } from "../../composition/harmony.js";
import { clamp } from "../../core/math.js";
import { state } from "../../core/state.js";
import { arpSemitone } from "../arpeggiator.js";
import { legacyPitched, play, rest } from "./common.js";

export function playArp(inst, eq, ctx) {
  const chord = ctx.chord;
  if (ctx.legacy || !chord) {
    return legacyPitched(inst, eq, ctx, 0.5);
  }

  const compose = state.compose;
  const rate = clamp(Math.round(state.music.arpRate), 1, 4);
  if (ctx.chordChanged && ctx.stepInBar === 0) {
    compose.arpIndex = 0;
  }
  if (ctx.step % rate !== 0) {
    return rest("arp-rate", 1);
  }
  const minEnergy = 0.5 - inst.density * 0.35;
  if (ctx.energy < minEnergy) {
    return rest("arp-waits-energy", minEnergy);
  }
  const restThreshold = (1 - inst.density) * 0.55;
  const index = compose.arpIndex;
  compose.arpIndex += 1;
  if (eq.combined < restThreshold) {
    return rest("arp-rest", restThreshold);
  }

  const rootShift = (((chord.root % 12) + 12) % 12) - chord.root;
  const tones = chord.tones.map(function (tone) {
    return tone + rootShift;
  });
  const semitone = arpSemitone(tones, state.music.arpPattern, index, state.music.arpOctaves, eq.combined, ctx.rng);
  const accent = index % tones.length === 0 ? 0.22 : 0;
  return play([{
    frequency: semitoneToHz(semitone + inst.octave * 12),
    velocity: clamp(0.42 + accent + ctx.metric * 0.2 + ctx.energy * 0.12, 0, 1),
    duration: rate * ctx.stepSec * 0.9,
    value: eq.combined
  }], "arp " + state.music.arpPattern + " #" + index, restThreshold);
}
