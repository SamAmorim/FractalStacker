import { sampleEquationForPlot } from "../algorithms/equation-runtime.js";
import { sampleHarmonicWave } from "../algorithms/harmonics.js";
import { clamp } from "../core/math.js";
import { state } from "../core/state.js";
import { dom } from "../ui/dom.js";
import { getSelectedPlotInstrument } from "../ui/plot-target.js";
import { canvasFont, palette, tint } from "../ui/theme.js";
import { resizeCanvasIfNeeded } from "./canvas.js";

function drawCartesianGrid(ctx, width, height) {
  ctx.strokeStyle = tint(palette.line, 0.6);
  ctx.lineWidth = 1;

  for (let i = 0; i <= 10; i += 1) {
    const x = (i / 10) * width;
    const y = (i / 10) * height;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = tint(palette.lineStrong, 0.9);
  ctx.beginPath();
  ctx.moveTo(0, height * 0.5);
  ctx.lineTo(width, height * 0.5);
  ctx.stroke();
}

function drawCurveCartesian(canvas, sampleFn, config) {
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  resizeCanvasIfNeeded(canvas);
  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, width, height);
  drawCartesianGrid(ctx, width, height);

  ctx.strokeStyle = config.curveColor;
  ctx.lineWidth = Math.max(1.5, width / 600);
  ctx.beginPath();
  for (let i = 0; i < width; i += 1) {
    const xNorm = i / Math.max(1, width - 1);
    const yNorm = clamp(sampleFn(xNorm), 0, 1);
    const y = (1 - yNorm) * height;
    if (i === 0) {
      ctx.moveTo(i, y);
    } else {
      ctx.lineTo(i, y);
    }
  }
  ctx.stroke();

  const markerXNorm = clamp(config.markerX, 0, 1);
  const markerYNorm = clamp(sampleFn(markerXNorm), 0, 1);
  const markerX = markerXNorm * width;
  const markerY = (1 - markerYNorm) * height;

  ctx.strokeStyle = tint(palette.warn, 0.55);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(markerX, 0);
  ctx.lineTo(markerX, height);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = palette.warn;
  ctx.beginPath();
  ctx.arc(markerX, markerY, Math.max(3, width / 180), 0, Math.PI * 2);
  ctx.fill();

  const labelSize = Math.max(11, Math.floor(height / 20));
  ctx.fillStyle = palette.fgDim;
  ctx.font = canvasFont(labelSize);
  ctx.fillText(config.label, 10, labelSize + 8);
}

export function drawEquationCartesian() {
  const inst = getSelectedPlotInstrument();
  if (!inst) {
    return;
  }

  const markerX = ((state.scheduler.currentStep % 128) + 1) / 128;
  drawCurveCartesian(dom.equationCartesianCanvas, function (xNorm) {
    return sampleEquationForPlot(inst, xNorm);
  }, {
    markerX: markerX,
    curveColor: palette.accent,
    label: "equacao(" + inst.name + ")"
  });
}

export function drawHarmonicCartesian() {
  const inst = getSelectedPlotInstrument();
  if (!inst) {
    return;
  }

  const runtime = state.equationDebug[inst.id];
  const eqValue = runtime ? runtime.combined : inst.lastValue;
  const markerX = ((state.scheduler.currentStep % 256) + 1) / 256;

  drawCurveCartesian(dom.harmonicCanvas, function (xNorm) {
    return sampleHarmonicWave(inst, xNorm, eqValue);
  }, {
    markerX: markerX,
    curveColor: palette.accent2,
    label: "onda harmonica(" + inst.name + ")"
  });
}
