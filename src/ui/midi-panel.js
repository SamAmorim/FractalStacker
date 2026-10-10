import { DEFAULT_MIDI_CONTROL_MAP, PAD_BPM_PRESETS } from "../config/midi-defaults.js";
import { state } from "../core/state.js";
import {
  MODE_OPTIONS,
  listBindings,
  removeBinding,
  setBindingMode
} from "../midi/bindings.js";
import { collectMappedControlIds, getControlDisplayValue } from "../midi/learn.js";
import {
  exportMidiMapsFile,
  importMidiMapsFromText,
  persistMidiMaps
} from "../midi/storage.js";
import { refreshPadLeds } from "../midi/output.js";
import { dom } from "./dom.js";
import { appendLog } from "./log.js";
import { renderInstrumentRack } from "./instrument-rack.js";
import { refreshEngineStatus } from "./status.js";

function optionHtml(value, label, selected) {
  return "<option value=\"" + value + "\"" + (selected ? " selected" : "") + ">" + label + "</option>";
}

export function syncMidiDeviceSelects() {
  const inputSelect = dom.midiInputSelect;
  const outputSelect = dom.midiOutputSelect;
  const channelSelect = dom.midiChannelSelect;

  if (inputSelect) {
    const current = state.midi.selectedInputId || "all";
    let html = optionHtml("all", "Todos os inputs", current === "all");
    if (state.midi.access) {
      state.midi.access.inputs.forEach(function (input) {
        html += optionHtml(input.id, input.name || input.id, current === input.id);
      });
    }
    inputSelect.innerHTML = html;
    inputSelect.disabled = !state.midi.connected;
  }

  if (outputSelect) {
    const currentOut = state.midi.selectedOutputId || "none";
    let html = optionHtml("none", "Sem MIDI Out", currentOut === "none");
    if (state.midi.access) {
      state.midi.access.outputs.forEach(function (output) {
        html += optionHtml(output.id, output.name || output.id, currentOut === output.id);
      });
    }
    outputSelect.innerHTML = html;
    outputSelect.disabled = !state.midi.connected;
  }

  if (channelSelect) {
    const currentCh = Number(state.midi.channelFilter);
    let html = optionHtml("-1", "Omni (todos)", currentCh < 0);
    for (let ch = 0; ch < 16; ch += 1) {
      html += optionHtml(String(ch), "Ch " + (ch + 1), currentCh === ch);
    }
    channelSelect.innerHTML = html;
  }

  syncMidiToggles();
}

function syncMidiToggles() {
  if (dom.midiDefaultMapToggle) {
    dom.midiDefaultMapToggle.checked = Boolean(state.midi.defaultMapEnabled);
  }
  if (dom.midiFactoryToggle) {
    dom.midiFactoryToggle.checked = Boolean(state.midi.factoryPresetsEnabled);
  }
  if (dom.midiClockToggle) {
    dom.midiClockToggle.checked = Boolean(state.midi.clockSyncEnabled);
  }
  if (dom.midiEmbedToggle) {
    dom.midiEmbedToggle.checked = Boolean(state.midi.embedInScenes);
  }
  if (dom.midiLedToggle) {
    dom.midiLedToggle.checked = Boolean(state.midi.ledFeedback);
  }
}

function renderBindingsList() {
  if (!dom.midiBindingsList) {
    return;
  }

  const rows = listBindings();
  if (!rows.length) {
    dom.midiBindingsList.innerHTML = "<p class=\"midi-empty\">Nenhum mapeamento custom. Use MIDI Learn ou Assign Pad.</p>";
    return;
  }

  dom.midiBindingsList.innerHTML = rows.map(function (row) {
    const modeOptions = MODE_OPTIONS.map(function (mode) {
      return optionHtml(mode, mode, row.mode === mode);
    }).join("");

    const modeControl = row.kind === "pad" || row.kind === "pb" || row.kind === "at"
      ? "<span class=\"midi-mode-fixed\">" + row.mode + "</span>"
      : "<select data-midi-mode=\"" + row.kind + ":" + row.code + "\">" + modeOptions + "</select>";

    return (
      "<div class=\"midi-binding-row\" data-kind=\"" + row.kind + "\" data-code=\"" + row.code + "\">" +
        "<div class=\"midi-binding-main\">" +
          "<strong>" + row.label + "</strong>" +
          "<span>→ " + row.target + "</span>" +
        "</div>" +
        "<div class=\"midi-binding-actions\">" +
          modeControl +
          "<button type=\"button\" class=\"btn-ghost midi-unbind\" data-unbind=\"" + row.kind + ":" + row.code + "\">×</button>" +
        "</div>" +
      "</div>"
    );
  }).join("");
}

