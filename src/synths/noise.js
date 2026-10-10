import { getInstrumentOutput } from "../audio/buses.js";
import { audio } from "../audio/engine.js";
import { velocityCurve } from "../audio/envelope.js";
import { registerVoice } from "../audio/voices.js";

function noiseThrough(when, duration, filters) {
  const source = audio.ctx.createBufferSource();
  source.buffer = audio.noiseBuffer;
  source.loop = true;
  let node = source;
  filters.forEach(function (spec) {
    const filter = audio.ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.frequency;
    filter.Q.value = spec.q;
    node.connect(filter);
    node = filter;
    spec.node = filter;
  });
  source.start(when, Math.random() * 1.5);
  source.stop(when + duration + 0.1);
  registerVoice(source);
  return node;
}

function swell(inst, when, event, velocity) {
  const duration = event.duration;
  const filters = [{ type: "bandpass", frequency: 300, q: 3 + inst.harmonicMix * 6 }, { type: "highpass", frequency: 180, q: 0.5 }];
  const out = noiseThrough(when, duration, filters);
  filters[0].node.frequency.exponentialRampToValueAtTime(5200 + inst.harmonicTilt * 4000, when + duration);
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.35 * velocity + 0.05, when + duration * 0.95);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.08);
  out.connect(gain);
  gain.connect(getInstrumentOutput(inst));
}

function air(inst, when, event, velocity) {
  const duration = event.duration;
  const tonal = event.frequency ? event.frequency * 4 : 1200;
  const filters = [{ type: "lowpass", frequency: 900 + event.value * 1800, q: 0.4 }, { type: "peaking", frequency: tonal, q: 9 }];
  const out = noiseThrough(when, duration + 2, filters);
  filters[1].node.gain.value = 14 + inst.harmonicMix * 10;
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(0.12 * velocity + 0.02, when + Math.min(1.5, duration * 0.4));
  gain.gain.setValueAtTime(0.12 * velocity + 0.02, when + duration);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration + 2);
  out.connect(gain);
  gain.connect(getInstrumentOutput(inst));
}

function grain(inst, when, event, velocity) {
  const duration = 0.04 + event.value * 0.14;
  const out = noiseThrough(when, duration, [{ type: "bandpass", frequency: 1500 + event.value * 6000, q: 2 + inst.harmonicMix * 10 }]);
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(0.25 * velocity, when + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  out.connect(gain);
  gain.connect(getInstrumentOutput(inst));
}

export function triggerNoise(inst, when, event) {
  const velocity = velocityCurve(event.velocity);
  if (event.kind === "swell") return swell(inst, when, event, velocity);
  if (event.kind === "air") return air(inst, when, event, velocity);
  return grain(inst, when, event, velocity);
}
