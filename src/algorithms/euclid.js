const cache = new Map();

export function euclidPattern(pulses, steps, rotation) {
  const safeSteps = Math.max(1, Math.round(steps));
  const safePulses = Math.max(0, Math.min(safeSteps, Math.round(pulses)));
  const shift = ((Math.round(rotation || 0) % safeSteps) + safeSteps) % safeSteps;
  const key = safePulses + ":" + safeSteps + ":" + shift;
  if (cache.has(key)) {
    return cache.get(key);
  }

  const bresenham = [];
  for (let i = 0; i < safeSteps; i += 1) {
    const index = (i - shift + safeSteps) % safeSteps;
    bresenham.push(safePulses > 0 && (index * safePulses) % safeSteps < safePulses);
  }

  cache.set(key, bresenham);
  return bresenham;
}

export function euclidHit(pulses, steps, rotation, step) {
  const pattern = euclidPattern(pulses, steps, rotation);
  return pattern[((step % pattern.length) + pattern.length) % pattern.length];
}
