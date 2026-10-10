import { audio } from "./audio/engine.js";
import { setMidiLearnArmed } from "./midi/learn.js";
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
import { renderMidiMappingStatus } from "./ui/midi-panel.js";
import { bindGraphControls } from "./ui/plot-target.js";
import { bindRangeFills } from "./ui/range-fill.js";
import { bindSceneControls } from "./ui/scenes-panel.js";
import { refreshEngineStatus } from "./ui/status.js";
import { bindThemePicker } from "./ui/theme.js";
import { bindButtons, setGraphsOnlyMode } from "./ui/transport.js";
import { drawVisualizer } from "./visuals/activity.js";

function init() {
  bindThemePicker();
  renderEquationLibrary();
  renderInstrumentRack();
  bindGlobalControls();
  bindComposeControls();
  bindFxControls();
  bindGraphControls();
  bindSceneControls();
  bindButtons();
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
  appendLog("workflow: 1 esculpir, 2 mesclar, 3 harmonizar, 4 monitorar");
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
