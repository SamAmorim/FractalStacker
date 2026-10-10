function buildPool(chordTones, octaves) {
  const pool = [];
  for (let octave = 0; octave < Math.max(1, octaves); octave += 1) {
    chordTones.forEach(function (tone) {
      pool.push(tone + octave * 12);
    });
  }
  return Array.from(new Set(pool)).sort(function (a, b) {
    return a - b;
  });
}

function convergeOrder(length, index) {
  const position = index % length;
  const pair = Math.floor(position / 2);
  return position % 2 === 0 ? pair : length - 1 - pair;
}

export function arpSemitone(chordTones, pattern, index, octaves, eqValue, rng) {
  const pool = buildPool(chordTones, octaves);
  const n = pool.length;
  if (n === 1) {
    return pool[0];
  }

  switch (pattern) {
    case "down":
      return pool[n - 1 - (index % n)];
    case "upDown": {
      const period = n * 2 - 2;
      const position = index % period;
      return pool[position < n ? position : period - position];
    }
    case "converge":
      return pool[convergeOrder(n, index)];
    case "random":
      return pool[Math.floor(rng() * n)];
    case "fractal":
      return pool[Math.min(n - 1, Math.floor(eqValue * n))];
    default:
      return pool[index % n];
  }
}
