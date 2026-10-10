const curves = new Map();

function driveCurve(amount) {
  const key = Math.round(amount * 20);
  if (curves.has(key)) {
    return curves.get(key);
  }
  const k = 1 + key * 1.2;
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  curves.set(key, curve);
  return curve;
}

export function createDrive(ctx, amount) {
  const shaper = ctx.createWaveShaper();
  shaper.curve = driveCurve(Math.max(0, Math.min(1, amount)));
  shaper.oversample = "2x";
  return shaper;
}
