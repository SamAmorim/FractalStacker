import { updateInstrumentMix } from "../audio/buses.js";
import {
  DEFAULT_MIDI_CONTROL_MAP,
  SCENE_MIDI_RECALL_MAP,
  SCENE_MIDI_SAVE_MAP
} from "../config/midi-defaults.js";
import { clamp } from "../core/math.js";
import { getInstrumentById, state } from "../core/state.js";
import { setMidiLearnArmed } from "./learn.js";
import { queueSceneRecall, saveSceneSlot, setSelectedSceneSlot } from "../scenes/scenes.js";
import { dom } from "../ui/dom.js";
import { renderEquationLiveInspector, renderEquationMonitor } from "../ui/equation-panel.js";
import { renderInstrumentRack } from "../ui/instrument-rack.js";
import { appendLog } from "../ui/log.js";
import { renderMidiMappingStatus } from "../ui/midi-panel.js";
import { refreshEngineStatus } from "../ui/status.js";

function applyMidiToControl(controlId, midiValue) {
  const control = document.getElementById(controlId);
  if (!control) {
    return false;
  }

  const normalized = clamp(midiValue / 127, 0, 1);
  const tag = control.tagName;

  if (tag === "SELECT") {
    const optionCount = Math.max(1, control.options.length);
    const index = Math.round(normalized * Math.max(0, optionCount - 1));
    control.selectedIndex = index;
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (control.type === "checkbox") {
    control.checked = normalized >= 0.5;
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const min = Number(control.min || 0);
  const max = Number(control.max || 1);
  let value = min + (max - min) * normalized;
  const step = Number(control.step || 0);

  if (Number.isFinite(step) && step > 0) {
    value = Math.round((value - min) / step) * step + min;
    const decimals = step < 1 ? Math.min(6, (String(step).split(".")[1] || "").length) : 0;
    value = Number(value.toFixed(decimals));
  }

  value = clamp(value, min, max);
  control.value = String(value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function handleMidiCC(cc, value) {
  const ccKey = String(cc);

  if (state.midi.learnArmed && state.midi.pendingTargetId) {
    state.midi.ccMap[ccKey] = state.midi.pendingTargetId;
    applyMidiToControl(state.midi.pendingTargetId, value);
    const learnedTarget = state.midi.pendingTargetId;
    setMidiLearnArmed(false);
    renderMidiMappingStatus();
    return "LEARN CC" + cc + " -> " + learnedTarget;
  }

  if (state.midi.ccMap[ccKey]) {
    const customTarget = state.midi.ccMap[ccKey];
    if (applyMidiToControl(customTarget, value)) {
      return "CC" + cc + " -> " + customTarget + " (custom)";
    }
  }

  if (state.midi.defaultMapEnabled && DEFAULT_MIDI_CONTROL_MAP[cc]) {
    const defaultTarget = DEFAULT_MIDI_CONTROL_MAP[cc];
    if (applyMidiToControl(defaultTarget, value)) {
      return "CC" + cc + " -> " + defaultTarget + " (default)";
    }
  }

  return "CC" + cc + " -> no map";
}

function toggleInstrumentEnabled(instId) {
  const inst = getInstrumentById(instId);
  if (!inst) {
    return "instrument not found";
  }
  inst.enabled = !inst.enabled;
  updateInstrumentMix(inst);
  renderInstrumentRack();
  renderEquationMonitor();
  renderEquationLiveInspector();
  return inst.name + " -> " + (inst.enabled ? "ON" : "OFF");
}

function handleMidiPadLearn(noteNumber) {
  if (!state.midi.padLearnInstrumentId) {
    return null;
  }

  state.midi.padMap[String(noteNumber)] = state.midi.padLearnInstrumentId;
  const mappedInst = state.midi.padLearnInstrumentId;
  state.midi.padLearnInstrumentId = null;
  renderInstrumentRack();
  renderMidiMappingStatus();
  return "PAD LEARN note " + noteNumber + " -> " + mappedInst;
}

function handleMidiNote(noteNumber, velocity) {
  if (velocity <= 0) {
    return null;
  }

  const learnResult = handleMidiPadLearn(noteNumber);
  if (learnResult) {
    return learnResult;
  }

  const mappedInst = state.midi.padMap[String(noteNumber)];
  if (mappedInst) {
    return "PAD " + noteNumber + " => " + toggleInstrumentEnabled(mappedInst);
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

  return "NOTE " + noteNumber + " (no pad map)";
}

function mapMidiCC(cc, value) {
  return handleMidiCC(cc, value);
}

export async function initMidi() {
  if (!navigator.requestMIDIAccess) {
    appendLog("Web MIDI not available in this browser");
    return;
  }

  if (state.midi.connected && state.midi.access) {
    appendLog("MIDI already connected");
    return;
  }

  try {
    const access = await navigator.requestMIDIAccess();
    state.midi.access = access;

    access.inputs.forEach(function (input) {
      input.onmidimessage = function (event) {
        const data = event.data || [];
        const status = data[0] || 0;
        const type = status & 0xf0;
        const cc = data[1] || 0;
        const value = data[2] || 0;

        if (type === 0xb0) {
          const mapResult = mapMidiCC(cc, value);
          state.midi.lastMessage = mapResult;
          appendLog("midi " + mapResult + " (" + value + ")");
          renderMidiMappingStatus();
        }

        if (type === 0x90) {
          const noteResult = handleMidiNote(cc, value);
          if (noteResult) {
            state.midi.lastMessage = noteResult;
            appendLog("midi " + noteResult);
            renderMidiMappingStatus();
          }
        }
      };
    });

    state.midi.connected = true;
    dom.midiBtn.textContent = "MIDI: Connected";
    dom.midiBtn.classList.add("on");
    dom.midiBtn.setAttribute("aria-pressed", "true");
    appendLog("midi linked (CC map active)");
    renderMidiMappingStatus();
    refreshEngineStatus();
  } catch (error) {
    appendLog("midi error: " + error.message);
  }
}
