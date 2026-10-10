import { getInstrumentOutput } from "../audio/buses.js";
import { audio } from "../audio/engine.js";
import { applyEnvelope, velocityCurve } from "../audio/envelope.js";
import { createHarmonicOscillator } from "../audio/oscillators.js";
import { registerVoice } from "../audio/voices.js";
import { state } from "../core/state.js";

export function triggerPad(inst, when, event) {
  const ctx = audio.ctx;
  const frequencies = event.frequencies || [event.frequency];
  const velocity = velocityCurve(event.velocity);
  const detune = state.globalDetune + inst.detune;
  const hold = event.duration;
  const attack = Math.min(Math.max(0.35, state.envelope.attack * 6), Math.max(0.35, hold * 0.45));

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.7 + inst.harmonicMix * 2.5;
  const closed = 280 + inst.harmonicTilt * 500;
  const open = closed + 700 + velocity * 2600;
  filter.frequency.setValueAtTime(closed, when);
  filter.frequency.exponentialRampToValueAtTime(open, when + attack * 1.4);
  filter.frequency.setTargetAtTime(closed * 1.4, when + hold, 0.6);

  const breath = ctx.createOscillator();
  breath.frequency.value = 0.07 + event.value * 0.18;
  const breathDepth = ctx.createGain();
  breathDepth.gain.value = 180 + inst.harmonicMix * 420;
  breath.connect(breathDepth);
  breathDepth.connect(filter.frequency);

  const gain = ctx.createGain();
  filter.connect(gain);
  gain.connect(getInstrumentOutput(inst));

  const level = (0.32 + velocity * 0.3) / Math.sqrt(frequencies.length);
  const stopAt = applyEnvelope(gain, when, hold, level, {
    attackMul: 1,
    decayMul: 1.5,
    sustainMul: 1.4,
    releaseMul: 4,
    minAttack: attack,
    minRelease: 1.2
  });

  const oscillators = [breath];
  frequencies.forEach(function (frequency, index) {
    const spread = frequencies.length > 1 ? (index / (frequencies.length - 1)) * 1.2 - 0.6 : 0;
    const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.5;
    if (panner) {
      panner.pan.value = spread;
      voiceGain.connect(panner);
      panner.connect(filter);
    } else {
      voiceGain.connect(filter);
    }

    const warm = createHarmonicOscillator(inst, when, frequency, event.value, 0.22 + index * 0.07, detune);
    const shimmer = ctx.createOscillator();
    shimmer.type = "sawtooth";
    shimmer.frequency.setValueAtTime(frequency, when);
    shimmer.detune.setValueAtTime(-detune - 4 + index * 3, when);
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.18 + inst.harmonicMix * 0.25;

    warm.connect(voiceGain);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(voiceGain);
    oscillators.push(warm, shimmer);
    registerVoice(warm);
  });

  oscillators.forEach(function (osc) {
    osc.start(when);
    osc.stop(stopAt + 0.1);
  });
}
