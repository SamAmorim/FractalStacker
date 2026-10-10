import { audio } from "./engine.js";
import { clamp } from "../core/math.js";
import { applyInsertFxParams, createInsertFxChain } from "../effects/fx-chain.js";
import { getSceneBlendTimeConstant } from "../scenes/scenes.js";

export function ensureInstrumentBus(inst) {
  if (!audio.ctx) {
    return null;
  }

  if (audio.instrumentBuses[inst.id]) {
    return audio.instrumentBuses[inst.id];
  }

  const gain = audio.ctx.createGain();
  gain.gain.value = clamp(inst.volume, 0, 1);
  const duck = audio.ctx.createGain();
  const fx = createInsertFxChain(audio.ctx, inst.fx || {});
  const sendGain = audio.ctx.createGain();
  sendGain.gain.value = clamp(Number(inst.fx && inst.fx.sendAmount) || 0, 0, 1);

  gain.connect(duck);
  duck.connect(fx.input);
  duck.connect(sendGain);
  if (audio.sendReverb) {
    sendGain.connect(audio.sendReverb.input);
  }

  let panner = null;
  if (typeof audio.ctx.createStereoPanner === "function") {
    panner = audio.ctx.createStereoPanner();
    panner.pan.value = clamp(inst.pan, -1, 1);
    fx.output.connect(panner);
    panner.connect(audio.masterInput);
  } else {
    fx.output.connect(audio.masterInput);
  }

  const bus = {
    gain: gain,
    duck: duck,
    fx: fx,
    sendGain: sendGain,
    panner: panner
  };
  audio.instrumentBuses[inst.id] = bus;
  applyInsertFxParams(fx, inst.fx || {}, audio.ctx.currentTime, 0.01);
  return bus;
}

export function getInstrumentOutput(inst) {
  const bus = ensureInstrumentBus(inst);
  return bus ? bus.gain : audio.masterInput;
}

export function duckBuses(when, depth, recoverySec, exceptId) {
  if (!audio.ctx || depth <= 0) {
    return;
  }
  Object.keys(audio.instrumentBuses).forEach(function (instId) {
    if (instId === exceptId) {
      return;
    }
    const duck = audio.instrumentBuses[instId].duck.gain;
    duck.cancelScheduledValues(when);
    duck.setTargetAtTime(1 - clamp(depth, 0, 1) * 0.8, when, 0.004);
    duck.setTargetAtTime(1, when + 0.03, recoverySec / 3);
  });
}

export function updateInstrumentMix(inst) {
  if (!audio.ctx) {
    return;
  }

  const bus = ensureInstrumentBus(inst);
  if (!bus) {
    return;
  }

  const now = audio.ctx.currentTime;
  const mixTau = getSceneBlendTimeConstant(0.03);
  bus.gain.gain.setTargetAtTime(clamp(inst.volume, 0, 1), now, mixTau);
  if (bus.panner) {
    bus.panner.pan.setTargetAtTime(clamp(inst.pan, -1, 1), now, mixTau);
  }
  if (bus.fx && inst.fx) {
    applyInsertFxParams(bus.fx, inst.fx, now, getSceneBlendTimeConstant(0.02));
  }
  if (bus.sendGain && inst.fx) {
    bus.sendGain.gain.setTargetAtTime(clamp(Number(inst.fx.sendAmount) || 0, 0, 1), now, mixTau);
  }
}
