import { canSpawnVoice } from "../audio/voices.js";
import { triggerBass } from "./bass.js";
import { triggerDrums } from "./drums.js";
import { triggerKeys } from "./keys.js";
import { triggerNoise } from "./noise.js";
import { triggerPad } from "./pad.js";
import { triggerPluck } from "./pluck.js";

const SYNTHS = {
  drums: triggerDrums,
  bass: triggerBass,
  pad: triggerPad,
  keys: triggerKeys,
  pluck: triggerPluck,
  noise: triggerNoise
};

// event: { frequency?, frequencies?, velocity, duration, value, voice?, kind?, glideFrom? }
export function playEvent(inst, when, event) {
  if (!canSpawnVoice(inst.role)) {
    return false;
  }
  const synth = SYNTHS[inst.engine];
  if (!synth) {
    return false;
  }
  synth(inst, Math.max(when, 0), event);
  return true;
}
