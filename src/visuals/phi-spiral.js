import { PHI, PHI_SENSITIVITY_PRESETS } from "../config/constants.js";
import { clamp } from "../core/math.js";
import { state } from "../core/state.js";
import { dom } from "../ui/dom.js";
import { canvasFont, palette, tint } from "../ui/theme.js";
import { resizeCanvasIfNeeded } from "./canvas.js";

function traceLogarithmicSpiral(ctx, centerX, centerY, maxRadius, turns, kValue, phaseOffset) {
  const thetaMax = Math.max(Math.PI, turns * Math.PI * 2);
  const safeK = Number.isFinite(kValue) ? kValue : (2 * Math.log(PHI) / Math.PI);
  const a = maxRadius / Math.exp(safeK * thetaMax);
  const steps = Math.max(120, Math.floor(thetaMax * 44));

  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = thetaMax * (i / steps);
    const radius = a * Math.exp(safeK * t);
    const x = centerX + radius * Math.cos(t + phaseOffset);
    const y = centerY + radius * Math.sin(t + phaseOffset);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
}

export function drawPhiSpiral() {
  const canvas = dom.phiSpiralCanvas;
  if (!canvas) {
    return;
  }

  resizeCanvasIfNeeded(canvas, 120, 58, 66);
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const ratio = Number.isFinite(state.monitor.phiRatio) ? state.monitor.phiRatio : PHI;
  const diff = Number.isFinite(state.monitor.phiDiff) ? state.monitor.phiDiff : Infinity;
  const preset = PHI_SENSITIVITY_PRESETS[state.phiSensitivity] || PHI_SENSITIVITY_PRESETS.balanced;
  const maxReadableDiff = Math.max(0.0001, preset.near * 1.6);
  const closeness = clamp(1 - diff / maxReadableDiff, 0, 1);
  const phase = ((state.scheduler.currentStep % 64) / 64) * Math.PI * 0.6;
  const centerX = width * 0.5;
  const centerY = height * 0.54;
  const maxRadius = Math.min(width, height) * 0.42;
  const refK = 2 * Math.log(PHI) / Math.PI;
  const liveK = 2 * Math.log(clamp(ratio, 1.05, 2.3)) / Math.PI;
  const turns = 2.05 + closeness * 1.9;

  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = Math.max(1, width / 240);
  ctx.strokeStyle = tint(palette.lineStrong, 0.8);
  traceLogarithmicSpiral(ctx, centerX, centerY, maxRadius, turns, refK, phase);
  ctx.stroke();

  let liveColor = palette.accent;
  if (state.monitor.phiClass === "phi-hit") {
    liveColor = palette.warn;
  } else if (state.monitor.phiClass === "phi-near") {
    liveColor = palette.accent2;
  }

  ctx.lineWidth = Math.max(1.2, width / 180) + closeness * 0.7;
  ctx.strokeStyle = liveColor;
  traceLogarithmicSpiral(ctx, centerX, centerY, maxRadius, turns, liveK, phase + 0.16);
  ctx.stroke();

  ctx.fillStyle = palette.fgMute;
  ctx.font = canvasFont(Math.max(9, Math.floor(height / 5)));
  ctx.fillText(ratio.toFixed(3), 4, Math.max(10, Math.floor(height * 0.22)));
}
