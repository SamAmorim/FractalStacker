export function createDelay(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const line = ctx.createDelay(2);
  const feedback = ctx.createGain();

  input.connect(dry);
  input.connect(line);
  line.connect(feedback);
  feedback.connect(line);
  line.connect(wet);
  dry.connect(output);
  wet.connect(output);

  return { input: input, output: output, dry: dry, wet: wet, line: line, feedback: feedback };
}

export function applyDelay(delay, params, now, tau) {
  if (params.delayEnabled) {
    delay.line.delayTime.setTargetAtTime(params.delayTime, now, tau);
    delay.feedback.gain.setTargetAtTime(params.delayFeedback, now, tau);
    delay.dry.gain.setTargetAtTime(1, now, tau);
    delay.wet.gain.setTargetAtTime(params.delayMix, now, tau);
  } else {
    delay.feedback.gain.setTargetAtTime(0, now, tau);
    delay.dry.gain.setTargetAtTime(1, now, tau);
    delay.wet.gain.setTargetAtTime(0, now, tau);
  }
}
