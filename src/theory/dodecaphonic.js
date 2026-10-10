import { state } from "../core/state.js";
import { normalizeSemitone } from "./notes.js";

function createDodecaphonicRow(baseSeed) {
  const row = [];
  for (let i = 0; i < 12; i += 1) {
    row.push(i);
  }

  let localSeed = (Math.abs(Math.floor(baseSeed)) % 2147483647) || 1;
  for (let i = row.length - 1; i > 0; i -= 1) {
    localSeed = (localSeed * 48271) % 2147483647;
    const j = Math.floor((localSeed / 2147483647) * (i + 1));
    const temp = row[i];
    row[i] = row[j];
    row[j] = temp;
  }

  return row;
}

export function resetDodecaphonicSequence() {
  const baseSeed = state.seed + Math.floor(state.rootHz * 10) + Math.floor(state.chaos * 1000) + state.fractalDepth * 97;
  state.dodecaphonic.row = createDodecaphonicRow(baseSeed);
  state.dodecaphonic.positions = {};
}

export function getDodecaphonicInterval(instId) {
  if (!state.dodecaphonic.row.length) {
    resetDodecaphonicSequence();
  }

  const current = state.dodecaphonic.positions[instId] || 0;
  const interval = state.dodecaphonic.row[current % state.dodecaphonic.row.length];
  state.dodecaphonic.positions[instId] = (current + 1) % state.dodecaphonic.row.length;
  return interval;
}

export function isValidToneRow(row) {
  if (!Array.isArray(row) || row.length !== 12) {
    return false;
  }
  const seen = {};
  for (let i = 0; i < row.length; i += 1) {
    const value = normalizeSemitone(Number(row[i]));
    if (seen[value]) {
      return false;
    }
    seen[value] = true;
  }
  return true;
}

export function normalizeToneRow(row) {
  return row.map(function (value) {
    return normalizeSemitone(Number(value));
  });
}
