function closedPosition(pitchClasses, rotation) {
  const rotated = pitchClasses.slice(rotation).concat(pitchClasses.slice(0, rotation));
  const voicing = [rotated[0]];
  for (let i = 1; i < rotated.length; i += 1) {
    let note = rotated[i];
    while (note <= voicing[i - 1]) {
      note += 12;
    }
    voicing.push(note);
  }
  return voicing;
}

function dropTwo(voicing) {
  if (voicing.length < 4) {
    return null;
  }
  const dropped = voicing.slice();
  dropped[dropped.length - 2] -= 12;
  return dropped.sort(function (a, b) {
    return a - b;
  });
}

function movement(candidate, previous) {
  if (!previous || !previous.length) {
    return 0;
  }
  let total = 0;
  candidate.forEach(function (note) {
    let nearest = Infinity;
    previous.forEach(function (prev) {
      nearest = Math.min(nearest, Math.abs(note - prev));
    });
    total += nearest;
  });
  return total / candidate.length;
}

export function voiceChord(chord, previous, center, maxVoices) {
  const count = Math.max(2, Math.min(maxVoices, chord.tones.length));
  const pitchClasses = chord.tones.slice(0, count).map(function (tone) {
    return ((tone % 12) + 12) % 12;
  });

  let best = null;
  let bestScore = Infinity;
  for (let rotation = 0; rotation < pitchClasses.length; rotation += 1) {
    const closed = closedPosition(pitchClasses, rotation);
    [closed, dropTwo(closed)].forEach(function (shape) {
      if (!shape) {
        return;
      }
      for (let octave = -3; octave <= 3; octave += 1) {
        const candidate = shape.map(function (note) {
          return note + octave * 12;
        });
        const mean = candidate.reduce(function (sum, note) {
          return sum + note;
        }, 0) / candidate.length;
        const score = movement(candidate, previous) * 1.6 + Math.abs(mean - center) * 0.35;
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    });
  }
  return best;
}
