import { updateInstrumentMix } from "../audio/buses.js";
import {
  DEFAULT_MIDI_CONTROL_MAP,
  PAD_BPM_PRESETS,
  SCENE_MIDI_RECALL_MAP,
  SCENE_MIDI_SAVE_MAP,
  VIRTUAL_MIDI_TARGETS
} from "../config/midi-defaults.js";
import { clamp } from "../core/math.js";
import { getInstrumentById, state } from "../core/state.js";
import { applyFxSpaceMacro } from "../effects/fx-chain.js";
import { queueSceneRecall, saveSceneSlot, setSelectedSceneSlot } from "../scenes/scenes.js";
import { dom } from "../ui/dom.js";
import { renderEquationLiveInspector, renderEquationMonitor } from "../ui/equation-panel.js";
import { renderInstrumentRack } from "../ui/instrument-rack.js";
import { appendLog } from "../ui/log.js";
import { renderMidiMappingStatus, syncMidiDeviceSelects } from "../ui/midi-panel.js";
import { refreshEngineStatus } from "../ui/status.js";
import { claimCc, claimNote, getBindingMode } from "./bindings.js";
import { handleMidiClockStart, handleMidiClockStop, handleMidiClockTick, resetMidiClock } from "./clock.js";
import { setMidiLearnArmed } from "./learn.js";
import { clickControl, setCheckboxState, setParamFromMidi } from "./params.js";
import { refreshPadLeds, sendPadLed } from "./output.js";
import { persistMidiMaps } from "./storage.js";

