import { SCALE_LIBRARY } from "../config/scales.js";
import { clamp, fractalSignature } from "../core/math.js";
import { state } from "../core/state.js";
import { getDodecaphonicInterval } from "../theory/dodecaphonic.js";

export function computeNoteFrequency(inst, value, step) {
  const scaleData = SCALE_LIBRARY[state.scale] || SCALE_LIBRARY.minorPentatonic;
  const intervals = scaleData.intervals;
  const fract = fractalSignature(step, state.fractalDepth, inst.seedOffset);
  const combined = clamp(value * (0.72 + state.chaos * 0.18) + fract * 0.28, 0, 0.999);
  let interval = 0;

  if (scaleData.toneRow) {
    interval = getDodecaphonicInterval(inst.id);
  } else {
    const index = Math.floor(combined * intervals.length);
    interval = intervals[index % intervals.length];
  }

  const octaveOffset = inst.octave + Math.floor(fract * 2) - 1;
  const microShape = Math.sin((step + inst.seedOffset * 0.8) * 0.37 + fract * Math.PI * 2);
  const microSemitone = (state.microtonalCents / 100) * microShape;
  const semitones = interval + octaveOffset * 12 + microSemitone;
  const hz = state.rootHz * Math.pow(2, semitones / 12);
  return Math.max(28, hz);
}
