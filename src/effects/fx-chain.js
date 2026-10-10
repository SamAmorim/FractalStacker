import { audio } from "../audio/engine.js";
import { state } from "../core/state.js";
import { applyDelay, createDelay } from "./delay.js";
import { applyReverb, createReverb } from "./reverb.js";
import { applyWah, createWah } from "./wah.js";
import { getSceneBlendTimeConstant } from "../scenes/scenes.js";

export function createFxChain(ctx, params) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const bypass = ctx.createGain();
  const process = ctx.createGain();
  const wah = createWah(ctx, params);
  const delay = createDelay(ctx);
  const reverb = createReverb(ctx);

  input.connect(bypass);
  bypass.connect(output);

  input.connect(wah.input);
  wah.output.connect(delay.input);
  delay.output.connect(reverb.input);
  reverb.output.connect(process);
  process.connect(output);

  return { input: input, output: output, bypass: bypass, process: process, wah: wah, delay: delay, reverb: reverb };
}

export function applyFxParams() {
  if (!audio.ready) {
    return;
  }

  const chain = audio.fxChain;
  const now = audio.ctx.currentTime;
  const fxTau = getSceneBlendTimeConstant(0.02);
  const wahTau = getSceneBlendTimeConstant(0.03);

  chain.bypass.gain.setTargetAtTime(state.fx.enabled ? 0 : 1, now, fxTau);
  chain.process.gain.setTargetAtTime(state.fx.enabled ? 1 : 0, now, fxTau);
  applyWah(chain.wah, state.fx, now, fxTau, wahTau);
  applyDelay(chain.delay, state.fx, now, fxTau);
  applyReverb(chain.reverb, state.fx, now, fxTau);
}
