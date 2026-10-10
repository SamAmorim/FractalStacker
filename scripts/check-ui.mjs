import fs from "fs";
const h = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ids = [
  "powerBtn",
  "graphFocusBtn",
  "visualizer",
  "lab",
  "demoChrome",
  "demoTechToggle",
  "midiPanel",
  "instrumentRack",
  "fxSpace",
  "sceneRecallFxBtn",
  "studio-nav",
  "stage-tools",
  "performanceHud",
  "equationLibrary"
];
ids.forEach((id) => {
  const count = (h.match(new RegExp(`id="${id}"`, "g")) || []).length;
  console.log(id, count === 1 ? "OK" : count === 0 ? "MISSING" : "DUP:" + count);
});
console.log("details", (h.match(/<details/g) || []).length, (h.match(/<\/details>/g) || []).length);
console.log("log-grid", (h.match(/log-grid/g) || []).length);
console.log("workflow in workspace", h.indexOf('id="workflow"') > h.indexOf('id="lab"'));