function renderSummary() {
  if (!dom.midiMapStatus) {
    return;
  }

  const lines = [];
  lines.push("LEARN: " + (state.midi.learnArmed ? "ARMED → " + (state.midi.pendingTargetId || "?") : "OFF"));
  lines.push("PAD LEARN: " + (state.midi.padLearnInstrumentId ? state.midi.padLearnInstrumentId.toUpperCase() : "OFF"));
  lines.push("Last: " + (state.midi.lastMessage || "none"));
  if (state.midi.clockSyncEnabled && state.midi.clock && state.midi.clock.bpm) {
    lines.push("Clock BPM: " + state.midi.clock.bpm);
  }
  lines.push("");
  lines.push("Transport: FA/FB → Power ON · FC → OFF · F8 clock" + (state.midi.clockSyncEnabled ? " (sync ON)" : " (sync OFF)"));
  lines.push("Program Change 0–2 → Scene A/B/C" + (state.midi.factoryPresetsEnabled ? "" : " (factory OFF)"));
  lines.push("BPM pads " + Object.keys(PAD_BPM_PRESETS).join("/") +
    " · Scene recall 60–62 · save 72–74" + (state.midi.factoryPresetsEnabled ? "" : " (factory OFF)"));

  if (state.midi.defaultMapEnabled) {
    lines.push("");
    lines.push("Default CC: " + Object.keys(DEFAULT_MIDI_CONTROL_MAP).map(function (cc) {
      return "CC" + cc + "=" + DEFAULT_MIDI_CONTROL_MAP[cc];
    }).join(", "));
  }

  const mapped = collectMappedControlIds();
  if (mapped.length) {
    lines.push("");
    lines.push("Valores: " + mapped.map(function (id) {
      return id + "=" + getControlDisplayValue(id);
    }).join(" · "));
  }

  dom.midiMapStatus.textContent = lines.join("\n");
}

export function renderMidiMappingStatus() {
  syncMidiToggles();
  renderBindingsList();
  renderSummary();
}

export function bindMidiPanelControls() {
  syncMidiDeviceSelects();
  renderMidiMappingStatus();

  if (dom.midiInputSelect) {
    dom.midiInputSelect.addEventListener("change", function () {
      state.midi.selectedInputId = dom.midiInputSelect.value || "all";
      persistMidiMaps();
      appendLog("midi input -> " + state.midi.selectedInputId);
      renderMidiMappingStatus();
    });
  }

  if (dom.midiOutputSelect) {
    dom.midiOutputSelect.addEventListener("change", function () {
      state.midi.selectedOutputId = dom.midiOutputSelect.value || "none";
      persistMidiMaps();
      refreshPadLeds();
      appendLog("midi out -> " + state.midi.selectedOutputId);
    });
  }

  if (dom.midiChannelSelect) {
    dom.midiChannelSelect.addEventListener("change", function () {
      state.midi.channelFilter = Number(dom.midiChannelSelect.value);
      persistMidiMaps();
      appendLog("midi channel filter -> " + (state.midi.channelFilter < 0 ? "omni" : state.midi.channelFilter + 1));
      renderMidiMappingStatus();
    });
  }

  const toggles = [
    [dom.midiDefaultMapToggle, "defaultMapEnabled", "default CC map"],
    [dom.midiFactoryToggle, "factoryPresetsEnabled", "factory note presets"],
    [dom.midiClockToggle, "clockSyncEnabled", "MIDI clock sync"],
    [dom.midiEmbedToggle, "embedInScenes", "embed maps in scenes"],
    [dom.midiLedToggle, "ledFeedback", "pad LED feedback"]
  ];

  toggles.forEach(function (entry) {
    const el = entry[0];
    const key = entry[1];
    const label = entry[2];
    if (!el) {
      return;
    }
    el.addEventListener("change", function () {
      state.midi[key] = el.checked;
      persistMidiMaps();
      if (key === "ledFeedback") {
        refreshPadLeds();
      }
      appendLog("midi " + label + " -> " + (el.checked ? "ON" : "OFF"));
      renderMidiMappingStatus();
      refreshEngineStatus();
    });
  });

  if (dom.midiExportBtn) {
    dom.midiExportBtn.addEventListener("click", function () {
      exportMidiMapsFile();
      appendLog("midi maps exported");
    });
  }

  if (dom.midiImportBtn && dom.midiImportFile) {
    dom.midiImportBtn.addEventListener("click", function () {
      dom.midiImportFile.click();
    });
    dom.midiImportFile.addEventListener("change", function () {
      const file = dom.midiImportFile.files && dom.midiImportFile.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        try {
          importMidiMapsFromText(String(reader.result || ""));
          renderInstrumentRack();
          syncMidiDeviceSelects();
          renderMidiMappingStatus();
          refreshPadLeds();
          appendLog("midi maps imported from " + file.name);
        } catch (error) {
          appendLog("midi import error: " + error.message);
        }
        dom.midiImportFile.value = "";
      };
      reader.readAsText(file);
    });
  }

  if (dom.midiBindingsList) {
    dom.midiBindingsList.addEventListener("click", function (event) {
      const button = event.target.closest("[data-unbind]");
      if (!button) {
        return;
      }
      const parts = button.getAttribute("data-unbind").split(":");
      const kind = parts[0];
      const code = parts.slice(1).join(":");
      removeBinding(kind, code);
      renderInstrumentRack();
      renderMidiMappingStatus();
      refreshPadLeds();
      appendLog("midi unbind " + kind + ":" + code);
    });

    dom.midiBindingsList.addEventListener("change", function (event) {
      const select = event.target.closest("[data-midi-mode]");
      if (!select) {
        return;
      }
      const parts = select.getAttribute("data-midi-mode").split(":");
      const kind = parts[0];
      const code = parts.slice(1).join(":");
      setBindingMode(kind, code, select.value);
      appendLog("midi mode " + kind + ":" + code + " -> " + select.value);
      renderMidiMappingStatus();
    });
  }
}
