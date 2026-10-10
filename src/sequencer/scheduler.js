import { evaluateEquation } from "../algorithms/equation-runtime.js";
import { duckBuses } from "../audio/buses.js";
import { audio } from "../audio/engine.js";
import { getPhraseBars, getStyle, metricWeight, updateForm } from "../composition/form.js";
import { resetComposition, updateHarmony } from "../composition/harmony.js";
import { clamp, createRng } from "../core/math.js";
import { state } from "../core/state.js";
import { stepDurationSeconds } from "../core/timing.js";
import { processPendingSceneRecall } from "../scenes/scenes.js";
import { playRole } from "./players/index.js";
import { playEvent } from "../synths/index.js";
import { renderEquationLiveInspector, renderEquationMonitor } from "../ui/equation-panel.js";
import { appendLog } from "../ui/log.js";
import { advancePlotInstrument } from "../ui/plot-target.js";
import { refreshEngineStatus } from "../ui/status.js";

function pushHistory(instId, point) {
  const history = state.history[instId];
  history.push(point);
  if (history.length > 96) {
    history.shift();
  }
}

function buildStepContext(step) {
  const style = getStyle();
  const compose = state.compose;
  const stepInBar = step % 16;
  const bar = Math.floor(step / 16);
  const phraseBars = getPhraseBars();
  let sectionChanged = false;
  let chordChanged = false;

  if (compose.formBar !== bar) {
    const previousSection = compose.section;
    const previousChord = compose.chord;
    updateForm(bar);
    sectionChanged = compose.phraseBar === 0 && previousSection !== compose.section;
    if (style.legacy) {
      compose.chord = null;
      compose.nextChord = null;
    } else {
      updateHarmony(compose.phraseIndex, compose.phraseBar, phraseBars);
    }
    chordChanged = compose.chord !== previousChord || bar === 0;
    compose.formBar = bar;

    if (sectionChanged) {
      appendLog("[FORMA] " + compose.section + " | energia " + Math.round(compose.energy * 100) + "%");
    }
    if (chordChanged && compose.chord) {
      appendLog("[HARMONIA] " + compose.chord.name + " -> " + (compose.nextChord ? compose.nextChord.name : "--"));
    }
  }

  const barsPerChord = clamp(Math.round(state.music.harmonicRhythm), 1, phraseBars);
  const barsLeft = Math.min(barsPerChord - (compose.phraseBar % barsPerChord), phraseBars - compose.phraseBar);

  return {
    step: step,
    stepInBar: stepInBar,
    bar: bar,
    metric: metricWeight(stepInBar),
    stepSec: stepDurationSeconds(),
    phraseIndex: compose.phraseIndex,
    phraseBar: compose.phraseBar,
    phraseBars: phraseBars,
    isPhraseEnd: compose.phraseBar === phraseBars - 1,
    energy: compose.energy,
    section: compose.section,
    sectionChanged: sectionChanged,
    chord: compose.chord,
    nextChord: compose.nextChord,
    chordChanged: chordChanged,
    lastBarOfChord: Boolean(compose.lastBarOfChord),
    chordSteps: barsLeft * 16 - stepInBar,
    legacy: Boolean(style.legacy),
    groove: style.groove,
    rng: createRng(state.music.seed * 97 + step * 7919)
  };
}

function dispatchEvents(inst, events, when, ctx) {
  const humanize = clamp(state.music.humanize, 0, 1);
  const frequencies = [];
  events.forEach(function (event) {
    const tight = event.voice === "kick" && ctx.stepInBar % 4 === 0;
    const offset = humanize > 0 && !tight ? (ctx.rng() - 0.5) * humanize * 0.024 : 0;
    event.velocity = clamp(event.velocity * (1 + (ctx.rng() - 0.5) * humanize * 0.2), 0.05, 1);
    const at = Math.max(audio.ctx.currentTime, when + offset);
    const played = playEvent(inst, at, event);
    if (played && event.voice === "kick") {
      duckBuses(at, state.music.sidechain * event.velocity, ctx.stepSec * 3.2, inst.id);
    }
    if (played) {
      (event.frequencies || (event.frequency ? [event.frequency] : [])).forEach(function (frequency) {
        frequencies.push(frequency);
      });
    }
  });
  return frequencies;
}

