import { EQUATIONS } from "../algorithms/equations/index.js";
import { euclidPattern } from "../algorithms/euclid.js";
import { harmonicPartialWeight, sampleHarmonicWave } from "../algorithms/harmonics.js";
import { getStyle } from "../composition/form.js";
import { grooveEnergy, grooveVoices, hatPulses } from "../composition/groove.js";
import { PHI } from "../config/constants.js";
import { SCALE_LIBRARY } from "../config/scales.js";
import { clamp } from "../core/math.js";
import { getInstrumentById, state } from "../core/state.js";
import { getSelectedPlotInstrument } from "../ui/plot-target.js";
import { canvasFont, palette, tint } from "../ui/theme.js";
import { resizeCanvasIfNeeded } from "./canvas.js";

const SLIDES = [
  { id: "equation", label: "Equação" },
  { id: "fractal", label: "Fractal" },
  { id: "decision", label: "Decisão" },
  { id: "rhythm", label: "Ritmo" },
  { id: "harmony", label: "Harmonia" },
  { id: "timbre", label: "Timbre" },
  { id: "overview", label: "Geral" }
];

const GLOBAL_CONTROL_SLIDES = {
  chaos: "equation",
  fractalDepth: "fractal",
  bpm: "rhythm",
  swing: "rhythm",
  humanize: "rhythm",
  energy: "rhythm",
  sidechain: "rhythm",
  styleSelect: "rhythm",
  rootHz: "harmony",
  scaleSelect: "harmony",
  globalDetune: "harmony",
  microtonal: "harmony",
  harmonicRhythm: "harmony",
  complexity: "harmony",
  motifMemory: "harmony",
  arpPattern: "harmony",
  arpRate: "harmony",
  arpOctaves: "harmony",
  performanceMode: "timbre",
  envAttack: "timbre",
  envDecay: "timbre",
  envSustain: "timbre",
  envRelease: "timbre"
};

const INSTRUMENT_FIELD_SLIDES = {
  equation: "equation",
  density: "decision",
  harmonicMix: "timbre",
  harmonicTilt: "timbre",
  detune: "harmony",
  octave: "harmony",
  enabled: "overview"
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const DRUM_RINGS = ["kick", "snare", "rim", "hat", "openHat"];

const FRAME_MS = 1000 / 30;

const demo = {
  lastDraw: 0,
  slideStartBar: 0,
  slideStartMs: 0,
  lastDomUpdate: 0,
  lastDomKey: "",
  change: null,
  restValues: new Map(),
  progressItems: []
};

let els = null;

function dpr() {
  return window.devicePixelRatio || 1;
}

function font(px) {
  return canvasFont(Math.round(px * dpr()));
}

function fmt(value, digits) {
  return Number.isFinite(value) ? value.toFixed(typeof digits === "number" ? digits : 2) : "--";
}

function currentBar() {
  return Math.floor(state.scheduler.currentStep / 16);
}

function slideDurationMs() {
  return state.demo.barsPerSlide * 4 * (60000 / Math.max(30, state.bpm));
}

function instColor(inst) {
  const colors = [palette.accent, palette.accent2, palette.warn, palette.fg, palette.ok, palette.fgDim];
  const index = state.instruments.indexOf(inst);
  return colors[(index < 0 ? 0 : index) % colors.length];
}

function focusInstrument(excludeRoles, fallbackId) {
  const focused = state.demo.focusInstId ? getInstrumentById(state.demo.focusInstId) : null;
  if (focused) {
    return focused;
  }
  const selected = getSelectedPlotInstrument();
  if (selected && excludeRoles && excludeRoles.indexOf(selected.role) !== -1) {
    return getInstrumentById(fallbackId) || selected;
  }
  return selected;
}

/* ---------- canvas helpers ---------- */

function frame(ctx, r, caption) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = tint(palette.line, 0.55);
  for (let i = 1; i < 4; i += 1) {
    const x = Math.round(r.x + (r.w * i) / 4) + 0.5;
    const y = Math.round(r.y + (r.h * i) / 4) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = tint(palette.lineStrong, 0.85);
  ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w), Math.round(r.h));
  if (caption) {
    ctx.fillStyle = palette.fgDim;
    ctx.font = font(11);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(caption, r.x, r.y - 8 * dpr());
  }
}

function px(r, v) {
  return r.x + clamp(v, 0, 1) * r.w;
}

function py(r, v) {
  return r.y + (1 - clamp(v, 0, 1)) * r.h;
}

function axisLabel(ctx, text, x, y, align) {
  ctx.fillStyle = palette.fgMute;
  ctx.font = font(10);
  ctx.textAlign = align || "left";
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

function legend(ctx, items, x, y) {
  const d = dpr();
  ctx.font = font(10);
  ctx.textAlign = "right";
  let cursor = x;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    ctx.fillStyle = palette.fgDim;
    ctx.fillText(item.label, cursor, y);
    cursor -= ctx.measureText(item.label).width + 6 * d;
    ctx.fillStyle = item.color;
    ctx.fillRect(cursor - 8 * d, y - 7 * d, 8 * d, 3 * d);
    cursor -= 22 * d;
  }
  ctx.textAlign = "left";
}

function contentArea(w, h) {
  const d = dpr();
  const pad = 16 * d;
  return { x: pad, y: pad + 22 * d, w: w - pad * 2, h: h - pad * 2 - 34 * d };
}

/* ---------- slide: equation ---------- */

