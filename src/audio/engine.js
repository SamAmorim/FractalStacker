import { createNoiseBuffer } from "./buffers.js";
import { ensureInstrumentBus, updateInstrumentMix } from "./buses.js";
import { state } from "../core/state.js";
import { applyFxParams, createFxChain } from "../effects/fx-chain.js";

export const audio = {
  ready: false,
  ctx: null,
  activeVoices: 0,
  instrumentBuses: {},
  noiseBuffer: null,
  masterInput: null,
  fxChain: null,
  compressor: null,
  masterGain: null,
  meterAnalyser: null,
  meterTimeData: null,
  meterFreqData: null
};

export function ensureAudio() {
  if (audio.ready) {
    return Promise.resolve();
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return Promise.reject(new Error("Web Audio API unavailable"));
  }

  audio.ctx = new AudioCtx();
  audio.instrumentBuses = {};
  audio.masterInput = audio.ctx.createGain();
  audio.masterInput.gain.value = 1;

  audio.fxChain = createFxChain(audio.ctx, state.fx);

  audio.compressor = audio.ctx.createDynamicsCompressor();
  audio.compressor.threshold.value = -14;
  audio.compressor.knee.value = 22;
  audio.compressor.ratio.value = 5;
  audio.compressor.attack.value = 0.003;
  audio.compressor.release.value = 0.22;

  audio.masterGain = audio.ctx.createGain();
  audio.masterGain.gain.value = state.masterVolume;
  audio.meterAnalyser = audio.ctx.createAnalyser();
  audio.meterAnalyser.fftSize = 2048;
  audio.meterAnalyser.smoothingTimeConstant = 0.82;
  audio.meterTimeData = new Float32Array(audio.meterAnalyser.fftSize);
  audio.meterFreqData = new Uint8Array(audio.meterAnalyser.frequencyBinCount);

  audio.noiseBuffer = createNoiseBuffer(audio.ctx, 2.4);

  audio.masterInput.connect(audio.fxChain.input);
  audio.fxChain.output.connect(audio.compressor);
  audio.compressor.connect(audio.masterGain);
  audio.masterGain.connect(audio.meterAnalyser);
  audio.meterAnalyser.connect(audio.ctx.destination);

  state.instruments.forEach(function (inst) {
    ensureInstrumentBus(inst);
    updateInstrumentMix(inst);
  });

  audio.ready = true;
  applyFxParams();
  return Promise.resolve();
}

export function hardSilence() {
  if (!audio.ready || !audio.ctx) {
    return;
  }

  const now = audio.ctx.currentTime;
  audio.masterGain.gain.cancelScheduledValues(now);
  audio.masterGain.gain.setValueAtTime(0, now);

  const chain = audio.fxChain;
  if (chain && chain.delay) {
    chain.delay.feedback.gain.cancelScheduledValues(now);
    chain.delay.feedback.gain.setValueAtTime(0, now);
    chain.delay.wet.gain.cancelScheduledValues(now);
    chain.delay.wet.gain.setValueAtTime(0, now);
  }
}

export function restoreMasterLevel() {
  if (!audio.ready || !audio.ctx) {
    return;
  }

  const now = audio.ctx.currentTime;
  audio.masterGain.gain.cancelScheduledValues(now);
  audio.masterGain.gain.setValueAtTime(state.masterVolume, now);
  applyFxParams();
}
