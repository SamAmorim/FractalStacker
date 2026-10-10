import { EQUATIONS } from "../algorithms/equations/index.js";
import { audio } from "../audio/engine.js";
import { MAX_VOICES } from "../config/constants.js";
import { state } from "../core/state.js";
import { collectMappedControlIds } from "../midi/learn.js";
import { dom } from "../ui/dom.js";
import { renderPerformanceHud } from "../ui/hud.js";
import { getSelectedPlotInstrument } from "../ui/plot-target.js";
import { canvasFont, palette, tint } from "../ui/theme.js";
import { resizeCanvasIfNeeded } from "./canvas.js";
import { drawEquationCartesian, drawHarmonicCartesian } from "./cartesian.js";
import { drawChannelRack } from "./channel-rack.js";
import { updateDemoSlides } from "./demo-slides.js";

function drawLanes(ctx, width, height, laneAreaTop) {
  const barLength = 16;
  const lanes = state.instruments;
  const laneHeight = Math.max(20, (height - laneAreaTop) / lanes.length);

  lanes.forEach(function (inst, laneIndex) {
    const yTop = laneAreaTop + laneIndex * laneHeight;
    const yMid = yTop + laneHeight * 0.55;
    const laneHistory = state.history[inst.id] || [];
    const pointCount = laneHistory.length;

    ctx.strokeStyle = tint(palette.line, 0.8);
    ctx.beginPath();
    ctx.moveTo(0, yMid);
    ctx.lineTo(width, yMid);
    ctx.stroke();

    for (let i = 0; i < pointCount; i += 1) {
      const point = laneHistory[i];
      const x = (i / Math.max(1, pointCount - 1)) * width;
      const valueY = yMid - (point.value - 0.5) * laneHeight * 0.7;

      if (laneIndex === 0 && typeof point.step === "number") {
        if (point.step % barLength === 0) {
          ctx.strokeStyle = palette.lineStrong;
          ctx.beginPath();
          ctx.moveTo(x, laneAreaTop - 6);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        if (point.step % barLength === barLength - 1) {
          ctx.strokeStyle = tint(palette.line, 0.9);
          ctx.beginPath();
          ctx.moveTo(x, laneAreaTop - 6);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }

      if (point.trigger) {
        ctx.fillStyle = inst.enabled ? palette.accent : tint(palette.fgMute, 0.4);
        ctx.fillRect(x, yMid - laneHeight * 0.18, Math.max(2, width / 160), laneHeight * 0.36);

        if (point.frequency && laneHeight > 26) {
          ctx.fillStyle = tint(palette.accent2, 0.85);
          ctx.font = canvasFont(Math.max(9, Math.floor(height / 40)));
          ctx.fillText(point.frequency.toFixed(1), x + 2, yMid - laneHeight * 0.22);
        }
      }

      ctx.fillStyle = tint(palette.fgDim, 0.45);
      ctx.fillRect(x, valueY, 1, 1);
    }

    ctx.fillStyle = inst.enabled ? palette.fg : tint(palette.fgMute, 0.6);
    ctx.font = canvasFont(Math.max(11, Math.floor(height / 24)));
    ctx.fillText(
      inst.name + " | eq " + EQUATIONS[inst.equation].name + " | dens " + inst.density.toFixed(2),
      8,
      yTop + Math.max(13, laneHeight * 0.3)
    );
  });
}

export function drawVisualizer() {
  if (updateDemoSlides()) {
    renderPerformanceHud();
    requestAnimationFrame(drawVisualizer);
    return;
  }

  const canvas = dom.activityCanvas;
  const ctx = canvas.getContext("2d");
  resizeCanvasIfNeeded(canvas);

  drawEquationCartesian();
  drawHarmonicCartesian();
  drawChannelRack();
  renderPerformanceHud();

  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, width, height);

  const barLength = 16;
  const barNumber = Math.floor(state.scheduler.currentStep / barLength) + 1;
  const beatInBar = (state.scheduler.currentStep % barLength) + 1;

  ctx.fillStyle = palette.fgDim;
  ctx.font = canvasFont(Math.max(11, Math.floor(height / 24)));
  ctx.fillText("compasso " + barNumber + " | step " + state.scheduler.currentStep + " | beat " + beatInBar + "/" + barLength, 8, 16);
  ctx.fillText("notas: " + state.lastNoteSummary, 8, 31);
  ctx.fillText("mix: " + state.lastMixSummary, 8, 46);
  ctx.fillText("midi: " + state.midi.lastMessage, 8, 61);

  let laneAreaTop = 70;
  if (state.graphsOnly) {
    const voices = audio.ready ? audio.activeVoices : 0;
    const maxVoices = MAX_VOICES[state.performanceMode];
    const mappedKnobs = collectMappedControlIds().length;
    const mappedPads = Object.keys(state.midi.padMap).length;
    const selectedInst = getSelectedPlotInstrument();
    const selectedName = selectedInst ? selectedInst.name : "--";
    ctx.fillText(
      "status: " + (state.powered ? "ON" : "OFF") + " | mode " + state.performanceMode.toUpperCase() + " | voices " + voices + "/" + maxVoices,
      8,
      76
    );
    ctx.fillText(
      "maps: knobs " + mappedKnobs + " | pads " + mappedPads + " | target " + selectedName,
      8,
      91
    );
    laneAreaTop = 102;
  }

  drawLanes(ctx, width, height, laneAreaTop);
  requestAnimationFrame(drawVisualizer);
}
