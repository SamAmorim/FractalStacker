import { NOTE_NAMES } from "../config/constants.js";

export function normalizeSemitone(value) {
  return ((value % 12) + 12) % 12;
}

export function noteNameFromSemitone(value) {
  return NOTE_NAMES[normalizeSemitone(value)];
}
