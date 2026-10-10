import { NOTE_NAMES } from "../config/constants.js";
import { SCALE_LIBRARY } from "../config/scales.js";
import { clamp, createRng, pickWeighted } from "../core/math.js";
import { state } from "../core/state.js";

// Root motion weights by ascending interval in semitones: falling fifths dominate,
// thirds and modal steps follow, tritones and semitones are rare.
const ROOT_MOTION_WEIGHTS = [0, 0.15, 0.5, 0.4, 0.4, 1, 0.1, 0.55, 0.6, 0.7, 0.5, 0.15];
const PRE_TONIC_WEIGHTS = { 7: 1, 5: 0.75, 10: 0.6, 2: 0.4, 11: 0.35, 8: 0.3 };

export function getScale() {
  return SCALE_LIBRARY[state.scale] || SCALE_LIBRARY.minorPentatonic;
}

export function isTonalScale() {
  const scale = getScale();
  return !scale.toneRow && scale.intervals.length <= 8;
}

export function degreeToSemitone(degree) {
  const intervals = getScale().intervals;
  const n = intervals.length;
  const octave = Math.floor(degree / n);
  return intervals[((degree % n) + n) % n] + octave * 12;
}

export function semitoneToHz(semitone) {
  return state.rootHz * Math.pow(2, semitone / 12);
}

function chordSizeFor(rng) {
  const complexity = clamp(state.music.complexity, 0, 1);
  let size = 3;
  if (rng() < complexity) {
    size += 1;
  }
  if (rng() < complexity - 0.55) {
    size += 1;
  }
  return size;
}

export function buildChord(degree, size) {
  const tones = [];
  for (let i = 0; i < size; i += 1) {
    tones.push(degreeToSemitone(degree + i * 2));
  }
  const root = tones[0];
  return {
    degree: degree,
    root: root,
    tones: tones,
    intervals: tones.map(function (tone) {
      return tone - root;
    }),
    name: chordName(root, tones)
  };
}

function rootNoteIndex(rootSemitone) {
  const midi = 69 + 12 * Math.log2(state.rootHz / 440);
  return (((Math.round(midi) + rootSemitone) % 12) + 12) % 12;
}

const CHORD_QUALITIES = {
  "0,4,7": "", "0,3,7": "m", "0,3,6": "dim", "0,4,8": "aug", "0,2,7": "sus2", "0,5,7": "sus4",
  "0,4,7,11": "maj7", "0,4,7,10": "7", "0,3,7,10": "m7", "0,3,6,10": "m7b5", "0,3,6,9": "dim7",
  "0,4,7,9": "6", "0,3,7,9": "m6", "0,3,7,11": "mMaj7", "0,5,7,10": "7sus4", "0,5,10": "7sus4",
  "0,4,8,11": "maj7#5", "0,2,7,10": "7sus2", "0,2,4,7": "add9", "0,2,3,7": "madd9",
  "0,4,9": "6", "0,3,10": "m7", "0,4,10": "7", "0,2,4,9": "6/9", "0,3,5,10": "m11",
  "0,2,7,9": "6sus2", "0,2,5,10": "9sus4", "0,2,5,7": "sus2/4"
};

function qualityFor(pitchClasses, root) {
  const key = Array.from(new Set(pitchClasses.map(function (pc) {
    return (pc - root + 12) % 12;
  }))).sort(function (a, b) {
    return a - b;
  }).join(",");
  return Object.prototype.hasOwnProperty.call(CHORD_QUALITIES, key) ? CHORD_QUALITIES[key] : null;
}

function chordName(root, tones) {
  const core = tones.slice(0, Math.min(4, tones.length)).map(function (tone) {
    return ((tone % 12) + 12) % 12;
  });
  const bass = core[0];
  const ninth = tones.length > 4 ? ((tones[4] % 12) + 12) % 12 : null;
  const extension = ninth !== null && core.indexOf(ninth) === -1 && (ninth - bass + 12) % 12 <= 2 ? "(9)" : "";
  const direct = qualityFor(core, bass);
  if (direct !== null) {
    return NOTE_NAMES[rootNoteIndex(bass)] + direct + extension;
  }
  for (let i = 1; i < core.length; i += 1) {
    const quality = qualityFor(core, core[i]);
    if (quality !== null) {
      return NOTE_NAMES[rootNoteIndex(core[i])] + quality + extension + "/" + NOTE_NAMES[rootNoteIndex(bass)];
    }
  }
  return NOTE_NAMES[rootNoteIndex(bass)] + "(" + core.slice(1).map(function (pc) {
    return (pc - bass + 12) % 12;
  }).join(" ") + ")";
}

