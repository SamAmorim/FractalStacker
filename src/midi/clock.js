import { clamp } from "../core/math.js";
import { state } from "../core/state.js";

const MAX_INTERVALS = 48;

export function resetMidiClock() {
  state.midi.clock = {
    lastTickAt: 0,
    intervals: [],
    bpm: null
  };
}

export function handleMidiClockTick() {
  if (!state.midi.clockSyncEnabled) {
    return null;
  }

  if (!state.midi.clock) {
    resetMidiClock();
  }

  const now = performance.now();
  const clock = state.midi.clock;
  if (clock.lastTickAt > 0) {
    const interval = now - clock.lastTickAt;
    if (interval > 5 && interval < 500) {
      clock.intervals.push(interval);
      while (clock.intervals.length > MAX_INTERVALS) {
        clock.intervals.shift();
      }
    }
  }
  clock.lastTickAt = now;

  if (clock.intervals.length < 12) {
    return null;
  }

  const avg = clock.intervals.reduce(function (sum, value) {
    return sum + value;
  }, 0) / clock.intervals.length;

  // 24 PPQN MIDI clock ticks per quarter note.
  const bpm = clamp(Math.round(60000 / (avg * 24)), 40, 220);
  if (!Number.isFinite(bpm)) {
    return null;
  }

  if (clock.bpm === bpm) {
    return null;
  }
  clock.bpm = bpm;

  const control = document.getElementById("bpm");
  if (!control) {
    return "CLOCK BPM " + bpm + " (no control)";
  }
  control.value = String(bpm);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  return "CLOCK -> BPM " + bpm;
}

export function handleMidiClockStart() {
  resetMidiClock();
  return "CLOCK START";
}

export function handleMidiClockStop() {
  resetMidiClock();
  return "CLOCK STOP";
}
