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
  lfo.frequency.value = params.wahRate;
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
  if (params.wahEnabled) {
    wah.filter.type = "bandpass";
    wah.filter.frequency.setTargetAtTime(550, now, wahTau);
    wah.lfo.frequency.setTargetAtTime(params.wahRate, now, wahTau);
    wah.lfoGain.gain.setTargetAtTime(params.wahDepth, now, wahTau);
    wah.dry.gain.setTargetAtTime(0.18, now, fxTau);
    wah.wet.gain.setTargetAtTime(0.82, now, fxTau);
  } else {
    wah.filter.type = "allpass";
    wah.lfoGain.gain.setTargetAtTime(0, now, fxTau);
    wah.dry.gain.setTargetAtTime(1, now, fxTau);
    wah.wet.gain.setTargetAtTime(0, now, fxTau);
  }
}
