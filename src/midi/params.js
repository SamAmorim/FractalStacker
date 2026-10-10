import { clamp } from "../core/math.js";

/** Shared MIDI/UI path: apply a 0–127 MIDI value to a DOM control. */
export function setParamFromMidi(controlId, midiValue, options) {
  const opts = options || {};
  const control = document.getElementById(controlId);
  if (!control || control.tagName === "BUTTON") {
    return false;
  }

  const mode = opts.mode || "absolute";
  const value = clamp(Number(midiValue) || 0, 0, 127);

  if (control.type === "checkbox") {
    if (mode === "momentary") {
      control.checked = value >= 64;
    } else if (mode === "toggle") {
      if (opts.source === "cc" && value < 64) {
        return null;
      }
      control.checked = !control.checked;
    } else {
      control.checked = value >= 64;
    }
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (control.tagName === "SELECT") {
    const optionCount = Math.max(1, control.options.length);
    const index = Math.round((value / 127) * Math.max(0, optionCount - 1));
    control.selectedIndex = index;
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const min = Number(control.min || 0);
  const max = Number(control.max || 1);
  const step = Number(control.step || 0);
  let next;

  if (mode === "relative") {
    const span = max - min;
    const deltaSteps = value < 64 ? value - 64 : value > 64 ? value - 64 : 0;
    const unit = Number.isFinite(step) && step > 0 ? step : span / 127;
    next = Number(control.value || min) + deltaSteps * unit;
  } else {
    next = min + (max - min) * (value / 127);
  }

  if (Number.isFinite(step) && step > 0) {
    next = Math.round((next - min) / step) * step + min;
    const decimals = step < 1 ? Math.min(6, (String(step).split(".")[1] || "").length) : 0;
    next = Number(next.toFixed(decimals));
  }

  next = clamp(next, min, max);
  control.value = String(next);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

export function clickControl(controlId) {
  const control = document.getElementById(controlId);
  if (!control || control.tagName !== "BUTTON") {
    return false;
  }
  control.click();
  return true;
}

export function setCheckboxState(controlId, on) {
  const control = document.getElementById(controlId);
  if (!control || control.type !== "checkbox") {
    return false;
  }
  control.checked = Boolean(on);
  control.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}
