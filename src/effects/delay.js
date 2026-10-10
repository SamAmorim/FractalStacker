import { clamp } from "../core/math.js";
import { resolveDelayTimeSeconds } from "./delay-sync.js";

export function createDelay(ctx, options) {
  const opts = options || {};
  const pingPong = Boolean(opts.pingPong);
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const feedback = ctx.createGain();

  input.connect(dry);
  dry.connect(output);

  if (!pingPong) {
    const line = ctx.createDelay(2);
    input.connect(line);
    line.connect(feedback);
    feedback.connect(line);
    line.connect(wet);
    wet.connect(output);
    return {
      input: input,
      output: output,
      dry: dry,
      wet: wet,
      line: line,
      lineL: null,
      lineR: null,
      feedback: feedback,
      fbL: null,
      fbR: null,
      pingPong: false
    };
  }

  const lineL = ctx.createDelay(2);
  const lineR = ctx.createDelay(2);
  const fbL = ctx.createGain();
  const merger = ctx.createChannelMerger(2);
  const wetL = ctx.createGain();
  const wetR = ctx.createGain();

  input.connect(lineL);
  lineL.connect(wetL);
  wetL.connect(merger, 0, 0);
  lineL.connect(lineR);
  lineR.connect(wetR);
  wetR.connect(merger, 0, 1);
  lineR.connect(fbL);
  fbL.connect(lineL);
  merger.connect(wet);
  wet.connect(output);

  wetL.gain.value = 1;
  wetR.gain.value = 1;

  return {
    input: input,
    output: output,
    dry: dry,
    wet: wet,
    line: lineL,
    lineL: lineL,
    lineR: lineR,
    feedback: feedback,
    fbL: fbL,
    fbR: null,
    pingPong: true
  };
}

function setFeedback(delay, value, now, tau) {
  const amount = clamp(value, 0, 0.95);
  if (delay.pingPong && delay.fbL) {
    delay.fbL.gain.setTargetAtTime(amount, now, tau);
    delay.feedback.gain.setTargetAtTime(amount, now, tau);
    return;
  }
  delay.feedback.gain.setTargetAtTime(amount, now, tau);
}

function setDelayTime(delay, seconds, now, tau) {
  const time = clamp(seconds, 0, 1.99);
  if (delay.lineL) {
    delay.lineL.delayTime.setTargetAtTime(time, now, tau);
  }
  if (delay.lineR) {
    delay.lineR.delayTime.setTargetAtTime(time, now, tau);
  }
  if (delay.line && !delay.lineL) {
    delay.line.delayTime.setTargetAtTime(time, now, tau);
  }
}

export function applyDelay(delay, params, now, tau, bpm) {
  const mix = clamp(Number(params.delayMix) || 0, 0, 1);
  const dryGain = params.delayEnabled ? 1 - mix : 1;
  const wetGain = params.delayEnabled ? mix : 0;
  const time = resolveDelayTimeSeconds(params, bpm);

  if (params.delayEnabled) {
    setDelayTime(delay, time, now, tau);
    setFeedback(delay, Number(params.delayFeedback) || 0, now, tau);
  } else {
    setFeedback(delay, 0, now, tau);
  }

  delay.dry.gain.setTargetAtTime(dryGain, now, tau);
  delay.wet.gain.setTargetAtTime(wetGain, now, tau);
}

export function silenceDelay(delay, now) {
  if (!delay) {
    return;
  }
  if (delay.feedback) {
    delay.feedback.gain.cancelScheduledValues(now);
    delay.feedback.gain.setValueAtTime(0, now);
  }
  if (delay.fbL) {
    delay.fbL.gain.cancelScheduledValues(now);
    delay.fbL.gain.setValueAtTime(0, now);
  }
  if (delay.wet) {
    delay.wet.gain.cancelScheduledValues(now);
    delay.wet.gain.setValueAtTime(0, now);
  }
}
