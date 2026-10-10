import { clamp } from "../core/math.js";
import { state } from "../core/state.js";
import {
  persistScenes,
  queueSceneRecall,
  sanitizeSceneSlot,
  saveSceneSlot,
  setSelectedSceneSlot,
  shiftSceneSlot
} from "../scenes/scenes.js";
import { dom } from "./dom.js";
import { renderMidiMappingStatus } from "./midi-panel.js";

export function sceneStatusMessage(slot) {
  const safeSlot = sanitizeSceneSlot(slot);
  const snapshot = state.scenes.slots[safeSlot];
  if (!snapshot) {
    return "Cena " + safeSlot + " vazia. Use Save Slot para gravar o estado atual.";
  }

  const stamp = snapshot.updatedAt || snapshot.createdAt;
  const timeTag = stamp ? " | " + stamp : "";
  return "Cena " + safeSlot + " pronta (schema v" + (snapshot.version || 1) + ")" + timeTag;
}

export function setSceneStatus(message, isAlert) {
  if (!dom.sceneStatus) {
    return;
  }
  dom.sceneStatus.textContent = message;
  dom.sceneStatus.classList.toggle("alert", !!isAlert);
}

export function syncSceneUiFromState() {
  const selectedSlot = sanitizeSceneSlot(state.scenes.selectedSlot);
  state.scenes.selectedSlot = selectedSlot;

  if (dom.sceneSlotSelect) {
    dom.sceneSlotSelect.value = selectedSlot;
  }
  if (dom.sceneSlotVal) {
    dom.sceneSlotVal.textContent = selectedSlot;
  }

  const quantize = state.scenes.quantize;
  if (dom.sceneQuantizeSelect) {
    dom.sceneQuantizeSelect.value = (quantize === "beat" || quantize === "bar" || quantize === "immediate") ? quantize : "bar";
  }

  const transitionSec = clamp(Number(state.scenes.transitionSec) || 0, 0, 4);
  state.scenes.transitionSec = transitionSec;
  if (dom.sceneTransition) {
    dom.sceneTransition.value = transitionSec.toFixed(2);
  }
  if (dom.sceneTransitionVal) {
    dom.sceneTransitionVal.textContent = transitionSec.toFixed(2) + " s";
  }
}

export function bindSceneControls() {
  if (!dom.sceneSlotSelect || !dom.sceneQuantizeSelect || !dom.sceneTransition) {
    return;
  }

  dom.sceneSlotSelect.addEventListener("change", function (event) {
    setSelectedSceneSlot(event.target.value, true);
  });

  dom.sceneQuantizeSelect.addEventListener("change", function (event) {
    const mode = event.target.value;
    state.scenes.quantize = (mode === "immediate" || mode === "beat" || mode === "bar") ? mode : "bar";
    persistScenes();
    setSceneStatus("Quantize de cena: " + state.scenes.quantize + ".", false);
    renderMidiMappingStatus();
  });

  dom.sceneTransition.addEventListener("input", function (event) {
    state.scenes.transitionSec = clamp(Number(event.target.value) || 0, 0, 4);
    if (dom.sceneTransitionVal) {
      dom.sceneTransitionVal.textContent = state.scenes.transitionSec.toFixed(2) + " s";
    }
    persistScenes();
  });

  if (dom.sceneSaveBtn) {
    dom.sceneSaveBtn.addEventListener("click", function () {
      saveSceneSlot(state.scenes.selectedSlot, "button");
    });
  }

  if (dom.sceneRecallBtn) {
    dom.sceneRecallBtn.addEventListener("click", function () {
      queueSceneRecall(state.scenes.selectedSlot, "button");
    });
  }

  if (dom.scenePrevBtn) {
    dom.scenePrevBtn.addEventListener("click", function () {
      shiftSceneSlot(-1);
    });
  }

  if (dom.sceneNextBtn) {
    dom.sceneNextBtn.addEventListener("click", function () {
      shiftSceneSlot(1);
    });
  }

  syncSceneUiFromState();
}
