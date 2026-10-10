import { playArp } from "./arp.js";
import { playBass } from "./bass.js";
import { legacyPitched, rest } from "./common.js";
import { playDrums } from "./drums.js";
import { playLead } from "./lead.js";
import { playPad } from "./pad.js";
import { playTexture } from "./texture.js";

const PLAYERS = {
  drums: playDrums,
  bass: playBass,
  pad: playPad,
  lead: playLead,
  arp: playArp,
  texture: playTexture
};

export function playRole(inst, eq, ctx) {
  if (!inst.enabled) {
    return rest("disabled", 1);
  }
  const player = PLAYERS[inst.role];
  return player ? player(inst, eq, ctx) : legacyPitched(inst, eq, ctx, 0.8);
}
