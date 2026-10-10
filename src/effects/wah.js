import { clamp } from "../core/math.js";

export function createWah(ctx, params) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "allpass";
  filter.Q.value = 8;
  filter.frequency.value = 700;

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = params.wahRate || 1.6;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  input.connect(dry);
  input.connect(filter);
  filter.connect(wet);
  dry.connect(output);
  wet.connect(output);
  lfo.start();

  return { input: input, output: output, dry: dry, wet: wet, filter: filter, lfo: lfo, lfoGain: lfoGain };
}

export function applyWah(wah, params, now, fxTau, wahTau) {
  if (!params.wahEnabled) {
    wah.filter.type = "allpass";
    wah.lfoGain.gain.setTargetAtTime(0, now, fxTau);
    wah.dry.gain.setTargetAtTime(1, now, fxTau);
    wah.wet.gain.setTargetAtTime(0, now, fxTau);
    return;
  }

  wah.filter.type = "bandpass";
  wah.dry.gain.setTargetAtTime(0.18, now, fxTau);
  wah.wet.gain.setTargetAtTime(0.82, now, fxTau);

  const mode = params.wahMode === "expression" ? "expression" : "lfo";
  if (mode === "expression") {
    const position = clamp(Number(params.wahPosition) || 0, 0, 1);
    const freq = 220 + position * 2600;
    wah.lfoGain.gain.setTargetAtTime(0, now, wahTau);
    wah.filter.frequency.setTargetAtTime(freq, now, wahTau);
    return;
  }

  wah.filter.frequency.setTargetAtTime(550, now, wahTau);
  wah.lfo.frequency.setTargetAtTime(params.wahRate || 1.6, now, wahTau);
  wah.lfoGain.gain.setTargetAtTime(params.wahDepth || 820, now, wahTau);
}
