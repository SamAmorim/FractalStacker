import { clamp } from "../core/math.js";
import { state } from "../core/state.js";
import { dom } from "../ui/dom.js";
import { getSelectedPlotInstrument } from "../ui/plot-target.js";
import { canvasFont, palette, tint } from "../ui/theme.js";
import { resizeCanvasIfNeeded } from "./canvas.js";

export function drawChannelRack() {
  const canvas = dom.channelRackCanvas;
  if (!canvas || !state.instruments.length) {
    return;
  }

  resizeCanvasIfNeeded(canvas);
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const rows = Math.max(1, state.instruments.length);
  const currentStep = state.scheduler.currentStep;
  const barLength = 16;
  const beatLength = 4;
  const stepInBar = currentStep % barLength;
  const currentBar = Math.floor(currentStep / barLength);
  const barStart = currentBar * barLength;
  const padding = 8;
  const labelWidth = clamp(Math.floor(width * 0.2), width < 520 ? 60 : 78, 132);
  const rackWidth = Math.max(40, width - labelWidth - padding * 2);
  const headerSize = Math.max(10, Math.floor(height / 14));
  const rowsTop = padding + headerSize + 6;
  const rowHeight = Math.max(16, (height - rowsTop - padding) / rows);
  const cellWidth = rackWidth / barLength;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = palette.fgMute;
  ctx.font = canvasFont(headerSize);
  const cycleMode = state.plotAutoCycle ? (state.plotCycleUnit === "beat" ? "beat" : "bar") : "manual";
  const selectedInst = getSelectedPlotInstrument();
  const freezeTag = state.plotFrozen && selectedInst ? " | freeze " + selectedInst.name : "";
  const headerText = width < 680
    ? "rack c" + (currentBar + 1) + " b" + (Math.floor(stepInBar / beatLength) + 1) + " " + cycleMode + (state.plotFrozen ? " frz" : "")
    : "channel rack :: compasso " + (currentBar + 1) + " | beat " + (Math.floor(stepInBar / beatLength) + 1) + "/4 | scan " + cycleMode + freezeTag;
  ctx.fillText(headerText, padding + 4, padding + headerSize);

  state.instruments.forEach(function (inst, rowIndex) {
    const rowY = rowsTop + rowIndex * rowHeight;
    const selected = inst.id === state.plotInstrumentId;
    const frozenSelected = selected && state.plotFrozen;

    ctx.fillStyle = frozenSelected ? tint(palette.warn, 0.16) : selected ? tint(palette.accent, 0.12) : tint(palette.fg, 0.03);
    ctx.fillRect(padding, rowY, width - padding * 2, Math.max(8, rowHeight - 3));

    ctx.fillStyle = frozenSelected ? palette.warn : selected ? palette.accent : palette.fgDim;
    ctx.font = canvasFont(Math.max(10, Math.floor(rowHeight * 0.38)));
    const compactName = width < 520 ? inst.name.slice(0, 6).toUpperCase() : inst.name.toUpperCase();
    ctx.fillText(compactName, padding + 4, rowY + rowHeight * 0.62);

    const history = state.history[inst.id] || [];
    const triggerMap = {};
    history.forEach(function (point) {
      if (point && point.trigger) {
        triggerMap[point.step] = true;
      }
    });

    for (let col = 0; col < barLength; col += 1) {
      const step = barStart + col;
      const x = padding + labelWidth + col * cellWidth;
      const y = rowY + 2;
      const w = Math.max(2, cellWidth - 2);
      const h = Math.max(6, rowHeight - 8);
      const isCurrent = col === stepInBar;
      const isBeat = col % 4 === 0;
      const triggered = !!triggerMap[step];

      ctx.fillStyle = triggered ? tint(palette.accent, 0.85) : tint(palette.fg, 0.06);
      ctx.fillRect(x, y, w, h);

      if (isBeat) {
        ctx.strokeStyle = tint(palette.lineStrong, 0.9);
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
      }

      if (isCurrent) {
        ctx.strokeStyle = palette.warn;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
        ctx.lineWidth = 1;
      }
    }
  });
}
