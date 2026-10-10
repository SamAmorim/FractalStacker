import { seededRandom } from "../core/math.js";

function createImpulseResponse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const n = i / length;
      data[i] = (seededRandom() * 2 - 1) * Math.pow(1 - n, decay);
    }
  }
  return impulse;
}

export function createReverb(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulseResponse(ctx, 2.8, 2.5);

  input.connect(dry);
  input.connect(convolver);
  convolver.connect(wet);
  dry.connect(output);
  wet.connect(output);

  return { input: input, output: output, dry: dry, wet: wet, convolver: convolver };
}

export function applyReverb(reverb, params, now, tau) {
  reverb.dry.gain.setTargetAtTime(1, now, tau);
  reverb.wet.gain.setTargetAtTime(params.reverbEnabled ? params.reverbAmount : 0, now, tau);
}