function scheduleStep(step, when) {
  const summaries = [];
  const barLength = 16;
  const beatLength = 4;
  const barIndex = Math.floor(step / barLength) + 1;
  const isBarStart = step % barLength === 0;
  const isBeatStart = step % beatLength === 0;
  const isBarEnd = step % barLength === barLength - 1;

  processPendingSceneRecall(step, isBeatStart, isBarStart);

  if (step > 0 && state.plotAutoCycle && !state.plotFrozen) {
    const cycleUsesBeats = state.plotCycleUnit === "beat";
    const pulseLength = cycleUsesBeats ? beatLength : barLength;
    const isPulseStart = cycleUsesBeats ? isBeatStart : isBarStart;
    if (isPulseStart) {
      const pulseIndex = Math.floor(step / pulseLength);
      if (pulseIndex !== state.lastPlotCyclePulse && pulseIndex % state.plotCycleBars === 0) {
        advancePlotInstrument();
        state.lastPlotCyclePulse = pulseIndex;
      }
    }
  }

  if (isBarStart) {
    appendLog("[BAR START] compasso " + barIndex + " | step " + step);
  }

  if (isBeatStart && !isBarStart && state.plotAutoCycle && state.plotCycleUnit === "beat") {
    const beatInBar = Math.floor((step % barLength) / beatLength) + 1;
    appendLog("[BEAT] compasso " + barIndex + " | beat " + beatInBar + " | step " + step);
  }

  const ctx = buildStepContext(step);

  state.instruments.forEach(function (inst) {
    const equationRuntime = evaluateEquation(inst, step);
    const decision = playRole(inst, equationRuntime, ctx);
    const trigger = decision.trigger;
    const played = trigger ? dispatchEvents(inst, decision.events, when, ctx) : [];
    const frequency = played.length ? played[0] : null;

    pushHistory(inst.id, {
      step: step,
      trigger: trigger,
      value: equationRuntime.combined,
      raw: equationRuntime.raw,
      fractal: equationRuntime.fractal,
      threshold: decision.threshold,
      reason: decision.reason,
      frequency: frequency
    });

    state.equationDebug[inst.id] = {
      step: step,
      raw: equationRuntime.raw,
      fractal: equationRuntime.fractal,
      random: equationRuntime.random,
      combined: equationRuntime.combined,
      threshold: decision.threshold,
      deterministicPulse: false,
      trigger: trigger,
      triggerReason: decision.reason,
      frequency: frequency,
      detailText: equationRuntime.detailText
    };

    if (trigger) {
      played.forEach(function (hz) {
        if (Number.isFinite(hz)) {
          state.monitor.recentFrequencies.push({ frequency: hz, instId: inst.id, step: step });
        }
      });
      while (state.monitor.recentFrequencies.length > 120) {
        state.monitor.recentFrequencies.shift();
      }
      const descriptor = played.length > 1
        ? decision.reason
        : frequency ? frequency.toFixed(1) + "Hz" : decision.reason.replace(/^groove:/, "");
      summaries.push(inst.name + ":" + descriptor);
    }
  });

  state.lastNoteSummary = summaries.length ? summaries.join(" | ") : "--";
  state.lastMixSummary = state.instruments
    .map(function (inst) {
      return inst.name + ":" + inst.volume.toFixed(2);
    })
    .join("  ");

  if (!state.graphsOnly) {
    renderEquationLiveInspector();
    if (step % 2 === 0) {
      renderEquationMonitor();
    }
    if (step % 4 === 0) {
      refreshEngineStatus();
    }
  }

  if (summaries.length && step % 2 === 0) {
    appendLog("step " + step + " -> " + summaries.join(" | "));
  }

  if (isBarEnd) {
    appendLog("[BAR END] compasso " + barIndex + " | notas " + state.lastNoteSummary);
  }
}

function schedulerTick() {
  if (!state.powered || !audio.ready) {
    return;
  }

  const currentTime = audio.ctx.currentTime;
  while (state.scheduler.nextNoteTime < currentTime + state.scheduler.scheduleAheadSec) {
    const step = state.scheduler.currentStep;
    scheduleStep(step, state.scheduler.nextNoteTime);

    const base = stepDurationSeconds();
    const swingMultiplier = step % 2 === 0 ? 1 - state.swing : 1 + state.swing;
    state.scheduler.nextNoteTime += base * swingMultiplier;
    state.scheduler.currentStep += 1;
  }
}

export function startScheduler() {
  stopScheduler();
  resetComposition();
  state.scheduler.currentStep = 0;
  state.scheduler.nextNoteTime = audio.ctx.currentTime + 0.05;
  state.scheduler.timerId = window.setInterval(schedulerTick, state.scheduler.lookAheadMs);
}

export function stopScheduler() {
  if (state.scheduler.timerId !== null) {
    clearInterval(state.scheduler.timerId);
    state.scheduler.timerId = null;
  }
}
