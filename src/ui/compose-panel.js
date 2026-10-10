import { reharmonize } from "../composition/harmony.js";
import { STYLE_PRESETS } from "../config/styles.js";
import { state } from "../core/state.js";
import { bindRangeControl, setControlValue } from "./controls.js";
import { dom } from "./dom.js";
import { appendLog } from "./log.js";
import { refreshEngineStatus } from "./status.js";

let lastProgressionKey = "";
let progressionPowerBound = false;

export function applyStylePreset(styleKey) {
  const preset = STYLE_PRESETS[styleKey];
  if (!preset) {
    return;
  }
  const params = preset.params || preset;
  state.music.style = styleKey;
  setControlValue("harmonicRhythm", params.harmonicRhythm);
  setControlValue("complexity", params.complexity);
  setControlValue("humanize", params.humanize);
  setControlValue("motifMemory", params.motifMemory);
  setControlValue("sidechain", params.sidechain);
  setControlValue("arpPattern", params.arpPattern);
  setControlValue("arpRate", params.arpRate);
  setControlValue("arpOctaves", params.arpOctaves);
  lastProgressionKey = "";
}

export function bindComposeControls() {
  const music = state.music;

  bindRangeControl("harmonicRhythm", "harmonicRhythmVal", function (value) {
    return value.toFixed(0) + " comp.";
  }, function (value) {
    music.harmonicRhythm = value;
  });
  bindRangeControl("complexity", "complexityVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    music.complexity = value;
  });
  bindRangeControl("energy", "energyVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    music.energy = value;
  });
  bindRangeControl("motifMemory", "motifMemoryVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    music.motifMemory = value;
  });
  bindRangeControl("humanize", "humanizeVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    music.humanize = value;
  });
  bindRangeControl("sidechain", "sidechainVal", function (value) {
    return value.toFixed(2);
  }, function (value) {
    music.sidechain = value;
  });
  bindRangeControl("arpOctaves", "arpOctavesVal", function (value) {
    return value.toFixed(0);
  }, function (value) {
    music.arpOctaves = value;
  });

  const styleSelect = document.getElementById("styleSelect");
  styleSelect.value = music.style;
  styleSelect.addEventListener("change", function (event) {
    applyStylePreset(event.target.value);
    appendLog("estilo -> " + STYLE_PRESETS[music.style].label);
    refreshEngineStatus();
  });

  const autoForm = document.getElementById("autoForm");
  autoForm.checked = music.autoForm;
  autoForm.addEventListener("change", function (event) {
    music.autoForm = event.target.checked;
  });

  document.getElementById("arpPattern").addEventListener("change", function (event) {
    music.arpPattern = event.target.value;
  });
  document.getElementById("arpRate").addEventListener("change", function (event) {
    music.arpRate = Number(event.target.value);
  });

  dom.reharmonizeBtn.addEventListener("click", function () {
    reharmonize();
    lastProgressionKey = "";
    appendLog("nova semente " + music.seed + " -> progressao e motivo regenerados no proximo compasso");
  });

  if (dom.progressionChords && !progressionPowerBound) {
    progressionPowerBound = true;
    dom.progressionChords.addEventListener("click", function (event) {
      const powerChip = event.target.closest("[data-power-on]");
      if (!powerChip || state.powered || !dom.powerBtn) {
        return;
      }
      dom.powerBtn.click();
    });
  }
}

export function renderProgression() {
  const compose = state.compose;
  const energyPct = Math.round(compose.energy * 100);
  const progression = compose.progression || [];
  const activeIndex = progression.indexOf(compose.chord);
  const key = [state.powered, compose.section, energyPct, activeIndex, progression.map(function (chord) {
    return chord.name;
  }).join(",")].join("|");
  if (key === lastProgressionKey || !dom.progressionChords) {
    return;
  }
  lastProgressionKey = key;

  dom.sectionName.textContent = compose.section + " | frase " + (compose.phraseIndex + 1);
  dom.energyReadout.textContent = "energia " + energyPct + "%";
  dom.energyFill.style.width = energyPct + "%";

  if (!state.powered) {
    dom.progressionChords.innerHTML =
      "<button type=\"button\" class=\"chord-chip idle power-chip\" data-power-on>Power On</button>";
  } else if (!progression.length || !compose.chord) {
    dom.progressionChords.innerHTML = "<span class=\"chord-chip idle\">" +
      (STYLE_PRESETS[state.music.style].legacy ? "motor classico" : "escala atonal: livre") + "</span>";
  } else {
    dom.progressionChords.innerHTML = progression.map(function (chord, index) {
      const className = "chord-chip" + (index === activeIndex ? " active" : index < activeIndex ? " past" : "");
      return "<span class=\"" + className + "\">" + chord.name + "</span>";
    }).join("");
  }
}
