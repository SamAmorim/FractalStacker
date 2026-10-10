import { audio } from "./audio/engine.js";
import { setMidiLearnArmed, tagMappableControls } from "./midi/learn.js";
import { loadMidiMaps } from "./midi/storage.js";
import { loadScenes } from "./scenes/scenes.js";
import { stopScheduler } from "./sequencer/scheduler.js";
import { bindComposeControls } from "./ui/compose-panel.js";
import { bindFxControls, bindGlobalControls } from "./ui/controls.js";
import {
  renderEquationLibrary,
  renderEquationLiveInspector,
  renderEquationMonitor
} from "./ui/equation-panel.js";
import { renderPerformanceHud } from "./ui/hud.js";
import { renderInstrumentRack } from "./ui/instrument-rack.js";
import { appendLog } from "./ui/log.js";
import { bindMidiPanelControls, renderMidiMappingStatus } from "./ui/midi-panel.js";
import { bindGraphControls } from "./ui/plot-target.js";
import { bindRangeFills } from "./ui/range-fill.js";
import { bindSceneControls } from "./ui/scenes-panel.js";
import { refreshEngineStatus } from "./ui/status.js";
import { bindStudioNav } from "./ui/studio-nav.js";
import { bindThemePicker } from "./ui/theme.js";
import { bindButtons, setGraphsOnlyMode } from "./ui/transport.js";
import { drawVisualizer } from "./visuals/activity.js";
import { bindDemoSlides } from "./visuals/demo-slides.js";

function init() {
  bindThemePicker();
  const midiLoaded = loadMidiMaps();
  renderEquationLibrary();
  renderInstrumentRack();
  bindGlobalControls();
  bindComposeControls();
  bindFxControls();
  bindGraphControls();
  bindSceneControls();
  bindDemoSlides();
  bindButtons();
  bindStudioNav();
  bindMidiPanelControls();
  tagMappableControls();
  loadScenes();
  setMidiLearnArmed(false);
  setGraphsOnlyMode(false, true);
  renderEquationMonitor();
  renderEquationLiveInspector();
  renderMidiMappingStatus();
  renderPerformanceHud();
  refreshEngineStatus();
  appendLog("digital twin ready");
  appendLog("power on to start scheduler + synth stack");
  appendLog("studio: Stage → Rack → Compose/Scenes → FX · Demo com G · Tech com D");
  if (midiLoaded) {
    appendLog("midi maps restored from localStorage");
  }
  bindRangeFills();
  drawVisualizer();
}

window.addEventListener("beforeunload", function () {
  stopScheduler();
  if (audio.ctx && audio.ctx.state !== "closed") {
    audio.ctx.close();
  }
});

init();
