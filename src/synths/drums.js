import { getInstrumentOutput } from "../audio/buses.js";
import { audio } from "../audio/engine.js";
import { percussiveEnvelope, velocityCurve } from "../audio/envelope.js";
import { registerVoice } from "../audio/voices.js";
import { clamp } from "../core/math.js";
import { state } from "../core/state.js";

function tunedKickHz() {
  let hz = state.rootHz;
  while (hz > 62) hz /= 2;
  while (hz < 40) hz *= 2;
  return hz;
}

function noiseSource(when, duration) {
  const source = audio.ctx.createBufferSource();
  source.buffer = audio.noiseBuffer;
  const offset = Math.random() * Math.max(0, audio.noiseBuffer.duration - duration - 0.05);
  source.start(when, offset);
  source.stop(when + duration + 0.05);
  registerVoice(source);
  return source;
}

function filtered(source, type, frequency, q) {
  const filter = audio.ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  source.connect(filter);
  return filter;
}

function toOutput(node, inst, when, peak, decay) {
  const gain = audio.ctx.createGain();
  node.connect(gain);
  gain.connect(getInstrumentOutput(inst));
  return percussiveEnvelope(gain, when, peak, decay);
}

function kick(inst, when, velocity) {
  const ctx = audio.ctx;
  const body = ctx.createOscillator();
  const endHz = tunedKickHz();
  const decay = 0.32 + (1 - inst.harmonicTilt) * 0.25;
  body.type = "sine";
  body.frequency.setValueAtTime(endHz * 3.4, when);
  body.frequency.exponentialRampToValueAtTime(endHz * 1.25, when + 0.035);
  body.frequency.exponentialRampToValueAtTime(endHz, when + 0.14);
  toOutput(body, inst, when, velocity * 1.1, decay);
  body.start(when);
  body.stop(when + decay + 0.05);
  registerVoice(body);

  const click = filtered(noiseSource(when, 0.02), "highpass", 2600, 0.7);
  toOutput(click, inst, when, velocity * 0.22, 0.012);
}

function snare(inst, when, velocity) {
  const ctx = audio.ctx;
  const body = ctx.createOscillator();
  body.type = "triangle";
  body.frequency.setValueAtTime(220, when);
  body.frequency.exponentialRampToValueAtTime(165, when + 0.06);
  toOutput(body, inst, when, velocity * 0.45, 0.1);
  body.start(when);
  body.stop(when + 0.15);

  const decay = 0.14 + velocity * 0.1;
  const wires = filtered(filtered(noiseSource(when, decay), "highpass", 900, 0.6), "peaking", 3200 + inst.harmonicTilt * 2400, 1.2);
  toOutput(wires, inst, when, velocity * 0.6, decay);
}

function rim(inst, when, velocity) {
  const osc = audio.ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(820, when);
  const band = filtered(osc, "bandpass", 1750, 6);
  toOutput(band, inst, when, velocity * 0.5, 0.035);
  osc.start(when);
  osc.stop(when + 0.06);
  registerVoice(osc);
}

function hat(inst, when, velocity, open) {
  const decay = open ? 0.28 + inst.harmonicMix * 0.2 : 0.035 + velocity * 0.03;
  const brightness = 6500 + inst.harmonicTilt * 4500;
  const air = filtered(filtered(noiseSource(when, decay), "highpass", brightness, 0.8), "peaking", 10500, 1.5);
  toOutput(air, inst, when, velocity * (open ? 0.32 : 0.38), decay);
}

function tom(inst, when, velocity, pitch) {
  const osc = audio.ctx.createOscillator();
  const base = tunedKickHz() * 2 * clamp(pitch || 1, 0.5, 1.6);
  osc.type = "sine";
  osc.frequency.setValueAtTime(base * 1.6, when);
  osc.frequency.exponentialRampToValueAtTime(base, when + 0.08);
  toOutput(osc, inst, when, velocity * 0.7, 0.26);
  osc.start(when);
  osc.stop(when + 0.3);
  registerVoice(osc);
}

function crash(inst, when, velocity) {
  const decay = 1.4 + inst.harmonicMix;
  const wash = filtered(filtered(noiseSource(when, decay), "highpass", 4200, 0.5), "peaking", 7800, 0.8);
  toOutput(wash, inst, when, velocity * 0.28, decay);
}

export function triggerDrums(inst, when, event) {
  const velocity = velocityCurve(event.velocity);
  switch (event.voice) {
    case "kick": return kick(inst, when, velocity);
    case "snare": return snare(inst, when, velocity);
    case "rim": return rim(inst, when, velocity);
    case "openHat": return hat(inst, when, velocity, true);
    case "tom": return tom(inst, when, velocity, event.pitch);
    case "crash": return crash(inst, when, velocity);
    default: return hat(inst, when, velocity, false);
  }
}
