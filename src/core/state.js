import { PHI } from "../config/constants.js";
import { createInstrumentFx, createMasterFx } from "../config/fx-defaults.js";
import { INSTRUMENT_DEFAULTS } from "../config/instruments.js";

export const state = {
  powered: false,
  bpm: 112,
  rootHz: 110,
  globalDetune: 0,
  fractalDepth: 4,
  chaos: 0.32,
  swing: 0.08,
  microtonalCents: 0,
  masterVolume: 0.32,
  scale: "minorPentatonic",
  performanceMode: "balanced",
  plotInstrumentId: "rhythm",
  plotAutoCycle: true,
  plotCycleUnit: "bar",
  plotCycleBars: 1,
  lastPlotCyclePulse: -1,
  plotFrozen: false,
  phiSensitivity: "balanced",
  graphsOnly: false,
  demoTech: false,
  demo: {
    slide: 0,
    barsPerSlide: 4,
    focusInstId: null
  },
  envelope: {
    attack: 0.01,
    decay: 0.18,
    sustain: 0.56,
    release: 0.26
  },
  fx: createMasterFx(),
  music: {
    style: "downtempo",
    harmonicRhythm: 2,
    complexity: 0.7,
    energy: 0.6,
    autoForm: true,
    humanize: 0.45,
    motifMemory: 0.7,
    sidechain: 0.25,
    arpPattern: "upDown",
    arpRate: 2,
    arpOctaves: 2,
    seed: (Date.now() % 99991) + 1
  },
  compose: {
    formBar: -1,
    chord: null,
    nextChord: null,
    chordChanged: false,
    lastBarOfChord: false,
    progression: [],
    progressionBank: {},
    progressionPhrase: -1,
    progressionScale: null,
    section: "Respiro",
    energy: 0.3,
    phraseBar: 0,
    phraseIndex: 0,
    padVoicing: [],
    motif: null,
    motifBank: {},
    motifUnits: {},
    motifPhrase: -1,
    bassLastHz: null,
    arpIndex: 0
  },
  scheduler: {
    lookAheadMs: 25,
    scheduleAheadSec: 0.18,
    timerId: null,
    nextNoteTime: 0,
    currentStep: 0
  },
  seed: (Date.now() % 2147483647) || 1,
  instruments: INSTRUMENT_DEFAULTS.map(function (inst) {
    return {
      id: inst.id,
      name: inst.name,
      type: inst.type,
      engine: inst.engine,
      role: inst.role,
      enabled: inst.enabled,
      equation: inst.equation,
      volume: inst.volume,
      density: inst.density,
      pan: inst.pan,
      harmonicMix: inst.harmonicMix,
      harmonicTilt: inst.harmonicTilt,
      detune: inst.detune,
      octave: inst.octave,
      stepDiv: inst.stepDiv,
      seedOffset: inst.seedOffset,
      fx: createInstrumentFx(inst.fx),
      eqState: {},
      lastValue: 0
    };
  }),
  history: {},
  equationDebug: {},
  lastNoteSummary: "--",
  lastMixSummary: "--",
  monitor: {
    lastBpm: 112,
    bpmDelta: 0,
    trend: "Estavel",
    lastBpmChangeAt: Date.now(),
    clipHoldUntil: 0,
    peak: 0,
    clipping: false,
    low: 0,
    mid: 0,
    high: 0,
    keyStatus: "Aguardando notas",
    keyCents: 0,
    phiText: "--",
    phiClass: "",
    phiRatio: PHI,
    phiDiff: Infinity,
    advice: "Mix equilibrado.",
    recentFrequencies: []
  },
  dodecaphonic: {
    row: [],
    positions: {}
  },
  scenes: {
    enabled: true,
    selectedSlot: "A",
    quantize: "bar",
    transitionSec: 0.4,
    slots: {
      A: null,
      B: null,
      C: null
    },
    pendingRecall: null
  },
  sceneTransition: {
    untilMs: 0,
    timeConstant: 0.02
  },
  logLines: [],
  midi: {
    connected: false,
    access: null,
    selectedInputId: "all",
    selectedOutputId: "none",
    channelFilter: -1,
    lastMessage: "none",
    learnArmed: false,
    pendingTargetId: null,
    padLearnInstrumentId: null,
    padMap: {},
    noteMap: {},
    ccMap: {},
    modes: {},
    pitchBendTarget: null,
    aftertouchTarget: null,
    tapTimes: [],
    learnLastCcValue: {},
    defaultMapEnabled: true,
    factoryPresetsEnabled: true,
    clockSyncEnabled: false,
    embedInScenes: false,
    ledFeedback: false,
    clock: {
      lastTickAt: 0,
      intervals: [],
      bpm: null
    }
  }
};

state.instruments.forEach(function (inst) {
  state.history[inst.id] = [];
  state.equationDebug[inst.id] = {
    step: 0,
    raw: 0,
    fractal: 0,
    random: 0,
    combined: 0,
    threshold: 1,
    deterministicPulse: false,
    trigger: false,
    triggerReason: "boot",
    frequency: null,
    detailText: "idle"
  };
});

export function getInstrumentById(instId) {
  return state.instruments.find(function (inst) {
    return inst.id === instId;
  }) || null;
}
