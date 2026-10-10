import { getDrumHits, getLegacyDrumHit } from "../../composition/groove.js";
import { legacyGate, play, rest } from "./common.js";

export function playDrums(inst, eq, ctx) {
  if (ctx.legacy || !ctx.groove) {
    const decision = legacyGate(inst, eq, ctx);
    if (!decision.trigger) {
      return rest(decision.reason, decision.threshold);
    }
    const hit = getLegacyDrumHit(eq.combined);
    return play([Object.assign({ duration: 0, value: eq.combined }, hit)], "classic:" + hit.voice, decision.threshold);
  }

  const hits = getDrumHits(ctx.groove, ctx, inst, eq.combined, ctx.rng);
  if (!hits.length) {
    return rest("groove-rest", 1 - ctx.energy);
  }
  const events = hits.map(function (hit) {
    return Object.assign({ duration: 0, value: eq.combined }, hit);
  });
  return play(events, "groove:" + hits.map(function (hit) { return hit.voice; }).join("+"), 1 - ctx.energy);
}
