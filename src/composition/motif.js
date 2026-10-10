import { sampleEquationForPlot } from "../algorithms/equation-runtime.js";
import { clamp, createRng, pickWeighted } from "../core/math.js";
import { state } from "../core/state.js";
import { metricWeight } from "./form.js";

export const MOTIF_LENGTH = 32;
const DEGREE_MIN = -4;
const DEGREE_MAX = 10;

function clampDegree(degree) {
  return clamp(Math.round(degree), DEGREE_MIN, DEGREE_MAX);
}

function generateMotif(inst, rng) {
  const slots = new Array(MOTIF_LENGTH).fill(null);
  const density = clamp(inst.density, 0.05, 1);
  const onsets = [];

  for (let step = 0; step < MOTIF_LENGTH; step += 1) {
    const weight = metricWeight(step % 16);
    const offbeatPenalty = step % 2 === 1 ? 0.35 : 1;
    const probability = density * (0.25 + weight * 0.75) * offbeatPenalty;
    if (step === 0 || rng() < probability) {
      onsets.push(step);
    }
  }

  let degree = pickWeighted(rng, [0, 2, 4], [0.5, 0.25, 0.25]);
  let pendingRecovery = 0;
  onsets.forEach(function (step, index) {
    const contour = sampleEquationForPlot(inst, step / MOTIF_LENGTH);
    const target = DEGREE_MIN + 2 + contour * 9;
    let move;
    if (pendingRecovery !== 0) {
      move = pendingRecovery;
      pendingRecovery = 0;
    } else if (rng() < 0.12) {
      move = (rng() < 0.5 ? -1 : 1) * (3 + Math.floor(rng() * 2));
      pendingRecovery = -Math.sign(move);
    } else {
      move = pickWeighted(rng, [-2, -1, 0, 1, 2], [0.12, 0.33, 0.1, 0.33, 0.12]);
      move += Math.sign(target - degree) * (rng() < 0.4 ? 1 : 0);
    }
    if (index > 0) {
      degree = clampDegree(degree + move);
    }
    const next = onsets[index + 1] !== undefined ? onsets[index + 1] : MOTIF_LENGTH;
    slots[step] = {
      degree: degree,
      length: Math.min(6, next - step),
      weight: metricWeight(step % 16) * 0.7 + rng() * 0.3
    };
  });

  return slots;
}

function onsetsOf(slots) {
  const result = [];
  slots.forEach(function (slot, step) {
    if (slot) {
      result.push(step);
    }
  });
  return result;
}

function cloneSlots(slots) {
  return slots.map(function (slot) {
    return slot ? Object.assign({}, slot) : null;
  });
}

const TRANSFORMS = {
  repeat: function (slots) {
    return cloneSlots(slots);
  },
  invert: function (slots) {
    return cloneSlots(slots).map(function (slot) {
      return slot ? Object.assign(slot, { degree: clampDegree(4 - slot.degree) }) : null;
    });
  },
  retrograde: function (slots) {
    const result = cloneSlots(slots);
    const onsets = onsetsOf(result);
    const degrees = onsets.map(function (step) {
      return result[step].degree;
    }).reverse();
    onsets.forEach(function (step, index) {
      result[step].degree = degrees[index];
    });
    return result;
  },
  sequence: function (slots, rng) {
    const shift = rng() < 0.5 ? 1 : -1;
    return cloneSlots(slots).map(function (slot) {
      return slot ? Object.assign(slot, { degree: clampDegree(slot.degree + shift) }) : null;
    });
  },
  displace: function (slots, rng) {
    const shift = rng() < 0.5 ? 2 : 4;
    const result = new Array(MOTIF_LENGTH).fill(null);
    slots.forEach(function (slot, step) {
      if (slot) {
        result[(step + shift) % MOTIF_LENGTH] = Object.assign({}, slot);
      }
    });
    return result;
  },
  ornament: function (slots, rng) {
    const result = cloneSlots(slots);
    const onsets = onsetsOf(result);
    onsets.forEach(function (step, index) {
      const next = onsets[index + 1];
      if (next === undefined || next - step < 2 || rng() > 0.6) {
        return;
      }
      const gap = result[next].degree - result[step].degree;
      const between = step + Math.floor((next - step) / 2);
      if (!result[between]) {
        result[between] = {
          degree: clampDegree(result[step].degree + (gap === 0 ? 1 : Math.sign(gap))),
          length: next - between,
          weight: 0.3
        };
        result[step].length = between - step;
      }
    });
    return result;
  },
  fragment: function (slots) {
    const half = MOTIF_LENGTH / 2;
    const result = new Array(MOTIF_LENGTH).fill(null);
    for (let step = 0; step < half; step += 1) {
      if (slots[step]) {
        result[step] = Object.assign({}, slots[step]);
        result[step + half] = Object.assign({}, slots[step]);
      }
    }
    return result;
  }
};

function resolveEnding(slots) {
  const onsets = onsetsOf(slots);
  const last = onsets[onsets.length - 1];
  if (last !== undefined) {
    const degree = slots[last].degree;
    const chordTones = [0, 2, 4, 7, -3];
    let best = 0;
    chordTones.forEach(function (tone) {
      if (Math.abs(tone - degree) < Math.abs(best - degree)) {
        best = tone;
      }
    });
    slots[last].degree = best;
  }
  return slots;
}

function developUnit(base, unitIndex, unitsPerPhrase, rng) {
  if (unitIndex === 0) {
    return cloneSlots(base);
  }
  const memory = clamp(state.music.motifMemory, 0, 1);
  const names = ["repeat", "sequence", "invert", "retrograde", "displace", "ornament", "fragment"];
  const weights = [memory * 2.2, 1, 0.6, 0.45, 0.7, 0.9 + state.chaos, 0.6];
  const developed = TRANSFORMS[pickWeighted(rng, names, weights)](base, rng);
  return unitIndex === unitsPerPhrase - 1 ? resolveEnding(developed) : developed;
}

export function getMotifSlot(inst, phraseIndex, phraseBar, phraseBars, stepInBar) {
  const compose = state.compose;
  const unitsPerPhrase = Math.max(1, Math.floor(phraseBars / 2));
  const unitIndex = Math.min(unitsPerPhrase - 1, Math.floor(phraseBar / 2));

  if (compose.motifPhrase !== phraseIndex || !compose.motif) {
    const theme = phraseIndex % 4 === 2 ? "B" : "A";
    const bank = compose.motifBank || (compose.motifBank = {});
    const rng = createRng(state.music.seed * 31337 + phraseIndex * 7177 + inst.seedOffset);
    const keep = bank[theme] && rng() < clamp(state.music.motifMemory, 0, 1);
    compose.motif = keep ? bank[theme] : generateMotif(inst, rng);
    bank[theme] = compose.motif;
    compose.motifPhrase = phraseIndex;
    compose.motifUnits = {};
  }

  if (!compose.motifUnits[unitIndex]) {
    const rng = createRng(state.music.seed * 2203 + phraseIndex * 613 + unitIndex * 97);
    compose.motifUnits[unitIndex] = developUnit(compose.motif, unitIndex, unitsPerPhrase, rng);
  }

  return compose.motifUnits[unitIndex][(phraseBar % 2) * 16 + stepInBar];
}