function chordWeight(fromDegree, toDegree, temperature) {
  if (fromDegree === toDegree) {
    return 0;
  }
  const fromRoot = degreeToSemitone(fromDegree);
  const toRoot = degreeToSemitone(toDegree);
  const motion = (((toRoot - fromRoot) % 12) + 12) % 12;
  let weight = ROOT_MOTION_WEIGHTS[motion];
  const fifth = degreeToSemitone(toDegree + 4) - toRoot;
  if (fifth !== 7) {
    weight *= fifth === 6 ? 0.25 : 0.6;
  }
  return Math.pow(Math.max(0.001, weight), temperature);
}

function nextDegree(rng, fromDegree, temperature) {
  const n = getScale().intervals.length;
  const degrees = [];
  const weights = [];
  for (let d = 0; d < n; d += 1) {
    degrees.push(d);
    weights.push(chordWeight(fromDegree, d, temperature));
  }
  return pickWeighted(rng, degrees, weights);
}

function preTonicDegree(rng, fromDegree) {
  const n = getScale().intervals.length;
  const degrees = [];
  const weights = [];
  for (let d = 1; d < n; d += 1) {
    const root = ((degreeToSemitone(d) % 12) + 12) % 12;
    const weight = PRE_TONIC_WEIGHTS[root] || 0.05;
    if (d !== fromDegree || n <= 2) {
      degrees.push(d);
      weights.push(weight);
    }
  }
  return degrees.length ? pickWeighted(rng, degrees, weights) : 0;
}

function planProgression(phraseIndex, length, previous, startOnTonic) {
  const rng = createRng(state.music.seed * 7919 + phraseIndex * 104729);
  const temperature = 1 - clamp(state.chaos, 0, 1) * 0.75;
  const memory = clamp(state.music.motifMemory, 0, 1);

  if (previous && previous.length === length && rng() < memory * 0.85) {
    return previous.map(function (chord) {
      return buildChord(chord.degree, chord.tones.length);
    });
  }

  const degrees = [];
  for (let i = 0; i < length; i += 1) {
    if (i === 0) {
      degrees.push(startOnTonic ? 0 : nextDegree(rng, 0, temperature));
    } else if (i === length - 1) {
      degrees.push(preTonicDegree(rng, degrees[i - 1]));
    } else {
      degrees.push(nextDegree(rng, degrees[i - 1], temperature));
    }
  }

  return degrees.map(function (degree) {
    return buildChord(degree, chordSizeFor(rng));
  });
}

export function updateHarmony(phraseIndex, phraseBar, phraseBars) {
  const compose = state.compose;
  if (!isTonalScale()) {
    compose.chord = null;
    compose.nextChord = null;
    compose.progression = [];
    return;
  }

  const barsPerChord = clamp(Math.round(state.music.harmonicRhythm), 1, phraseBars);
  const length = Math.max(1, Math.ceil(phraseBars / barsPerChord));
  const needsPlan = phraseBar === 0 || compose.progressionPhrase !== phraseIndex ||
    compose.progressionScale !== state.scale || compose.progression.length !== length;

  if (needsPlan) {
    const theme = phraseIndex % 4 === 2 ? "B" : "A";
    compose.progression = planProgression(phraseIndex, length, compose.progressionBank[theme], theme === "A");
    compose.progressionBank[theme] = compose.progression;
    compose.progressionPhrase = phraseIndex;
    compose.progressionScale = state.scale;
  }

  const index = Math.min(compose.progression.length - 1, Math.floor(phraseBar / barsPerChord));
  const chord = compose.progression[index];
  if (!compose.chord || compose.chord !== chord) {
    compose.chord = chord;
    compose.chordChanged = true;
  }
  compose.nextChord = index + 1 < compose.progression.length
    ? compose.progression[index + 1]
    : buildChord(0, chord.tones.length);
  compose.lastBarOfChord = (phraseBar + 1) % barsPerChord === 0 || phraseBar === phraseBars - 1;
}

export function nearestChordTone(semitone, chord) {
  if (!chord) {
    return semitone;
  }
  let best = semitone;
  let bestDistance = Infinity;
  chord.tones.forEach(function (tone) {
    const pitchClass = ((tone % 12) + 12) % 12;
    for (let octave = -2; octave <= 2; octave += 1) {
      const candidate = pitchClass + Math.floor(semitone / 12) * 12 + octave * 12;
      const distance = Math.abs(candidate - semitone);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
  });
  return best;
}

export function resetComposition() {
  Object.assign(state.compose, {
    formBar: -1,
    chord: null,
    nextChord: null,
    chordChanged: false,
    progression: [],
    progressionBank: {},
    progressionPhrase: -1,
    padVoicing: [],
    motif: null,
    motifBank: {},
    motifPhrase: -1,
    bassLastHz: null,
    arpIndex: 0
  });
}

export function reharmonize() {
  state.music.seed = (state.music.seed * 48271 + 11) % 99991 + 1;
  state.compose.progression = [];
  state.compose.progressionBank = {};
  state.compose.progressionPhrase = -1;
  state.compose.motif = null;
  state.compose.motifBank = {};
  state.compose.motifPhrase = -1;
}
