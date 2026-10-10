import { clamp } from "../core/math.js";
import { state } from "../core/state.js";

export const DELAY_SYNC_OPTIONS = [
  { value: "off", label: "Free (ms)" },
  { value: "1/4", label: "1/4" },
  { value: "1/8", label: "1/8" },
  { value: "1/8d", label: "1/8 dotted" },
  { value: "1/16", label: "1/16" }
];

const BEATS = {
  "1/4": 1,
  "1/8": 0.5,
  "1/8d": 0.75,
  "1/16": 0.25
};

export function syncedDelaySeconds(division, bpm) {
  const beats = BEATS[division];
  if (!beats) {
    return null;
  }
  const tempo = Number(bpm) || state.bpm || 120;
  return clamp((60 / tempo) * beats, 0.001, 1.99);
}

export function resolveDelayTimeSeconds(params, bpm) {
  const synced = syncedDelaySeconds(params && params.delaySync, bpm);
  if (synced != null) {
    return synced;
  }
  return clamp(Number(params && params.delayTime) || 0, 0, 1.99);
}
