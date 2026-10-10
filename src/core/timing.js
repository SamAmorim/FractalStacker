import { state } from "./state.js";

export function stepDurationSeconds() {
  return 60 / state.bpm / 4;
}