function renderEquation(ctx, w, h) {
  const d = dpr();
  const inst = focusInstrument();
  const key = inst.equation;
  const eq = EQUATIONS[key] || { name: key, formula: "" };
  const dbg = state.equationDebug[inst.id] || {};
  const hist = (state.history[inst.id] || []).slice(-64);
  const raws = hist.map(function (p) { return p.raw; });
  const area = contentArea(w, h);
  const side = Math.min(area.h, area.w * 0.4);
  const left = { x: area.x, y: area.y, w: side, h: side };
  const gap = 36 * d;
  const right = { x: area.x + side + gap, y: area.y, w: area.w - side - gap, h: area.h };
  const r = 3.5 + state.chaos * 0.49;

  frame(ctx, left, key === "logistic" ? "y = r·x·(1 − x)     y = x" : "(x[n], x[n+1])");
  axisLabel(ctx, "x[n]", left.x + left.w, left.y + left.h + 14 * d, "right");
  axisLabel(ctx, "x[n+1]", left.x + 4 * d, left.y + 14 * d);

  if (key === "logistic") {
    ctx.strokeStyle = tint(palette.fgMute, 0.8);
    ctx.setLineDash([4 * d, 4 * d]);
    ctx.beginPath();
    ctx.moveTo(px(left, 0), py(left, 0));
    ctx.lineTo(px(left, 1), py(left, 1));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = palette.accent2;
    ctx.lineWidth = 2 * d;
    ctx.beginPath();
    for (let i = 0; i <= 120; i += 1) {
      const x = i / 120;
      const y = r * x * (1 - x);
      if (i === 0) ctx.moveTo(px(left, x), py(left, y));
      else ctx.lineTo(px(left, x), py(left, y));
    }
    ctx.stroke();

    const tail = raws.slice(-28);
    ctx.lineWidth = 1.2 * d;
    for (let k = 0; k < tail.length - 1; k += 1) {
      const a = tail[k];
      const b = tail[k + 1];
      ctx.strokeStyle = tint(palette.accent, 0.12 + 0.88 * (k / Math.max(1, tail.length - 2)));
      ctx.beginPath();
      ctx.moveTo(px(left, a), py(left, a));
      ctx.lineTo(px(left, a), py(left, b));
      ctx.lineTo(px(left, b), py(left, b));
      ctx.stroke();
    }
  } else {
    for (let k = 0; k < raws.length - 1; k += 1) {
      ctx.fillStyle = tint(palette.accent, 0.2 + 0.8 * (k / Math.max(1, raws.length - 2)));
      ctx.beginPath();
      ctx.arc(px(left, raws[k]), py(left, raws[k + 1]), 3 * d, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (raws.length >= 2) {
    ctx.fillStyle = palette.warn;
    ctx.beginPath();
    ctx.arc(px(left, raws[raws.length - 2]), py(left, raws[raws.length - 1]), 5 * d, 0, Math.PI * 2);
    ctx.fill();
  }

  frame(ctx, right, "x[n]");
  axisLabel(ctx, "1", right.x - 6 * d, right.y + 10 * d, "right");
  axisLabel(ctx, "0", right.x - 6 * d, right.y + right.h, "right");
  axisLabel(ctx, "n →", right.x + right.w, right.y + right.h + 14 * d, "right");
  const n = 64;
  const barW = Math.max(2 * d, (right.w / n) * 0.55);
  hist.forEach(function (p, i) {
    const x = right.x + ((i + 0.5 + (n - hist.length)) / n) * right.w;
    ctx.fillStyle = p.trigger ? palette.accent : tint(palette.accent, 0.28);
    const top = py(right, p.raw);
    ctx.fillRect(x - barW / 2, top, barW, right.y + right.h - top);
  });
  if (hist.length) {
    const last = hist[hist.length - 1];
    const x = right.x + ((n - 0.5) / n) * right.w;
    ctx.fillStyle = palette.warn;
    ctx.beginPath();
    ctx.arc(x, py(right, last.raw), 5 * d, 0, Math.PI * 2);
    ctx.fill();
  }

  const formula = [];
  const readout = [["camada", inst.name], ["equação", eq.name]];
  if (key === "logistic") {
    const prev = raws.length >= 2 ? raws[raws.length - 2] : NaN;
    const next = raws.length ? raws[raws.length - 1] : NaN;
    let lyap = 0;
    raws.forEach(function (x) { lyap += Math.log(Math.max(1e-6, Math.abs(r * (1 - 2 * x)))); });
    lyap /= Math.max(1, raws.length);
    formula.push("x[n+1] = r · x[n] · (1 − x[n])");
    formula.push("r = 3,5 + 0,49 · chaos = " + fmt(r, 3));
    formula.push("= " + fmt(r, 3) + " · " + fmt(prev, 3) + " · " + fmt(1 - prev, 3) + " = " + fmt(next, 3));
    readout.push(["chaos", fmt(state.chaos)]);
    readout.push(["r", fmt(r, 3)]);
    readout.push(["Lyapunov λ", (lyap >= 0 ? "+" : "") + fmt(lyap, 3)]);
    readout.push(["regime", lyap > 0 ? "caótico" : "periódico"]);
  } else {
    formula.push(eq.formula);
    String(dbg.detailText || "").split(" | ").forEach(function (part) {
      if (part) formula.push(part.replace(/=/g, " = "));
    });
    readout.push(["valor bruto", fmt(dbg.raw, 3)]);
    readout.push(["passo", String(dbg.step || 0)]);
  }

  return {
    title: eq.name + " · " + inst.name,
    formula: formula,
    readout: readout
  };
}

/* ---------- slide: fractal ---------- */

function fractalLayer(t, i, seed) {
  return Math.sin((t + seed * 0.5 + seed * 2.7) * 0.08 * i * PHI);
}

function renderFractal(ctx, w, h) {
  const d = dpr();
  const inst = focusInstrument();
  const seed = inst.seedOffset;
  const depth = Math.max(1, Math.round(state.fractalDepth));
  const step = state.scheduler.currentStep;
  const area = contentArea(w, h);
  const gap = 34 * d;
  const layersRect = { x: area.x, y: area.y, w: area.w, h: (area.h - gap) * 0.56 };
  const sumRect = { x: area.x, y: layersRect.y + layersRect.h + gap, w: area.w, h: (area.h - gap) * 0.44 };
  const past = 72;
  const span = 96;
  const t0 = step - past;
  const samples = Math.max(120, Math.floor(area.w / (2 * d)));
  let norm = 0;
  for (let i = 1; i <= depth; i += 1) norm += 1 / Math.pow(2, i);
  const nowX = area.x + (past / span) * area.w;

  frame(ctx, layersRect, "2⁻ⁱ · sin(0,08 · i · φ · s′)");
  const laneH = layersRect.h / depth;
  for (let i = 1; i <= depth; i += 1) {
    const mid = layersRect.y + laneH * (i - 0.5);
    const amp = 1 / Math.pow(2, i);
    const strength = 0.35 + 0.65 * (amp / 0.5);
    ctx.strokeStyle = tint(palette.accent2, strength);
    ctx.lineWidth = Math.max(1, 1.6 * d * strength);
    ctx.beginPath();
    for (let j = 0; j <= samples; j += 1) {
      const t = t0 + (j / samples) * span;
      const x = area.x + (j / samples) * area.w;
      const y = mid - fractalLayer(t, i, seed) * laneH * 0.38;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = palette.accent2;
    ctx.fillRect(layersRect.x + 1, mid - laneH * 0.38 * (amp / 0.5), 3 * d, laneH * 0.76 * (amp / 0.5));
    if (laneH > 14 * d) {
      axisLabel(ctx, "i=" + i + "  A=1/" + Math.pow(2, i), layersRect.x + 10 * d, mid - laneH * 0.18);
    }
  }

  frame(ctx, sumRect, "F(s)");
  const sumAt = function (t) {
    let acc = 0;
    for (let i = 1; i <= depth; i += 1) acc += fractalLayer(t, i, seed) / Math.pow(2, i);
    return (acc / norm + 1) * 0.5;
  };
  ctx.lineWidth = 2.2 * d;
  ctx.strokeStyle = palette.accent;
  ctx.beginPath();
  const nowJ = Math.round((past / span) * samples);
  for (let j = 0; j <= nowJ; j += 1) {
    const t = t0 + (j / samples) * span;
    const x = area.x + (j / samples) * area.w;
    if (j === 0) ctx.moveTo(x, py(sumRect, sumAt(t)));
    else ctx.lineTo(x, py(sumRect, sumAt(t)));
  }
  ctx.stroke();
  ctx.strokeStyle = tint(palette.accent, 0.4);
  ctx.setLineDash([5 * d, 5 * d]);
  ctx.beginPath();
  for (let j = nowJ; j <= samples; j += 1) {
    const t = t0 + (j / samples) * span;
    const x = area.x + (j / samples) * area.w;
    if (j === nowJ) ctx.moveTo(x, py(sumRect, sumAt(t)));
    else ctx.lineTo(x, py(sumRect, sumAt(t)));
  }
  ctx.stroke();
  ctx.setLineDash([]);

  (state.history[inst.id] || []).forEach(function (p) {
    if (typeof p.fractal !== "number" || p.step < t0) return;
    const x = area.x + ((p.step - t0) / span) * area.w;
    ctx.fillStyle = palette.warn;
    ctx.fillRect(x - 1.5 * d, py(sumRect, p.fractal) - 1.5 * d, 3 * d, 3 * d);
  });

  ctx.strokeStyle = tint(palette.warn, 0.7);
  ctx.setLineDash([3 * d, 4 * d]);
  ctx.beginPath();
  ctx.moveTo(nowX, layersRect.y);
  ctx.lineTo(nowX, sumRect.y + sumRect.h);
  ctx.stroke();
  ctx.setLineDash([]);
  axisLabel(ctx, "s", nowX + 4 * d, sumRect.y + sumRect.h - 4 * d);

  const now = sumAt(step);
  const weight = 0.28 + state.chaos * 0.18;
  return {
    title: "Assinatura fractal · D = " + depth,
    formula: [
      "F(s) = ½ + ½ · Σ 2⁻ⁱ · sin(0,08 · i · φ · s′) / Σ 2⁻ⁱ",
      "i = 1…" + depth + "   φ = " + fmt(PHI, 4) + "   s′ = s + 3,2 · seed",
      "F(" + step + ") = " + fmt(now, 3)
    ],
    readout: [
      ["camada", inst.name],
      ["Depth (D)", String(depth)],
      ["seed", String(seed)],
      ["F(s)", fmt(now, 3)],
      ["peso no valor final", Math.round(weight * 100) + "%"]
    ]
  };
}

/* ---------- slide: decision ---------- */

function renderDecision(ctx, w, h) {
  const d = dpr();
  const inst = focusInstrument(["drums"], "bass");
  const dbg = state.equationDebug[inst.id] || {};
  const hist = (state.history[inst.id] || []).slice(-64);
  const area = contentArea(w, h);
  const laneH = 22 * d;
  const lane = { x: area.x, y: area.y, w: area.w, h: laneH };
  const plot = { x: area.x, y: area.y + laneH + 30 * d, w: area.w, h: area.h - laneH - 30 * d };
  const n = 64;
  const xAt = function (i) {
    return plot.x + ((i + 0.5 + (n - hist.length)) / n) * plot.w;
  };

  frame(ctx, lane, "trigger");
  const cell = Math.min(laneH - 8 * d, (lane.w / n) * 0.7);
  hist.forEach(function (p, i) {
    const x = xAt(i) - cell / 2;
    const y = lane.y + (laneH - cell) / 2;
    if (p.trigger) {
      ctx.fillStyle = palette.accent;
      ctx.fillRect(x, y, cell, cell);
    } else {
      ctx.strokeStyle = tint(palette.fgMute, 0.6);
      ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    }
  });

  frame(ctx, plot, "");
  legend(ctx, [
    { label: "raw", color: palette.fgMute },
    { label: "F", color: palette.accent2 },
    { label: "v", color: palette.accent },
    { label: "θ", color: palette.warn }
  ], plot.x + plot.w, plot.y - 8 * d);

  function line(field, color, width, dashed) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * d;
    ctx.setLineDash(dashed ? [5 * d, 4 * d] : []);
    ctx.beginPath();
    let lastY = null;
    hist.forEach(function (p, i) {
      const v = p[field];
      if (typeof v !== "number") {
        lastY = null;
        return;
      }
      const x = xAt(i);
      const y = py(plot, v);
      if (lastY === null) {
        ctx.moveTo(x, y);
      } else if (dashed) {
        ctx.lineTo(x, lastY);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      lastY = y;
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  line("raw", palette.fgMute, 1);
  line("fractal", palette.accent2, 1.2);
  line("threshold", palette.warn, 1.4, true);
  line("value", palette.accent, 2.4);

  hist.forEach(function (p, i) {
    if (!p.trigger) return;
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(xAt(i), py(plot, p.value), 3.2 * d, 0, Math.PI * 2);
    ctx.fill();
  });
  axisLabel(ctx, "1", plot.x - 6 * d, plot.y + 10 * d, "right");
  axisLabel(ctx, "0", plot.x - 6 * d, plot.y + plot.h, "right");

  const c = state.chaos;
  const rawW = 0.72 - c * 0.2;
  const fracW = 0.28 + c * 0.18;
  const theta = typeof dbg.threshold === "number" ? dbg.threshold : NaN;
  const plays = Boolean(dbg.trigger);
  const legacy = Boolean(getStyle().legacy);
  const hits = hist.filter(function (p) { return p.trigger; }).length;

  return {
    title: "v > θ · " + inst.name,
    formula: [
      "v = raw·(0,72 − 0,2c) + F·(0,28 + 0,18c) + ε",
      "= " + fmt(dbg.raw) + "·" + fmt(rawW) + " + " + fmt(dbg.fractal) + "·" + fmt(fracW) + " + " + fmt(dbg.random) + " = " + fmt(dbg.combined),
      legacy ? "θ = 1 − densidade (± ajuste do papel)" : "θ = 1 − dens·(0,3 + 0,7·w)·(0,45 + 0,75·E)",
      "v " + (plays ? ">" : "≤") + " θ = " + fmt(theta) + "  →  " + (plays ? "TOCA" : "pausa")
    ],
    readout: [
      ["camada", inst.name],
      ["Density", fmt(inst.density)],
      ["chaos (c)", fmt(c)],
      ["energia (E)", fmt(state.compose.energy)],
      ["motivo", String(dbg.triggerReason || "--")],
      ["taxa de disparo", hist.length ? Math.round((hits / hist.length) * 100) + "%" : "--"]
    ]
  };
}

/* ---------- slide: rhythm ---------- */

function drumPattern(name, spec, energy) {
  if (!spec) return null;
  if (spec.mode === "steps") {
    const pattern = [];
    for (let i = 0; i < 16; i += 1) pattern.push(spec.steps.indexOf(i) !== -1);
    return { pattern: pattern, notation: spec.steps.length ? "passos " + spec.steps.join(",") : "—", pulses: spec.steps.length };
  }
  const pulses = name === "hat" ? hatPulses(spec, energy) : spec.pulses;
  return { pattern: euclidPattern(pulses, 16, spec.rotation), notation: "E(" + pulses + ",16) r" + spec.rotation, pulses: pulses };
}

function renderRhythm(ctx, w, h) {
  const d = dpr();
  const style = getStyle();
  const voices = grooveVoices(style.groove);
  const drums = getInstrumentById("rhythm") || state.instruments[0];
  const energy = grooveEnergy({ energy: state.compose.energy }, drums);
  const step = state.scheduler.currentStep;
  const s = step % 16;
  const area = contentArea(w, h);
  const R = Math.min(area.h, area.w * 0.48) / 2 - 18 * d;
  const cx = area.x + R + 18 * d;
  const cy = area.y + area.h / 2;
  const angleAt = function (i) { return -Math.PI / 2 + (i / 16) * Math.PI * 2; };

  const rows = DRUM_RINGS.map(function (name, k) {
    const spec = voices[name];
    const info = drumPattern(name, spec, energy);
    const active = Boolean(spec && info && info.pulses > 0 && energy >= spec.minEnergy && !style.legacy);
    return { name: name, spec: spec, info: info, active: active, radius: R * (0.3 + k * 0.15) };
  });

  ctx.strokeStyle = tint(palette.line, 0.6);
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i += 1) {
    const a = angleAt(i);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.22, cy + Math.sin(a) * R * 0.22);
    ctx.lineTo(cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02);
    ctx.stroke();
  }

  rows.forEach(function (row) {
    if (!row.info) return;
    const color = row.active ? palette.accent : tint(palette.fgMute, 0.7);
    ctx.strokeStyle = tint(palette.line, 0.9);
    ctx.beginPath();
    ctx.arc(cx, cy, row.radius, 0, Math.PI * 2);
    ctx.stroke();

    const hitIdx = [];
    row.info.pattern.forEach(function (hit, i) { if (hit) hitIdx.push(i); });
    if (hitIdx.length > 1) {
      ctx.strokeStyle = row.active ? tint(palette.accent, 0.45) : tint(palette.fgMute, 0.3);
      ctx.lineWidth = 1.2 * d;
      ctx.beginPath();
      hitIdx.forEach(function (i, k) {
        const a = angleAt(i);
        const x = cx + Math.cos(a) * row.radius;
        const y = cy + Math.sin(a) * row.radius;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    row.info.pattern.forEach(function (hit, i) {
      const a = angleAt(i);
      const x = cx + Math.cos(a) * row.radius;
      const y = cy + Math.sin(a) * row.radius;
      ctx.fillStyle = hit ? (row.active && i === s ? palette.warn : color) : tint(palette.line, 1);
      ctx.beginPath();
      ctx.arc(x, y, (hit ? 4.2 : 2) * d, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  (state.history[drums.id] || []).slice(-16).forEach(function (p) {
    if (!p.trigger) return;
    const a = angleAt(p.step % 16);
    ctx.fillStyle = tint(palette.accent2, 0.9);
    ctx.fillRect(cx + Math.cos(a) * R * 1.1 - 3 * d, cy + Math.sin(a) * R * 1.1 - 3 * d, 6 * d, 6 * d);
  });

  const ph = angleAt(s);
  ctx.strokeStyle = tint(palette.warn, 0.8);
  ctx.lineWidth = 1.5 * d;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(ph) * R * 1.16, cy + Math.sin(ph) * R * 1.16);
  ctx.stroke();
  const gx = cx + R * 1.3 + 30 * d;
  const gw = area.x + area.w - gx;
  if (gw > 160 * d) {
    const nameW = 74 * d;
    const noteW = 110 * d;
    const cellsW = gw - nameW - noteW;
    const cellW = cellsW / 16;
    const rowH = Math.min(46 * d, area.h / (rows.length + 1));
    const top = cy - (rows.length * rowH) / 2;
    ctx.fillStyle = tint(palette.warn, 0.12);
    ctx.fillRect(gx + nameW + noteW + s * cellW, top - 6 * d, cellW, rows.length * rowH + 6 * d);
    rows.forEach(function (row, k) {
      const y = top + k * rowH;
      ctx.fillStyle = row.active ? palette.fg : palette.fgMute;
      ctx.font = font(12);
      ctx.fillText(row.name, gx, y + rowH * 0.5);
      ctx.fillStyle = palette.fgDim;
      ctx.font = font(11);
      ctx.fillText(row.info ? row.info.notation : "—", gx + nameW, y + rowH * 0.5);
      if (!row.info) return;
      row.info.pattern.forEach(function (hit, i) {
        const x = gx + nameW + noteW + i * cellW;
        if (hit) {
          ctx.fillStyle = row.active ? (i === s ? palette.warn : palette.accent) : tint(palette.fgMute, 0.6);
          ctx.fillRect(x + 2 * d, y + rowH * 0.2, cellW - 4 * d, rowH * 0.45);
        } else {
          ctx.strokeStyle = tint(palette.line, 1);
          ctx.strokeRect(x + 2.5 * d, y + rowH * 0.2 + 0.5, cellW - 5 * d, rowH * 0.45 - 1);
        }
      });
      if (!row.active && row.spec && row.info.pulses > 0 && !style.legacy) {
        axisLabel(ctx, "E ≥ " + fmt(row.spec.minEnergy), gx + nameW + noteW, y + rowH * 0.92);
      }
    });
  }

  const hat = voices.hat;
  return {
    title: "Ritmo euclidiano",
    formula: [
      "E(k, 16): passo i toca  ⇔  (i·k) mod 16 < k",
      hat ? "hat: k = " + hat.pulses + " + round(max(0, E − 0,5)·12) = " + hatPulses(hat, energy) : "",
      "energia efetiva E = forma · (0,45 + 0,8·dens) = " + fmt(energy)
    ].filter(Boolean),
    readout: [
      ["estilo", style.label],
      ["seção", state.compose.section],
      ["energia", fmt(energy)],
      ["passo", (s + 1) + "/16"],
      ["swing", fmt(state.swing)],
      ["BPM", String(Math.round(state.bpm))]
    ]
  };
}

/* ---------- slide: harmony ---------- */

function renderHarmony(ctx, w, h) {
  const d = dpr();
  const area = contentArea(w, h);
  const R = Math.min(area.h, area.w * 0.44) / 2 - 26 * d;
  const cx = area.x + R + 26 * d;
  const cy = area.y + area.h / 2;
  const rootMidi = 69 + 12 * Math.log2(state.rootHz / 440);
  const rootPc = ((Math.round(rootMidi) % 12) + 12) % 12;
  const scale = SCALE_LIBRARY[state.scale] || SCALE_LIBRARY.minorPentatonic;
  const chord = state.compose.chord;
  const nextChord = state.compose.nextChord;
  const angleAt = function (k) { return -Math.PI / 2 + (k / 12) * Math.PI * 2; };
  const point = function (k, radius) {
    const a = angleAt(k);
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
  };
  const pcOf = function (semi) { return ((Math.round(semi) % 12) + 12) % 12; };

  ctx.strokeStyle = tint(palette.line, 0.9);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  function polygon(c, stroke, fill, dashed) {
    if (!c || !c.tones || c.tones.length < 2) return;
    const pcs = [];
    c.tones.forEach(function (t) { const pc = pcOf(t); if (pcs.indexOf(pc) === -1) pcs.push(pc); });
    pcs.sort(function (a, b) { return a - b; });
    ctx.beginPath();
    pcs.forEach(function (pc, i) {
      const p = point(pc, R);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.8 * d;
    ctx.setLineDash(dashed ? [5 * d, 5 * d] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  polygon(nextChord, tint(palette.fgMute, 0.8), null, true);
  polygon(chord, palette.accent2, tint(palette.accent2, 0.14), false);

  for (let k = 0; k < 12; k += 1) {
    const inScale = scale.intervals.indexOf(k) !== -1;
    const p = point(k, R);
    ctx.fillStyle = k === 0 ? palette.accent : inScale ? palette.fg : tint(palette.fgMute, 0.6);
    ctx.beginPath();
    ctx.arc(p[0], p[1], (k === 0 ? 6 : inScale ? 4.5 : 2.2) * d, 0, Math.PI * 2);
    ctx.fill();
    const lp = point(k, R + 18 * d);
    ctx.fillStyle = inScale ? palette.fg : palette.fgMute;
    ctx.font = font(inScale ? 12 : 10);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(NOTE_NAMES[(rootPc + k) % 12], lp[0], lp[1]);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const recent = state.monitor.recentFrequencies.slice(-40);
  recent.forEach(function (note, i) {
    const rel = 12 * Math.log2(note.frequency / state.rootHz);
    const oct = Math.floor(Math.round(rel) / 12);
    const radius = R * clamp(0.36 + (oct + 2) * 0.1, 0.2, 0.86);
    const p = point(pcOf(rel), radius);
    const inst = getInstrumentById(note.instId);
    ctx.fillStyle = tint(inst ? instColor(inst) : palette.accent, 0.2 + 0.8 * (i / Math.max(1, recent.length - 1)));
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3.4 * d, 0, Math.PI * 2);
    ctx.fill();
  });

  const roll = { x: cx + R + 56 * d, y: area.y, w: area.x + area.w - (cx + R + 56 * d), h: area.h - 22 * d };
  if (roll.w > 160 * d) {
    const step = state.scheduler.currentStep;
    const span = 64;
    const rels = recent.map(function (n) { return 12 * Math.log2(n.frequency / state.rootHz); });
    let lo = Math.min.apply(null, rels.concat([0])) - 2;
    let hi = Math.max.apply(null, rels.concat([12])) + 2;
    if (hi - lo < 24) hi = lo + 24;
    const ry = function (rel) { return roll.y + (1 - (rel - lo) / (hi - lo)) * roll.h; };
    frame(ctx, roll, "f = f₀ · 2^(n/12)");
    for (let semi = Math.ceil(lo); semi <= Math.floor(hi); semi += 1) {
      const pc = pcOf(semi);
      if (scale.intervals.indexOf(pc) === -1) continue;
      ctx.strokeStyle = pc === 0 ? tint(palette.lineStrong, 1) : tint(palette.line, 0.9);
      ctx.beginPath();
      ctx.moveTo(roll.x, ry(semi) + 0.5);
      ctx.lineTo(roll.x + roll.w, ry(semi) + 0.5);
      ctx.stroke();
      if (pc === 0) axisLabel(ctx, NOTE_NAMES[rootPc] + (Math.floor(semi / 12) + 2), roll.x - 6 * d, ry(semi) + 4 * d, "right");
    }
    recent.forEach(function (note, i) {
      const age = step - note.step;
      if (age < 0 || age > span) return;
      const x = roll.x + (1 - age / span) * roll.w;
      const inst = getInstrumentById(note.instId);
      ctx.fillStyle = inst ? instColor(inst) : palette.accent;
      ctx.fillRect(x - 4 * d, ry(rels[i]) - 2.5 * d, 8 * d, 5 * d);
    });
    let lx = roll.x;
    ctx.font = font(10);
    state.instruments.forEach(function (inst) {
      if (inst.role === "drums" || inst.role === "texture") return;
      ctx.fillStyle = instColor(inst);
      ctx.fillRect(lx, roll.y + roll.h + 12 * d, 8 * d, 4 * d);
      ctx.fillStyle = palette.fgDim;
      ctx.fillText(inst.name, lx + 12 * d, roll.y + roll.h + 17 * d);
      lx += ctx.measureText(inst.name).width + 30 * d;
    });
  }

  const last = recent.length ? recent[recent.length - 1] : null;
  const lastRel = last ? 12 * Math.log2(last.frequency / state.rootHz) : NaN;
  return {
    title: NOTE_NAMES[rootPc] + " " + scale.label + (chord ? " · " + chord.name : ""),
    formula: [
      "f = f₀ · 2^(n/12)",
      last ? "= " + fmt(state.rootHz, 1) + " · 2^(" + fmt(lastRel, 2) + "/12) = " + fmt(last.frequency, 1) + " Hz" : "aguardando notas…",
      "acorde: " + (chord ? chord.name : "--") + "  →  " + (nextChord ? nextChord.name : "--")
    ],
    readout: [
      ["escala", scale.label],
      ["tônica f₀", NOTE_NAMES[rootPc] + " · " + fmt(state.rootHz, 1) + " Hz"],
      ["acorde", chord ? chord.name : "--"],
      ["troca a cada", state.music.harmonicRhythm + " comp."],
      ["seção", state.compose.section],
      ["tom detectado", state.monitor.keyStatus]
    ]
  };
}

/* ---------- slide: timbre ---------- */

function renderTimbre(ctx, w, h) {
  const d = dpr();
  const inst = focusInstrument(["drums", "texture"], "pad");
  const dbg = state.equationDebug[inst.id] || {};
  const v = clamp(typeof dbg.combined === "number" ? dbg.combined : inst.lastValue, 0, 1);
  const H = state.performanceMode === "eco" ? 8 : state.performanceMode === "balanced" ? 14 : 20;
  const k = 0.65 + (1 - clamp(inst.harmonicTilt, 0, 1)) * 2.35;
  const area = contentArea(w, h);
  const gap = 40 * d;
  const bars = { x: area.x, y: area.y, w: area.w * 0.52, h: area.h };
  const rightX = bars.x + bars.w + gap;
  const rightW = area.x + area.w - rightX;
  const wave = { x: rightX, y: area.y, w: rightW, h: (area.h - gap) * 0.58 };
  const env = { x: rightX, y: wave.y + wave.h + gap, w: rightW, h: (area.h - gap) * 0.42 };

  const weights = [];
  let maxW = 0;
  for (let n = 1; n <= H; n += 1) {
    const wn = harmonicPartialWeight(inst, v, n, 0.18);
    weights.push(wn);
    maxW = Math.max(maxW, wn);
  }
  frame(ctx, bars, "wₙ     n^−k");
  const slot = bars.w / H;
  weights.forEach(function (wn, i) {
    const x = bars.x + i * slot + slot * 0.18;
    const top = py(bars, wn / Math.max(1e-6, maxW));
    ctx.fillStyle = i === 0 ? palette.accent : tint(palette.accent, 0.85);
    ctx.fillRect(x, top, slot * 0.64, bars.y + bars.h - top);
    if (slot > 16 * d) axisLabel(ctx, String(i + 1), x + slot * 0.32, bars.y + bars.h + 14 * d, "center");
  });
  ctx.strokeStyle = palette.warn;
  ctx.lineWidth = 1.4 * d;
  ctx.setLineDash([5 * d, 4 * d]);
  ctx.beginPath();
  for (let n = 1; n <= H; n += 1) {
    const x = bars.x + (n - 0.5) * slot;
    const y = py(bars, (1 / Math.pow(n, k)) / Math.max(1e-6, maxW));
    if (n === 1) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  frame(ctx, wave, "Σ wₙ · sin(n·ωt)");
  ctx.strokeStyle = palette.accent2;
  ctx.lineWidth = 2 * d;
  ctx.beginPath();
  const samples = Math.max(160, Math.floor(wave.w / (2 * d)));
  for (let j = 0; j <= samples; j += 1) {
    const x = (j / samples) * 2;
    const y = sampleHarmonicWave(inst, x % 1, v);
    if (j === 0) ctx.moveTo(px(wave, j / samples), py(wave, y));
    else ctx.lineTo(px(wave, j / samples), py(wave, y));
  }
  ctx.stroke();

  const envState = state.envelope;
  const hold = 0.35;
  const total = envState.attack + envState.decay + hold + envState.release;
  const ex = function (t) { return env.x + (t / total) * env.w; };
  frame(ctx, env, "ADSR");
  ctx.strokeStyle = palette.fg;
  ctx.lineWidth = 1.8 * d;
  ctx.beginPath();
  ctx.moveTo(ex(0), py(env, 0));
  ctx.lineTo(ex(envState.attack), py(env, 1));
  ctx.lineTo(ex(envState.attack + envState.decay), py(env, envState.sustain));
  ctx.lineTo(ex(envState.attack + envState.decay + hold), py(env, envState.sustain));
  ctx.lineTo(ex(total), py(env, 0));
  ctx.stroke();
  [["A", envState.attack / 2], ["D", envState.attack + envState.decay / 2], ["S", envState.attack + envState.decay + hold / 2], ["R", total - envState.release / 2]].forEach(function (lab) {
    axisLabel(ctx, lab[0], ex(lab[1]), env.y + env.h + 14 * d, "center");
  });

  return {
    title: "Espectro harmônico · " + inst.name,
    formula: [
      "wₙ = n^(−k) · (0,44 + 0,56·|sin(2π·v·n·(1 + 1,8m))|) · cₙ",
      "k = 0,65 + 2,35·(1 − tilt) = " + fmt(k),
      "m = " + fmt(inst.harmonicMix) + "   v = " + fmt(v) + "   H = " + H
    ],
    readout: [
      ["camada", inst.name],
      ["Harm Mix (m)", fmt(inst.harmonicMix)],
      ["Harm Tilt", fmt(inst.harmonicTilt)],
      ["modo", state.performanceMode + " · " + H + " harm."],
      ["ADSR", fmt(envState.attack) + " / " + fmt(envState.decay) + " / " + fmt(envState.sustain) + " / " + fmt(envState.release)]
    ]
  };
}

const RENDERERS = {
  equation: renderEquation,
  fractal: renderFractal,
  decision: renderDecision,
  rhythm: renderRhythm,
  harmony: renderHarmony,
  timbre: renderTimbre
};

/* ---------- DOM ---------- */

function renderList(container, items, build) {
  container.replaceChildren.apply(container, items.map(build));
}

function updateDom(info, slide) {
  const index = SLIDES.indexOf(slide);
  els.idx.textContent = String(index + 1).padStart(2, "0") + " / " + String(SLIDES.length).padStart(2, "0");
  els.title.textContent = info.title;
  renderList(els.formula, info.formula, function (text, i) {
    const line = document.createElement("div");
    line.className = i === 0 ? "ds-f-main" : "ds-f-sub";
    line.textContent = text;
    return line;
  });
  const rows = [];
  info.readout.forEach(function (pair) {
    const dt = document.createElement("dt");
    dt.textContent = pair[0];
    const dd = document.createElement("dd");
    dd.textContent = pair[1];
    rows.push(dt, dd);
  });
  els.readout.replaceChildren.apply(els.readout, rows);
}

function updateProgress(fraction) {
  demo.progressItems.forEach(function (item, i) {
    const current = i === state.demo.slide;
    item.classList.toggle("is-current", current);
    item.style.setProperty("--p", current ? String(clamp(fraction, 0, 1)) : (i < state.demo.slide ? "1" : "0"));
  });
}

function updateChangeChip() {
  const change = demo.change;
  const visible = Boolean(change && performance.now() - change.at < 4500);
  els.change.hidden = !visible;
  if (visible) {
    els.changeKey.textContent = change.label;
    els.changeValue.textContent = change.from && change.from !== change.to ? change.from + " → " + change.to : change.to;
  } else if (change) {
    demo.restValues.set(change.id, change.to);
    demo.change = null;
  }
}

/* ---------- navigation ---------- */

function goToSlide(index, keepFocus) {
  const next = ((index % SLIDES.length) + SLIDES.length) % SLIDES.length;
  state.demo.slide = next;
  if (!keepFocus) {
    state.demo.focusInstId = null;
  }
  demo.slideStartBar = currentBar();
  demo.slideStartMs = performance.now();
  demo.lastDomKey = "";
  document.body.setAttribute("data-demo-slide", SLIDES[next].id);
}

function slideFraction() {
  if (!state.demo.barsPerSlide) {
    return 0;
  }
  if (state.powered) {
    const bar = currentBar();
    if (bar < demo.slideStartBar) {
      demo.slideStartBar = bar;
    }
    const steps = state.scheduler.currentStep - demo.slideStartBar * 16;
    return steps / (state.demo.barsPerSlide * 16);
  }
  return (performance.now() - demo.slideStartMs) / slideDurationMs();
}

function tick() {
  const fraction = slideFraction();
  if (state.demo.barsPerSlide && fraction >= 1) {
    goToSlide(state.demo.slide + 1);
    updateProgress(0);
    return;
  }
  updateProgress(fraction);
}

function displayValue(el) {
  const label = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
  const span = label ? label.querySelector(".value") : null;
  if (span && span.textContent.trim()) {
    return span.textContent.trim();
  }
  const row = el.closest("[data-inst]");
  const fieldSpan = row && el.dataset.field ? row.querySelector('[data-value="' + el.dataset.field + '"]') : null;
  if (fieldSpan && el.type === "range") {
    return fieldSpan.textContent.trim();
  }
  if (el.type === "checkbox") {
    return el.checked ? "on" : "off";
  }
  if (el.tagName === "SELECT") {
    return el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value;
  }
  return el.value;
}

function controlLabel(el, inst) {
  const label = document.querySelector('label[for="' + el.id + '"]');
  let text = label ? (label.childNodes[0] ? label.childNodes[0].textContent : label.textContent).trim() : (el.getAttribute("aria-label") || el.id);
  if (!text) {
    text = el.dataset.field || el.id;
  }
  return inst ? inst.name + " · " + text : text;
}

function snapshotRestValues() {
  demo.restValues.clear();
  document.querySelectorAll(".sidebar input[id], .sidebar select[id], #instrumentRack input[id], #instrumentRack select[id]").forEach(function (el) {
    demo.restValues.set(el.id, displayValue(el));
  });
}

function onControlEvent(event) {
  if (!state.graphsOnly) {
    return;
  }
  const el = event.target;
  if (!el || !el.id || !(el.tagName === "INPUT" || el.tagName === "SELECT")) {
    return;
  }
  if (!el.closest(".sidebar") && !el.closest("#instrumentRack")) {
    return;
  }

  let target = GLOBAL_CONTROL_SLIDES[el.id] || null;
  let inst = null;
  const match = /^inst-([a-z0-9]+)-([A-Za-z]+)$/.exec(el.id);
  if (match) {
    inst = getInstrumentById(match[1]);
    target = INSTRUMENT_FIELD_SLIDES[match[2]] || null;
  }

  const now = performance.now();
  const value = displayValue(el);
  if (!demo.change || demo.change.id !== el.id) {
    if (demo.change) {
      demo.restValues.set(demo.change.id, demo.change.to);
    }
    demo.change = { id: el.id, label: controlLabel(el, inst), from: demo.restValues.get(el.id), to: value, at: now };
  } else {
    demo.change.to = value;
    demo.change.at = now;
  }

  if (inst && target && target !== "overview") {
    state.demo.focusInstId = inst.id;
  }
  if (target) {
    const index = SLIDES.findIndex(function (slide) { return slide.id === target; });
    if (index !== state.demo.slide) {
      goToSlide(index, true);
    } else {
      demo.slideStartBar = currentBar();
      demo.slideStartMs = now;
    }
  }
}

/* ---------- public API ---------- */

export function onDemoModeChanged(enabled) {
  if (!els) {
    return;
  }
  if (enabled) {
    snapshotRestValues();
    demo.change = null;
    goToSlide(0);
  } else {
    document.body.removeAttribute("data-demo-slide");
  }
}

export function isDemoSlideActive() {
  return Boolean(state.graphsOnly && SLIDES[state.demo.slide].id !== "overview");
}

export function updateDemoSlides() {
  if (!els || !state.graphsOnly) {
    return false;
  }
  tick();
  updateChangeChip();
  const slide = SLIDES[state.demo.slide];
  const render = RENDERERS[slide.id];
  if (!render) {
    return false;
  }

  const now = performance.now();
  if (now - demo.lastDraw < FRAME_MS) {
    return true;
  }
  demo.lastDraw = now;

  const canvas = els.canvas;
  resizeCanvasIfNeeded(canvas, 320, 220);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const info = render(ctx, canvas.width, canvas.height);

  if (now - demo.lastDomUpdate > 120) {
    const key = JSON.stringify(info);
    if (key !== demo.lastDomKey) {
      updateDom(info, slide);
      demo.lastDomKey = key;
    }
    demo.lastDomUpdate = now;
  }
  return true;
}

export function bindDemoSlides() {
  els = {
    stage: document.getElementById("demoStage"),
    canvas: document.getElementById("dsCanvas"),
    idx: document.getElementById("dsIdx"),
    title: document.getElementById("dsTitle"),
    formula: document.getElementById("dsFormula"),
    readout: document.getElementById("dsReadout"),
    change: document.getElementById("dsChange"),
    changeKey: document.getElementById("dsChangeKey"),
    changeValue: document.getElementById("dsChangeValue"),
    progress: document.getElementById("dsProgress")
  };
  if (!els.stage || !els.canvas || !els.progress) {
    els = null;
    return;
  }

  demo.progressItems = SLIDES.map(function (slide, i) {
    const item = document.createElement("li");
    item.className = "ds-step";
    item.textContent = slide.label;
    item.title = (i + 1) + " · " + slide.label;
    return item;
  });
  els.progress.replaceChildren.apply(els.progress, demo.progressItems);

  const barsSelect = document.getElementById("demoBarsPerSlide");
  if (barsSelect) {
    barsSelect.value = String(state.demo.barsPerSlide);
    barsSelect.addEventListener("change", function () {
      state.demo.barsPerSlide = Math.max(0, Number(barsSelect.value) || 0);
      demo.slideStartBar = currentBar();
      demo.slideStartMs = performance.now();
    });
  }

  document.addEventListener("input", onControlEvent);
  document.addEventListener("change", onControlEvent);

  document.addEventListener("keydown", function (event) {
    if (!state.graphsOnly) {
      return;
    }
    const tag = (event.target && event.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      return;
    }
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      goToSlide(state.demo.slide + 1);
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      goToSlide(state.demo.slide - 1);
    } else if (/^[1-7]$/.test(event.key)) {
      event.preventDefault();
      goToSlide(Number(event.key) - 1);
    }
  });
}
