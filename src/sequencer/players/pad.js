import { semitoneToHz } from "../../composition/harmony.js";
import { voiceChord } from "../../composition/voicing.js";
import { clamp } from "../../core/math.js";
import { state } from "../../core/state.js";
import { legacyPitched, play, rest } from "./common.js";

const MAX_PAD_VOICES = { eco: 3, balanced: 4, turbo: 5 };

export function playPad(inst, eq, ctx) {
  const chord = ctx.chord;
  if (ctx.legacy || !chord) {
    return legacyPitched(inst, eq, ctx, 2.5);
  }
  if (!(ctx.chordChanged && ctx.stepInBar === 0)) {
    return rest("sustain " + chord.name, 1);
  }
  if (inst.density < 0.12) {
    return rest("density", 1);
  }

  const voicing = voiceChord(chord, state.compose.padVoicing, 7 + inst.octave * 12, MAX_PAD_VOICES[state.performanceMode] || 4);
  state.compose.padVoicing = voicing;
  return play([{
    frequencies: voicing.map(semitoneToHz),
    frequency: semitoneToHz(voicing[0]),
    velocity: clamp(0.35 + ctx.energy * 0.45 + inst.density * 0.15, 0, 1),
    duration: Math.max(ctx.stepSec * 4, ctx.chordSteps * ctx.stepSec - 0.05),
    value: eq.combined
  }], "chord " + chord.name, 0);
}
