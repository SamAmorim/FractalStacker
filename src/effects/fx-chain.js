import { audio } from "../audio/engine.js";
import { clamp } from "../core/math.js";
import { state } from "../core/state.js";
import { getSceneBlendTimeConstant } from "../scenes/scenes.js";
import { applyDelay, createDelay, silenceDelay } from "./delay.js";
import { applyReverb, applyReverbSize, createReverb, setReverbActive, silenceReverb } from "./reverb.js";

const FX_FLUSH_MS = 16;
let fxFlushTimer = null;
import { applyWah, createWah } from "./wah.js";

function safeDisconnect(node) {
  try {
    node.disconnect();
  } catch (error) {
    // already disconnected
  }
}

export function createFxChain(ctx, params) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const bypass = ctx.createGain();
  const process = ctx.createGain();
  const wah = createWah(ctx, params || {});
  const delay = createDelay(ctx, { pingPong: Boolean(params && params.delayPingPong) });
  const reverb = createReverb(ctx);

  input.connect(bypass);
  bypass.connect(output);

  input.connect(wah.input);
  wah.output.connect(delay.input);
  delay.output.connect(reverb.input);
  reverb.output.connect(process);
  process.connect(output);

  return {
    input: input,
    output: output,
    bypass: bypass,
    process: process,
    wah: wah,
    delay: delay,
    reverb: reverb
  };
}

export function createSendReverb(ctx) {
  return createReverb(ctx, { seconds: 2.4, decay: 2.3 });
}

export function createInsertFxChain(ctx, params) {
  const fx = params || {};
  const input = ctx.createGain();
  const output = ctx.createGain();
  const bypass = ctx.createGain();
  const process = ctx.createGain();
  const delay = createDelay(ctx, { pingPong: Boolean(fx.delayPingPong) });
  const reverb = createReverb(ctx, { seconds: 1.6, decay: 2.2, channels: 1, maxSeconds: 2.4 });

  bypass.gain.value = 1;
  process.gain.value = 0;

  input.connect(bypass);
  bypass.connect(output);
  input.connect(delay.input);
  delay.output.connect(reverb.input);
  reverb.output.connect(process);
  process.connect(output);

  return {
    input: input,
    output: output,
    bypass: bypass,
    process: process,
    delay: delay,
    reverb: reverb
  };
}

export function rebuildDelayNode(chain, pingPong, isInsert) {
  if (!audio.ready || !chain || !chain.delay) {
    return;
  }
  const next = createDelay(audio.ctx, { pingPong: Boolean(pingPong) });
  const prev = chain.delay;

  if (isInsert) {
    safeDisconnect(chain.input);
    chain.input.connect(chain.bypass);
    chain.input.connect(next.input);
    next.output.connect(chain.reverb.input);
  } else {
    safeDisconnect(chain.wah.output);
    chain.wah.output.connect(next.input);
    next.output.connect(chain.reverb.input);
  }

  safeDisconnect(prev.output);
  chain.delay = next;
}

export function applyInsertFxParams(chain, params, now, tau) {
  if (!chain || !params) {
    return;
  }

  const key = JSON.stringify(params) + "|" + state.bpm;
  if (chain.appliedKey === key) {
    return;
  }
  chain.appliedKey = key;

  const active = Boolean(params.delayEnabled || params.reverbEnabled);
  if (chain.bypass && chain.process) {
    chain.bypass.gain.setTargetAtTime(active ? 0 : 1, now, tau);
    chain.process.gain.setTargetAtTime(active ? 1 : 0, now, tau);
  }

  if (Boolean(chain.delay.pingPong) !== Boolean(params.delayPingPong)) {
    rebuildDelayNode(chain, params.delayPingPong, true);
  }

  applyDelay(chain.delay, params, now, tau, state.bpm);
  applyReverb(chain.reverb, params, now, tau);
}

/** Coalesces bursts of control changes (MIDI knobs send ~100 msg/s) into one audio update per frame. */
export function applyFxParams() {
  if (fxFlushTimer) {
    return;
  }
  fxFlushTimer = setTimeout(function () {
    fxFlushTimer = null;
    applyFxParamsNow();
  }, FX_FLUSH_MS);
}

