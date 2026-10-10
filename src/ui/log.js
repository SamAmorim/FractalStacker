import { state } from "../core/state.js";
import { dom } from "./dom.js";

export function appendLog(text) {
  const stamp = new Date().toLocaleTimeString();
  state.logLines.unshift(stamp + " | " + text);
  if (state.logLines.length > 14) {
    state.logLines.pop();
  }
  dom.eventLog.textContent = state.logLines.join("\n");
}
