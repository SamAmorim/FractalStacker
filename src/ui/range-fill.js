import { clamp } from "../core/math.js";

function syncRangeFill(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const ratio = (Number(input.value) - min) / Math.max(0.000001, max - min);
  const fill = (clamp(ratio, 0, 1) * 100).toFixed(1) + "%";
  if (input.style.getPropertyValue("--fill") !== fill) {
    input.style.setProperty("--fill", fill);
  }
}

function syncAllRangeFills() {
  Array.from(document.querySelectorAll("input[type='range']")).forEach(syncRangeFill);
}

export function bindRangeFills() {
  document.addEventListener("input", function (event) {
    if (event.target && event.target.type === "range") {
      syncRangeFill(event.target);
    }
  });
  syncAllRangeFills();
  // MIDI CC and scene recall set values without firing input events.
  window.setInterval(syncAllRangeFills, 250);
}
