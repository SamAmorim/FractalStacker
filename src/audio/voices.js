import { audio } from "./engine.js";
import { MAX_VOICES } from "../config/constants.js";
import { state } from "../core/state.js";

// Share of the voice budget each role may consume, so ornamental layers yield first.
const ROLE_HEADROOM = {
  drums: 1.25,
  bass: 1.2,
  pad: 1,
  lead: 1,
  arp: 0.85,
  texture: 0.75
};

const liveSources = new Set();

export function canSpawnVoice(role) {
  const headroom = ROLE_HEADROOM[role] || 1;
  return audio.activeVoices < MAX_VOICES[state.performanceMode] * headroom;
}

export function registerVoice(sourceNode) {
  audio.activeVoices += 1;
  liveSources.add(sourceNode);

  const previous = sourceNode.onended;
  sourceNode.onended = function (event) {
    liveSources.delete(sourceNode);
    audio.activeVoices = Math.max(0, audio.activeVoices - 1);
    if (typeof previous === "function") {
      previous.call(sourceNode, event);
    }
  };
}

export function killAllVoices() {
  const now = audio.ctx ? audio.ctx.currentTime : 0;
  liveSources.forEach(function (sourceNode) {
    try {
      sourceNode.stop(now);
    } catch (error) {
      try {
        sourceNode.stop();
      } catch (innerError) {
        // already stopped or not started
      }
    }
    try {
      sourceNode.disconnect();
    } catch (error) {
      // already disconnected
    }
  });
  liveSources.clear();
  audio.activeVoices = 0;
}
