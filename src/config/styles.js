export const DRUM_VOICES = ["kick", "snare", "rim", "hat", "openHat"];

export const DRUM_VOICE_LABELS = {
  kick: "Kick",
  snare: "Snare",
  rim: "Rim",
  hat: "Hat",
  openHat: "Open hat"
};

export const FILL_TYPES = {
  roll: "Rufar de caixa + toms",
  sparse: "Esparsa (aro)",
  none: "Sem virada"
};

export const ROLE_LABELS = {
  drums: "Bateria",
  bass: "Baixo",
  pad: "Pad (acordes)",
  lead: "Lead (motivo)",
  arp: "Arpejo",
  texture: "Textura"
};

export const ENGINE_LABELS = {
  drums: "Kit de bateria",
  bass: "Baixo sub/glide",
  pad: "Pad stereo",
  keys: "FM keys",
  pluck: "Pluck",
  noise: "Ruido/textura"
};

export const ROOT_MOTION_LABELS = ["unis.", "2m", "2M", "3m", "3M", "4J", "tri.", "5J", "6m", "6M", "7m", "7M"];

export const MOTIF_TRANSFORMS = {
  repeat: "Repetir",
  sequence: "Sequencia",
  invert: "Inversao",
  retrograde: "Retrogrado",
  displace: "Deslocar",
  ornament: "Ornamentar",
  fragment: "Fragmentar"
};

export const ARP_PATTERNS = {
  up: "Sobe",
  down: "Desce",
  upDown: "Sobe/desce",
  converge: "Converge",
  random: "Aleatorio (semente)",
  fractal: "Fractal (equacao)"
};

function euclid(pulses, rotation, minEnergy, velocity, grow) {
  return { enabled: true, mode: "euclid", pulses: pulses, rotation: rotation, steps: [], minEnergy: minEnergy, velocity: velocity, grow: grow || 0 };
}

function steps(list, minEnergy, velocity) {
  return { enabled: list.length > 0, mode: "steps", pulses: list.length, rotation: 0, steps: list, minEnergy: minEnergy, velocity: velocity, grow: 0 };
}

const DEFAULT_FORM = {
  phraseBars: 8,
  sections: [
    { name: "Respiro", energy: 0.3, theme: "A" },
    { name: "Desenvolvimento", energy: 0.6, theme: "A" },
    { name: "Apice", energy: 0.92, theme: "B" },
    { name: "Retorno", energy: 0.55, theme: "A" }
  ]
};

// Root motion weights by ascending interval: falling fifths dominate, tritones and semitones are rare.
const DEFAULT_ROOT_MOTION = [0, 0.15, 0.5, 0.4, 0.4, 1, 0.1, 0.55, 0.6, 0.7, 0.5, 0.15];
const DEFAULT_PRE_TONIC = [0, 0.05, 0.4, 0.05, 0.05, 0.75, 0.05, 1, 0.3, 0.05, 0.6, 0.35];

const DEFAULT_MOTIF = {
  transforms: { repeat: 1, sequence: 1, invert: 0.6, retrograde: 0.45, displace: 0.7, ornament: 0.9, fragment: 0.6 },
  leapChance: 0.12,
  offbeatDensity: 0.35
};

function makeStyle(label, spec) {
  return {
    label: label,
    legacy: Boolean(spec.legacy),
    params: spec.params,
    form: spec.form || DEFAULT_FORM,
    groove: spec.groove,
    harmony: {
      rootMotion: spec.rootMotion || DEFAULT_ROOT_MOTION,
      preTonic: spec.preTonic || DEFAULT_PRE_TONIC,
      dimPenalty: spec.dimPenalty !== undefined ? spec.dimPenalty : 0.25
    },
    motif: spec.motif || DEFAULT_MOTIF
  };
}

export const STYLE_PRESETS = {
  ambient: makeStyle("Ambient", {
    params: { harmonicRhythm: 4, complexity: 0.85, humanize: 0.6, motifMemory: 0.8, sidechain: 0, arpPattern: "converge", arpRate: 3, arpOctaves: 2 },
    rootMotion: [0, 0.2, 0.7, 0.6, 0.6, 0.9, 0.05, 0.45, 0.7, 0.75, 0.6, 0.1],
    dimPenalty: 0.1,
    groove: {
      voices: {
        kick: euclid(2, 0, 0.55, 0.55),
        snare: steps([], 0, 0.8),
        rim: euclid(3, 5, 0.4, 0.35),
        hat: euclid(5, 2, 0.25, 0.3, 4),
        openHat: steps([], 0, 0.4)
      },
      ghostChance: 0.04,
      fill: "sparse"
    },
    motif: { transforms: { repeat: 1.2, sequence: 1, invert: 0.4, retrograde: 0.3, displace: 0.9, ornament: 0.5, fragment: 0.8 }, leapChance: 0.08, offbeatDensity: 0.2 }
  }),
  downtempo: makeStyle("Downtempo", {
    params: { harmonicRhythm: 2, complexity: 0.7, humanize: 0.45, motifMemory: 0.7, sidechain: 0.25, arpPattern: "upDown", arpRate: 2, arpOctaves: 2 },
    groove: {
      voices: {
        kick: euclid(3, 0, 0, 0.9),
        snare: steps([8], 0.2, 0.8),
        rim: euclid(2, 6, 0.6, 0.35),
        hat: euclid(6, 2, 0.15, 0.45, 12),
        openHat: steps([14], 0.7, 0.4)
      },
      ghostChance: 0.14,
      fill: "roll"
    }
  }),
  drive: makeStyle("Drive (synthwave/techno)", {
    params: { harmonicRhythm: 2, complexity: 0.45, humanize: 0.15, motifMemory: 0.65, sidechain: 0.55, arpPattern: "up", arpRate: 1, arpOctaves: 2 },
    rootMotion: [0, 0.1, 0.45, 0.35, 0.35, 1, 0.05, 0.7, 0.75, 0.5, 0.65, 0.1],
    groove: {
      voices: {
        kick: euclid(4, 0, 0.15, 1),
        snare: steps([4, 12], 0.35, 0.85),
        rim: euclid(3, 3, 0.75, 0.3),
        hat: euclid(8, 2, 0, 0.55, 12),
        openHat: steps([2, 6, 10, 14], 0.6, 0.45)
      },
      ghostChance: 0.1,
      fill: "roll"
    },
    motif: { transforms: { repeat: 1.4, sequence: 1.1, invert: 0.5, retrograde: 0.3, displace: 0.6, ornament: 0.7, fragment: 0.9 }, leapChance: 0.1, offbeatDensity: 0.45 }
  }),
  fractal: makeStyle("Fractal livre (motor classico)", {
    legacy: true,
    params: { harmonicRhythm: 1, complexity: 0.5, humanize: 0, motifMemory: 0.3, sidechain: 0, arpPattern: "fractal", arpRate: 1, arpOctaves: 2 },
    groove: {
      voices: {
        kick: euclid(4, 0, 0, 1),
        snare: steps([4, 12], 0, 0.8),
        rim: euclid(0, 0, 0, 0.3),
        hat: euclid(8, 2, 0, 0.5, 0),
        openHat: steps([], 0, 0.4)
      },
      ghostChance: 0,
      fill: "none"
    }
  })
};
