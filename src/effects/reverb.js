import { clamp, createRng } from "../core/math.js";

const sharedImpulses = {};
const irRng = createRng(0x5eedf00d);
const SIZE_STEPS = 8;
const SIZE_SETTLE_MS = 140;
const RELEASE_MS = 600;

function createImpulseResponse(ctx, seconds, decay, channels) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const impulse = ctx.createBuffer(channels, length, ctx.sampleRate);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const n = i / length;
      data[i] = (irRng() * 2 - 1) * Math.pow(1 - n, decay);
    }
  }
  return impulse;
}

function getSharedImpulse(ctx, seconds, decay, channels) {
  const key = ctx.sampleRate + ":" + seconds.toFixed(2) + ":" + decay.toFixed(2) + ":" + channels;
  if (!sharedImpulses[key]) {
    sharedImpulses[key] = createImpulseResponse(ctx, seconds, decay, channels);
  }
  return sharedImpulses[key];
}

function quantizeSize(size) {
  const amount = clamp(Number(size) || 0.45, 0, 1);
  return Math.round(amount * SIZE_STEPS) / SIZE_STEPS;
}

export function sizeToReverbSeconds(size, baseSeconds, maxSeconds) {
  const base = Number(baseSeconds) || 2.2;
  return clamp(0.6 + quantizeSize(size) * (base * 1.35), 0.5, maxSeconds || 4.5);
}

export function sizeToReverbDecay(size) {
  return clamp(1.4 + quantizeSize(size) * 2.2, 1.2, 4);
}

export function createReverb(ctx, options) {
  const opts = options || {};
  const seconds = opts.seconds || 2.8;
  const decay = opts.decay || 2.5;
  const channels = opts.channels || 2;
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = getSharedImpulse(ctx, seconds, decay, channels);
  wet.gain.value = 0;

  input.connect(dry);
  dry.connect(output);
  wet.connect(output);

  const reverb = {
    input: input,
    output: output,
    dry: dry,
    wet: wet,
    convolver: convolver,
    channels: channels,
    maxSeconds: opts.maxSeconds || 4.5,
    baseSeconds: seconds,
    baseDecay: decay,
    currentSeconds: seconds,
    currentDecay: decay,
    active: false,
    releaseTimer: null,
    sizeTimer: null,
    pendingSize: null
  };
  prewarmReverbImpulses(reverb);
  return reverb;
}

// A convolver only costs CPU while it is reachable from the destination,
// so idle reverbs are detached after their wet level has faded out.
export function setReverbActive(reverb, active) {
  if (!reverb || !reverb.convolver) {
    return;
  }
  if (active) {
    if (reverb.releaseTimer) {
      clearTimeout(reverb.releaseTimer);
      reverb.releaseTimer = null;
    }
    if (!reverb.active) {
      if (reverb.pendingSize != null) {
        swapImpulse(reverb, reverb.pendingSize);
      }
      reverb.input.connect(reverb.convolver);
      reverb.convolver.connect(reverb.wet);
      reverb.active = true;
    }
    return;
  }
  if (!reverb.active || reverb.releaseTimer) {
    return;
  }
  reverb.releaseTimer = setTimeout(function () {
    reverb.releaseTimer = null;
    if (!reverb.active) {
      return;
    }
    try {
      reverb.input.disconnect(reverb.convolver);
      reverb.convolver.disconnect();
    } catch (error) {
      // already detached
    }
    reverb.active = false;
  }, RELEASE_MS);
}

function swapImpulse(reverb, size) {
  const seconds = sizeToReverbSeconds(size, reverb.baseSeconds, reverb.maxSeconds);
  const decay = sizeToReverbDecay(size);
  if (seconds === reverb.currentSeconds && decay === reverb.currentDecay) {
    return;
  }
  reverb.currentSeconds = seconds;
  reverb.currentDecay = decay;
  reverb.convolver.buffer = getSharedImpulse(reverb.convolver.context, seconds, decay, reverb.channels);
}

export function applyReverbSize(reverb, size) {
  if (!reverb || !reverb.convolver) {
    return;
  }
  reverb.pendingSize = size;
  if (reverb.sizeTimer) {
    clearTimeout(reverb.sizeTimer);
    reverb.sizeTimer = null;
  }
  if (!reverb.active) {
    return;
  }
  reverb.sizeTimer = setTimeout(function () {
    reverb.sizeTimer = null;
    swapImpulse(reverb, reverb.pendingSize);
  }, SIZE_SETTLE_MS);
}

// Builds every impulse a reverb can switch to during idle time,
// so knob moves never generate buffers mid-performance.
function prewarmReverbImpulses(reverb) {
  if (!reverb || !reverb.convolver) {
    return;
  }
  const ctx = reverb.convolver.context;
  const idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 40); };
  let step = 0;
  function next() {
    if (step > SIZE_STEPS) {
      return;
    }
    const size = step / SIZE_STEPS;
    getSharedImpulse(ctx, sizeToReverbSeconds(size, reverb.baseSeconds, reverb.maxSeconds), sizeToReverbDecay(size), reverb.channels);
    step += 1;
    idle(next);
  }
  idle(next);
}

export function applyReverb(reverb, params, now, tau, forceOff) {
  const amount = params.reverbEnabled && !forceOff ? clamp(Number(params.reverbAmount) || 0, 0, 1) : 0;
  setReverbActive(reverb, amount > 0.001);
  if (params.reverbSize != null) {
    applyReverbSize(reverb, params.reverbSize);
  }
  // True wet/dry: amount trades dry for wet instead of stacking level.
  reverb.dry.gain.setTargetAtTime(1 - amount * 0.85, now, tau);
  reverb.wet.gain.setTargetAtTime(amount, now, tau);
}

export function silenceReverb(reverb, now) {
  if (!reverb || !reverb.wet) {
    return;
  }
  reverb.wet.gain.cancelScheduledValues(now);
  reverb.wet.gain.setValueAtTime(0, now);
}
