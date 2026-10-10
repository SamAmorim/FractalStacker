import { getInstrumentOutput } from "../audio/buses.js";
import { audio } from "../audio/engine.js";
import { filterSweep, velocityCurve } from "../audio/envelope.js";
import { registerVoice } from "../audio/voices.js";
import { state } from "../core/state.js";

export function triggerPluck(inst, when, event) {
  const ctx = audio.ctx;
  const frequency = event.frequency;
  const velocity = velocityCurve(event.velocity);
  const detune = state.globalDetune + inst.detune;

  const saw = ctx.createOscillator();
  saw.type = "sawtooth";
  saw.frequency.setValueAtTime(frequency, when);
  saw.detune.setValueAtTime(detune, when);
  const square = ctx.createOscillator();
  square.type = "square";
  square.frequency.setValueAtTime(frequency, when);
  square.detune.setValueAtTime(-detune, when);
  const squareGain = ctx.createGain();
  squareGain.gain.value = 0.25 + inst.harmonicMix * 0.4;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 4 + event.value * 6;
  const decay = 0.09 + inst.harmonicMix * 0.25;
  const floor = Math.min(frequency * 1.5, 900);
  filterSweep(filter.frequency, when, floor + 600 + velocity * 5200 * (0.4 + inst.harmonicTilt), floor, decay);

  const gain = ctx.createGain();
  const length = Math.max(0.08, Math.min(event.duration, 0.6)) + decay;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(0.22 + velocity * 0.3, when + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);

  saw.connect(filter);
  square.connect(squareGain);
  squareGain.connect(filter);
  filter.connect(gain);
  gain.connect(getInstrumentOutput(inst));

  saw.start(when);
  square.start(when);
  saw.stop(when + length + 0.03);
  square.stop(when + length + 0.03);
  registerVoice(saw);
}