export function applyFxParamsNow() {
  if (fxFlushTimer) {
    clearTimeout(fxFlushTimer);
    fxFlushTimer = null;
  }
  if (!audio.ready) {
    return;
  }

  const chain = audio.fxChain;
  const now = audio.ctx.currentTime;
  const fxTau = getSceneBlendTimeConstant(0.02);
  const wahTau = getSceneBlendTimeConstant(0.03);

  const masterKey = JSON.stringify(state.fx) + "|" + state.bpm;
  if (chain.appliedKey !== masterKey) {
    chain.appliedKey = masterKey;
    chain.bypass.gain.setTargetAtTime(state.fx.enabled ? 0 : 1, now, fxTau);
    chain.process.gain.setTargetAtTime(state.fx.enabled ? 1 : 0, now, fxTau);

    if (Boolean(chain.delay.pingPong) !== Boolean(state.fx.delayPingPong)) {
      rebuildDelayNode(chain, state.fx.delayPingPong, false);
    }

    applyWah(chain.wah, state.fx, now, fxTau, wahTau);
    applyDelay(chain.delay, state.fx, now, fxTau, state.bpm);
    applyReverb(chain.reverb, state.fx, now, fxTau, !state.fx.enabled);

    if (audio.sendReverb) {
      applyReverbSize(audio.sendReverb, state.fx.reverbSize);
      audio.sendReverb.dry.gain.setTargetAtTime(0, now, fxTau);
      audio.sendReverb.wet.gain.setTargetAtTime(1, now, fxTau);
    }
  }

  let anySend = false;
  state.instruments.forEach(function (inst) {
    const bus = audio.instrumentBuses[inst.id];
    const send = clamp(Number(inst.fx && inst.fx.sendAmount) || 0, 0, 1);
    if (send > 0.001) {
      anySend = true;
    }
    if (bus && bus.fx) {
      applyInsertFxParams(bus.fx, inst.fx, now, fxTau);
    }
    if (bus && bus.sendGain && bus.appliedSend !== send) {
      bus.appliedSend = send;
      bus.sendGain.gain.setTargetAtTime(send, now, fxTau);
    }
  });
  setReverbActive(audio.sendReverb, anySend);
}

function forgetAppliedFx() {
  if (audio.fxChain) {
    audio.fxChain.appliedKey = null;
  }
  Object.keys(audio.instrumentBuses || {}).forEach(function (instId) {
    const bus = audio.instrumentBuses[instId];
    if (bus && bus.fx) {
      bus.fx.appliedKey = null;
    }
    if (bus) {
      bus.appliedSend = null;
    }
  });
}

export function silenceAllFx() {
  if (!audio.ready || !audio.ctx) {
    return;
  }
  forgetAppliedFx();
  const now = audio.ctx.currentTime;
  const chain = audio.fxChain;
  if (chain) {
    silenceDelay(chain.delay, now);
    silenceReverb(chain.reverb, now);
  }
  if (audio.sendReverb) {
    silenceReverb(audio.sendReverb, now);
  }
  Object.keys(audio.instrumentBuses || {}).forEach(function (instId) {
    const bus = audio.instrumentBuses[instId];
    if (!bus || !bus.fx) {
      return;
    }
    silenceDelay(bus.fx.delay, now);
    silenceReverb(bus.fx.reverb, now);
    if (bus.sendGain) {
      bus.sendGain.gain.cancelScheduledValues(now);
      bus.sendGain.gain.setValueAtTime(0, now);
    }
  });
}

/** Apply Space macro: one 0–1 value rides master delay mix + reverb. */
export function applyFxSpaceMacro(normalized) {
  const amount = clamp(Number(normalized) || 0, 0, 1);
  state.fx.enabled = true;
  state.fx.delayEnabled = true;
  state.fx.reverbEnabled = true;
  state.fx.delayMix = Math.round(amount * 0.72 * 100) / 100;
  state.fx.reverbAmount = Math.round(amount * 0.85 * 100) / 100;

  const fxEnabled = document.getElementById("fxEnabled");
  const delayEnabled = document.getElementById("delayEnabled");
  const reverbEnabled = document.getElementById("reverbEnabled");
  const delayMix = document.getElementById("delayMix");
  const reverbAmount = document.getElementById("reverbAmount");

  if (fxEnabled && !fxEnabled.checked) {
    fxEnabled.checked = true;
    fxEnabled.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (delayEnabled && !delayEnabled.checked) {
    delayEnabled.checked = true;
    delayEnabled.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (reverbEnabled && !reverbEnabled.checked) {
    reverbEnabled.checked = true;
    reverbEnabled.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (delayMix) {
    delayMix.value = String(state.fx.delayMix);
    delayMix.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (reverbAmount) {
    reverbAmount.value = String(state.fx.reverbAmount);
    reverbAmount.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (!delayMix && !reverbAmount) {
    applyFxParams();
  }
}