function setBpmValue(bpm) {
  const control = document.getElementById("bpm");
  if (!control) {
    return false;
  }
  const min = Number(control.min || 40);
  const max = Number(control.max || 220);
  const value = clamp(Math.round(bpm), min, max);
  control.value = String(value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  return value;
}

function handleBpmPadTap() {
  const now = performance.now();
  if (!state.midi.tapTimes) {
    state.midi.tapTimes = [];
  }
  const taps = state.midi.tapTimes;
  if (taps.length && now - taps[taps.length - 1] > 2000) {
    taps.length = 0;
  }
  taps.push(now);
  while (taps.length > 5) {
    taps.shift();
  }
  if (taps.length < 2) {
    return "BPM TAP (mais um toque...)";
  }

  let total = 0;
  for (let i = 1; i < taps.length; i += 1) {
    total += taps[i] - taps[i - 1];
  }
  const avgMs = total / (taps.length - 1);
  const bpm = setBpmValue(60000 / avgMs);
  return bpm ? "BPM TAP -> " + bpm : "BPM TAP falhou";
}

function setTransportPower(wantOn) {
  const shouldToggle = Boolean(wantOn) !== Boolean(state.powered);
  if (!shouldToggle) {
    return "TRANSPORT already " + (wantOn ? "ON" : "OFF");
  }
  if (!clickControl("powerBtn")) {
    return false;
  }
  return "TRANSPORT -> " + (wantOn ? "START/PLAY" : "STOP");
}

function applyMidiAction(controlId, midiValue, source, kind, code, isNoteOff) {
  if (controlId === "fxSpace" || VIRTUAL_MIDI_TARGETS[controlId]) {
    if (isNoteOff) {
      return null;
    }
    applyFxSpaceMacro(clamp(midiValue / 127, 0, 1));
    const space = document.getElementById("fxSpace");
    if (space) {
      space.value = String(clamp(midiValue / 127, 0, 1).toFixed(2));
    }
    return "SPACE macro " + Math.round((midiValue / 127) * 100) + "%";
  }

  const control = document.getElementById(controlId);
  if (!control) {
    return false;
  }

  const mode = getBindingMode(kind || source, code != null ? code : controlId, controlId, source);

  if (control.tagName === "BUTTON") {
    if (isNoteOff) {
      return null;
    }
    if (source === "cc" && midiValue < 64) {
      return null;
    }
    return clickControl(controlId) ? "CLICK " + controlId : false;
  }

  if (controlId === "bpm" && mode === "tap") {
    if (isNoteOff) {
      return null;
    }
    return handleBpmPadTap();
  }

  if (control.type === "checkbox") {
    if (mode === "momentary") {
      if (source === "note" || source === "key") {
        setCheckboxState(controlId, !isNoteOff);
        return "MOMENTARY " + controlId + " -> " + (control.checked ? "ON" : "OFF");
      }
      setCheckboxState(controlId, midiValue >= 64);
      return "MOMENTARY " + controlId + " -> " + (control.checked ? "ON" : "OFF");
    }

    if (isNoteOff) {
      return null;
    }
    const applied = setParamFromMidi(controlId, midiValue, { mode: mode === "toggle" ? "toggle" : "absolute", source: source });
    if (applied === null) {
      return null;
    }
    return applied ? "TOGGLE " + controlId + " -> " + (control.checked ? "ON" : "OFF") : false;
  }

  if (isNoteOff) {
    return null;
  }

  const applied = setParamFromMidi(controlId, midiValue, { mode: mode, source: source });
  if (applied === null) {
    return null;
  }
  return applied ? "SET " + controlId + " (" + mode + " " + midiValue + ")" : false;
}

function handleMidiCC(cc, value) {
  const ccKey = String(cc);

  if (state.midi.learnArmed && state.midi.pendingTargetId) {
    if (!state.midi.learnLastCcValue) {
      state.midi.learnLastCcValue = {};
    }
    const prev = state.midi.learnLastCcValue[ccKey];
    state.midi.learnLastCcValue[ccKey] = value;
    // Learn on first movement (delta) or press (>=64), not only midpoint cross.
    if (prev == null && value < 1) {
      return null;
    }
    if (prev != null && Math.abs(value - prev) < 1 && value < 64) {
      return null;
    }

    const learnedTarget = state.midi.pendingTargetId;
    const conflicts = claimCc(cc, learnedTarget);
    setMidiLearnArmed(false);
    const applied = applyMidiAction(learnedTarget, value, "cc", "cc", ccKey, false);
    let msg = "LEARN CC" + cc + " -> " + learnedTarget;
    if (conflicts.length) {
      msg += " | override: " + conflicts.join(", ");
    }
    if (applied) {
      msg += " | " + applied;
    }
    return msg;
  }

  if (Object.prototype.hasOwnProperty.call(state.midi.ccMap, ccKey)) {
    const customTarget = state.midi.ccMap[ccKey];
    if (!VIRTUAL_MIDI_TARGETS[customTarget] && !document.getElementById(customTarget)) {
      return "CC" + cc + " -> missing target " + customTarget;
    }
    const applied = applyMidiAction(customTarget, value, "cc", "cc", ccKey, false);
    if (applied === null) {
      return null;
    }
    if (applied) {
      return "CC" + cc + " => " + applied;
    }
    return "CC" + cc + " -> failed " + customTarget;
  }

  if (state.midi.defaultMapEnabled && DEFAULT_MIDI_CONTROL_MAP[cc]) {
    const defaultTarget = DEFAULT_MIDI_CONTROL_MAP[cc];
    if (defaultTarget === "fxSpace" || VIRTUAL_MIDI_TARGETS[defaultTarget]) {
      applyFxSpaceMacro(value / 127);
      return "CC" + cc + " -> fxSpace (default)";
    }
    const applied = setParamFromMidi(defaultTarget, value, { mode: "absolute", source: "cc" });
    if (applied) {
      return "CC" + cc + " -> " + defaultTarget + " (default)";
    }
  }

  return "CC" + cc + " -> no map";
}

function toggleInstrumentEnabled(instId, noteNumber) {
  const inst = getInstrumentById(instId);
  if (!inst) {
    return "instrument not found";
  }
  inst.enabled = !inst.enabled;
  updateInstrumentMix(inst);

  const enabledControl = document.getElementById("inst-" + instId + "-enabled");
  if (enabledControl) {
    enabledControl.checked = inst.enabled;
    enabledControl.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    renderInstrumentRack();
  }

  if (noteNumber != null) {
    sendPadLed(noteNumber, inst.enabled);
  }

  renderEquationMonitor();
  renderEquationLiveInspector();
  return inst.name + " -> " + (inst.enabled ? "ON" : "OFF");
}

function handleMidiPadLearn(noteNumber) {
  if (!state.midi.padLearnInstrumentId) {
    return null;
  }

  const mappedInst = state.midi.padLearnInstrumentId;
  const conflicts = claimNote(noteNumber, "pad", mappedInst);
  state.midi.padLearnInstrumentId = null;
  renderInstrumentRack();
  renderMidiMappingStatus();
  refreshPadLeds();
  let msg = "PAD LEARN note " + noteNumber + " -> toggle " + mappedInst;
  if (conflicts.length) {
    msg += " | override: " + conflicts.join(", ");
  }
  return msg;
}

function handleMidiNote(noteNumber, velocity, isNoteOn) {
  const isNoteOff = !isNoteOn || velocity <= 0;

  if (!isNoteOff && state.midi.learnArmed && state.midi.pendingTargetId) {
    const learnedTarget = state.midi.pendingTargetId;
    const conflicts = claimNote(noteNumber, "note", learnedTarget);
    setMidiLearnArmed(false);
    const applied = applyMidiAction(learnedTarget, velocity || 100, "key", "note", String(noteNumber), false);
    let msg = "LEARN KEY/NOTE " + noteNumber + " -> " + learnedTarget;
    if (conflicts.length) {
      msg += " | override: " + conflicts.join(", ");
    }
    if (applied) {
      msg += " | " + applied;
    }
    return msg;
  }

  if (!isNoteOff) {
    const learnResult = handleMidiPadLearn(noteNumber);
    if (learnResult) {
      return learnResult;
    }
  }

  if (state.midi.noteMap[String(noteNumber)]) {
    const mappedControl = state.midi.noteMap[String(noteNumber)];
    if (!VIRTUAL_MIDI_TARGETS[mappedControl] && !document.getElementById(mappedControl)) {
      return "NOTE " + noteNumber + " -> missing target " + mappedControl;
    }
    const applied = applyMidiAction(
      mappedControl,
      isNoteOff ? 0 : velocity,
      "key",
      "note",
      String(noteNumber),
      isNoteOff
    );
    if (applied === null) {
      return null;
    }
    if (applied) {
      return "KEY/NOTE " + noteNumber + " => " + applied;
    }
  }

  if (!isNoteOff) {
    const mappedInst = state.midi.padMap[String(noteNumber)];
    if (mappedInst) {
      return "PAD " + noteNumber + " => " + toggleInstrumentEnabled(mappedInst, noteNumber);
    }

    if (state.midi.factoryPresetsEnabled) {
      if (PAD_BPM_PRESETS[noteNumber]) {
        const bpm = setBpmValue(PAD_BPM_PRESETS[noteNumber]);
        return bpm ? "KEY BPM " + noteNumber + " => " + bpm : "KEY BPM falhou";
      }

      if (SCENE_MIDI_SAVE_MAP[noteNumber]) {
        const saveSlot = SCENE_MIDI_SAVE_MAP[noteNumber];
        setSelectedSceneSlot(saveSlot, false);
        saveSceneSlot(saveSlot, "midi");
        return "SCENE SAVE " + saveSlot + " (note " + noteNumber + ")";
      }

      if (SCENE_MIDI_RECALL_MAP[noteNumber]) {
        const recallSlot = SCENE_MIDI_RECALL_MAP[noteNumber];
        setSelectedSceneSlot(recallSlot, false);
        queueSceneRecall(recallSlot, "midi");
        return "SCENE RECALL " + recallSlot + " (note " + noteNumber + ")";
      }
    }
  }

  return isNoteOff ? null : "NOTE " + noteNumber + " (no map)";
}

function handlePitchBend(lsb, msb) {
  const value14 = ((msb & 0x7f) << 7) | (lsb & 0x7f);
  const as7 = Math.round(value14 / 129);

  if (state.midi.learnArmed && state.midi.pendingTargetId) {
    state.midi.pitchBendTarget = state.midi.pendingTargetId;
    setMidiLearnArmed(false);
    persistMidiMaps();
    applyMidiAction(state.midi.pitchBendTarget, as7, "cc", "pb", "pb", false);
    return "LEARN PITCH BEND -> " + state.midi.pitchBendTarget;
  }

  if (!state.midi.pitchBendTarget) {
    return null;
  }
  const applied = applyMidiAction(state.midi.pitchBendTarget, as7, "cc", "pb", "pb", false);
  return applied ? "PB => " + applied : null;
}

function handleAftertouch(value) {
  if (state.midi.learnArmed && state.midi.pendingTargetId) {
    state.midi.aftertouchTarget = state.midi.pendingTargetId;
    setMidiLearnArmed(false);
    persistMidiMaps();
    applyMidiAction(state.midi.aftertouchTarget, value, "cc", "at", "at", false);
    return "LEARN AFTERTOUCH -> " + state.midi.aftertouchTarget;
  }

  if (!state.midi.aftertouchTarget) {
    return null;
  }
  const applied = applyMidiAction(state.midi.aftertouchTarget, value, "cc", "at", "at", false);
  return applied ? "AT => " + applied : null;
}

function handleProgramChange(program) {
  if (!state.midi.factoryPresetsEnabled) {
    return null;
  }
  const slots = ["A", "B", "C"];
  if (program >= 0 && program <= 2) {
    const slot = slots[program];
    setSelectedSceneSlot(slot, false);
    queueSceneRecall(slot, "midi");
    return "PROGRAM " + program + " => SCENE RECALL " + slot;
  }
  return null;
}

function handleTransportRealtime(status) {
  if (status === 0xf8) {
    return handleMidiClockTick();
  }
  if (status === 0xfa) {
    handleMidiClockStart();
    return setTransportPower(true);
  }
  if (status === 0xfb) {
    return setTransportPower(true);
  }
  if (status === 0xfc) {
    handleMidiClockStop();
    return setTransportPower(false);
  }
  return null;
}

function acceptsInput(input) {
  if (!state.midi.selectedInputId || state.midi.selectedInputId === "all") {
    return true;
  }
  return input && input.id === state.midi.selectedInputId;
}

function acceptsChannel(status) {
  if (status >= 0xf0) {
    return true;
  }
  const filter = Number(state.midi.channelFilter);
  if (!Number.isFinite(filter) || filter < 0) {
    return true;
  }
  return (status & 0x0f) === filter;
}

function publishMidiResult(result, extra) {
  if (!result) {
    return;
  }
  state.midi.lastMessage = result;
  appendLog("midi " + result + (extra != null ? " (" + extra + ")" : ""));
  renderMidiMappingStatus();
  refreshEngineStatus();
}

function bindMidiInput(input) {
  input.onmidimessage = function (event) {
    if (!acceptsInput(input)) {
      return;
    }

    const data = event.data || [];
    const status = data[0] || 0;

    if (!acceptsChannel(status)) {
      return;
    }

    const type = status & 0xf0;
    const data1 = data[1] || 0;
    const value = data[2] || 0;

    if (status === 0xf8 || status === 0xfa || status === 0xfb || status === 0xfc) {
      publishMidiResult(handleTransportRealtime(status));
      return;
    }

    if (type === 0xb0) {
      publishMidiResult(handleMidiCC(data1, value), value);
      return;
    }

    if (type === 0x90 || type === 0x80) {
      const velocity = type === 0x80 ? 0 : value;
      publishMidiResult(handleMidiNote(data1, velocity, type === 0x90 && velocity > 0));
      return;
    }

    if (type === 0xe0) {
      publishMidiResult(handlePitchBend(data1, value));
      return;
    }

    if (type === 0xd0) {
      publishMidiResult(handleAftertouch(data1));
      return;
    }

    if (type === 0xa0) {
      publishMidiResult(handleAftertouch(value));
      return;
    }

    if (type === 0xc0) {
      publishMidiResult(handleProgramChange(data1));
    }
  };
}

function rebindAllInputs() {
  if (!state.midi.access) {
    return;
  }
  state.midi.access.inputs.forEach(bindMidiInput);
}

export function refreshMidiConnectionUi() {
  if (!dom.midiBtn) {
    return;
  }
  if (state.midi.connected) {
    const count = state.midi.access ? state.midi.access.inputs.size : 0;
    dom.midiBtn.textContent = "MIDI: On (" + count + ")";
    dom.midiBtn.classList.add("on");
    dom.midiBtn.setAttribute("aria-pressed", "true");
  } else {
    dom.midiBtn.textContent = "MIDI: Disconnected";
    dom.midiBtn.classList.remove("on");
    dom.midiBtn.setAttribute("aria-pressed", "false");
  }
}

export function disconnectMidi() {
  if (state.midi.access) {
    state.midi.access.inputs.forEach(function (input) {
      input.onmidimessage = null;
    });
    state.midi.access.onstatechange = null;
  }
  state.midi.connected = false;
  state.midi.access = null;
  resetMidiClock();
  refreshMidiConnectionUi();
  syncMidiDeviceSelects();
  renderMidiMappingStatus();
  refreshEngineStatus();
  appendLog("midi disconnected");
}

export async function initMidi() {
  if (!navigator.requestMIDIAccess) {
    appendLog("Web MIDI not available in this browser");
    return;
  }

  if (state.midi.connected && state.midi.access) {
    disconnectMidi();
    return;
  }

  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    state.midi.access = access;

    rebindAllInputs();
    access.onstatechange = function () {
      rebindAllInputs();
      syncMidiDeviceSelects();
      refreshMidiConnectionUi();
      refreshPadLeds();
    };

    state.midi.connected = true;
    refreshMidiConnectionUi();
    syncMidiDeviceSelects();
    refreshPadLeds();
    appendLog("midi linked (keys/pads/play/stop/clock/CC/PB/AT)");
    renderMidiMappingStatus();
    refreshEngineStatus();
  } catch (error) {
    appendLog("midi error: " + error.message);
  }
}
