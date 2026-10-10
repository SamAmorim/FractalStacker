import { euclidHit } from "../algorithms/euclid.js";
import { clamp } from "../core/math.js";

function layerEnergy(spec, energy) {
  return spec && energy >= spec.minEnergy;
}

export function getDrumHits(groove, ctx, inst, eqValue, rng) {
  const hits = [];
  const s = ctx.stepInBar;
  const energy = clamp(ctx.energy * (0.45 + inst.density * 0.8), 0, 1);
  const fillZone = ctx.isPhraseEnd && s >= 12 && energy > 0.3;

  if (ctx.phraseBar === 0 && s === 0 && ctx.sectionChanged && energy > 0.55) {
    hits.push({ voice: "crash", velocity: 0.7 });
  }

  if (fillZone && groove.fill === "roll") {
    hits.push({ voice: "snare", velocity: 0.35 + ((s - 12) / 3) * 0.5 });
    if (s === 12) {
      hits.push({ voice: "kick", velocity: 0.85 });
    }
    if (s % 2 === 1) {
      hits.push({ voice: "tom", velocity: 0.5 + eqValue * 0.3, pitch: 1 - (s - 12) * 0.15 });
    }
    return hits;
  }

  const kick = groove.kick;
  if (layerEnergy(kick, energy) && euclidHit(kick.pulses, 16, kick.rotation, s)) {
    hits.push({ voice: "kick", velocity: kick.velocity * (s === 0 ? 1 : 0.92) });
  } else if (kick && energy > 0.5 && s % 4 === 3 && eqValue > 0.78 && rng() < groove.ghostChance * 2) {
    hits.push({ voice: "kick", velocity: kick.velocity * 0.55 });
  }

  const snare = groove.snare;
  if (layerEnergy(snare, energy) && snare.steps.indexOf(s) !== -1) {
    hits.push({ voice: "snare", velocity: snare.velocity });
  } else if (snare && snare.steps.length && energy > 0.45 && s % 2 === 1 && rng() < groove.ghostChance * eqValue) {
    hits.push({ voice: "snare", velocity: 0.18 + eqValue * 0.12 });
  }

  const rim = groove.rim;
  if (layerEnergy(rim, energy) && euclidHit(rim.pulses, 16, rim.rotation + ctx.phraseBar % 2, s)) {
    hits.push({ voice: "rim", velocity: rim.velocity * (0.8 + eqValue * 0.4) });
  }

  const openHat = groove.openHat;
  const openHit = layerEnergy(openHat, energy) && openHat.steps.indexOf(s) !== -1;
  if (openHit) {
    hits.push({ voice: "openHat", velocity: openHat.velocity });
  }

  const hat = groove.hat;
  if (!openHit && layerEnergy(hat, energy)) {
    const pulses = Math.min(16, hat.pulses + Math.round(Math.max(0, energy - 0.5) * 12));
    if (euclidHit(pulses, 16, hat.rotation, s)) {
      const accent = s % 4 === 2 ? 1 : s % 2 === 0 ? 0.78 : 0.6;
      hits.push({ voice: "hat", velocity: hat.velocity * accent * (0.85 + eqValue * 0.3) });
    } else if (rng() < groove.ghostChance * eqValue * energy) {
      hits.push({ voice: "hat", velocity: hat.velocity * 0.35 });
    }
  }

  return hits;
}

export function getLegacyDrumHit(eqValue) {
  if (eqValue > 0.78) return { voice: "kick", velocity: 0.6 + eqValue * 0.4 };
  if (eqValue > 0.55) return { voice: "snare", velocity: 0.5 + eqValue * 0.3 };
  return { voice: "hat", velocity: 0.4 + eqValue * 0.4 };
}
