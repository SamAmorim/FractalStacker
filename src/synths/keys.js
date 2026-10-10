import { getInstrumentOutput } from "../audio/buses.js";
import { audio } from "../audio/engine.js";
import { applyEnvelope, velocityCurve } from "../audio/envelope.js";
import { createHarmonicOscillator } from "../audio/oscillators.js";
import { registerVoice } from "../audio/voices.js";
import { state } from "../core/state.js";

export function triggerKeys(inst, when, event) {
  const ctx = audio.ctx;
  const frequency = event.frequency;
  const velocity = velocityCurve(event.velocity);
  const detune = state.globalDetune + inst.detune;
  const ratio = 1 + Math.round(inst.harmonicTilt * 2);

  const carrier = ctx.createOscillator();
  carrier.type = "sine";
  carrier.frequency.setValueAtTime(frequency, when);
  carrier.detune.setValueAtTime(detune, when);

  const modulator = ctx.createOscillator();
  modulator.type = "sine";
  modulator.frequency.setValueAtTime(frequency * ratio, when);
  const modIndex = ctx.createGain();
  const peakIndex = frequency * (1.2 + velocity * 3.2);
  modIndex.gain.setValueAtTime(peakIndex, when);
  modIndex.gain.exponentialRampToValueAtTime(Math.max(1, frequency * 0.25), when + 0.18 + inst.harmonicMix * 0.5);
  modulator.connect(modIndex);
  modIndex.connect(carrier.frequency);

  const body = createHarmonicOscillator(inst, when, frequency, event.value, 0.33, -detune * 0.5);
  const bodyGain = ctx.createGain();
  bodyGain.gain.value = 0.15 + inst.harmonicMix * 0.35;

  const oscillators = [carrier, modulator, body];
  if (event.duration > 0.35) {
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.1;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.setValueAtTime(0, when);
    vibratoDepth.gain.linearRampToValueAtTime(7, when + Math.min(0.6, event.duration * 0.6));
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(carrier.detune);
    vibratoDepth.connect(body.detune);
    oscillators.push(vibrato);
  }

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1800 + velocity * 5200;
  filter.Q.value = 0.5;
  const gain = ctx.createGain();

  carrier.connect(filter);
  body.connect(bodyGain);
  bodyGain.connect(filter);
  filter.connect(gain);
  gain.connect(getInstrumentOutput(inst));

  const stopAt = applyEnvelope(gain, when, event.duration, 0.3 + velocity * 0.35, {
    attackMul: 0.3,
    decayMul: 1.6,
    sustainMul: 0.75,
    releaseMul: 1.6,
    minRelease: 0.12
  });

  oscillators.forEach(function (osc) {
    osc.start(when);
    osc.stop(stopAt + 0.05);
  });
  registerVoice(carrier);
}
