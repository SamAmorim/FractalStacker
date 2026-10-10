import { getInstrumentOutput } from "../audio/buses.js";
import { createDrive } from "../audio/drive.js";
import { audio } from "../audio/engine.js";
import { applyEnvelope, filterSweep, velocityCurve } from "../audio/envelope.js";
import { createHarmonicOscillator } from "../audio/oscillators.js";
import { registerVoice } from "../audio/voices.js";
import { state } from "../core/state.js";

function setPitch(osc, when, frequency, glideFrom) {
  if (glideFrom) {
    osc.frequency.setValueAtTime(Math.max(20, glideFrom), when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency), when + 0.07);
  } else {
    osc.frequency.setValueAtTime(Math.max(20, frequency), when);
  }
}

export function triggerBass(inst, when, event) {
  const ctx = audio.ctx;
  const frequency = event.frequency;
  const velocity = velocityCurve(event.velocity);
  const detune = state.globalDetune + inst.detune;
  const glideFrom = event.glideFrom || null;

  const character = createHarmonicOscillator(inst, when, frequency, event.value, 0.12, detune * 0.5);
  setPitch(character, when, frequency, glideFrom);
  const saw = ctx.createOscillator();
  saw.type = "sawtooth";
  saw.detune.setValueAtTime(-detune, when);
  setPitch(saw, when, frequency, glideFrom);
  const sub = ctx.createOscillator();
  sub.type = "sine";
  const subRatio = frequency > 70 ? 0.5 : 1;
  setPitch(sub, when, frequency * subRatio, glideFrom ? glideFrom * subRatio : null);

  const sawGain = ctx.createGain();
  sawGain.gain.value = 0.35 + inst.harmonicMix * 0.3;
  const subGain = ctx.createGain();
  subGain.gain.value = 0.9;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 2 + event.value * 7;
  const base = 90 + inst.harmonicTilt * 380;
  filterSweep(filter.frequency, when, base + 300 + velocity * 2600, base, 0.12 + (1 - inst.harmonicTilt) * 0.2);

  const drive = createDrive(ctx, 0.15 + inst.harmonicMix * 0.45);
  const gain = ctx.createGain();

  character.connect(filter);
  saw.connect(sawGain);
  sawGain.connect(filter);
  filter.connect(drive);
  drive.connect(gain);
  sub.connect(subGain);
  subGain.connect(gain);
  gain.connect(getInstrumentOutput(inst));

  const stopAt = applyEnvelope(gain, when, event.duration, 0.55 + velocity * 0.4, {
    attackMul: 0.3,
    decayMul: 0.8,
    sustainMul: 1.1,
    releaseMul: 0.5,
    minRelease: 0.05
  });

  [character, saw, sub].forEach(function (osc) {
    osc.start(when);
    osc.stop(stopAt + 0.05);
  });
  registerVoice(sub);
}
