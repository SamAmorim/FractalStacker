import fs from "fs";

const path = new URL("../index.html", import.meta.url);
let html = fs.readFileSync(path, "utf8");

// --- Topbar reformulation ---
html = html.replace(
  /<header class="topbar header">[\s\S]*?<\/header>/,
  `<header class="topbar header">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">&phi;</span>
      <div>
        <h1 class="title">Fractal<span class="sep">//</span>Live<span class="cursor" aria-hidden="true">_</span></h1>
        <p class="subtitle">synth studio · carputer twin</p>
      </div>
    </div>

    <div class="header-actions transport-cluster">
      <button id="powerBtn" class="led-btn btn-power" type="button" aria-pressed="false">Power On</button>
      <button id="graphFocusBtn" class="led-btn btn-demo" type="button" aria-pressed="false">Modo Demo</button>
      <span class="action-divider" aria-hidden="true"></span>
      <button id="midiBtn" class="led-btn" type="button" aria-pressed="false">MIDI: Disconnected</button>
      <button id="midiLearnBtn" class="led-btn" type="button" aria-pressed="false">Learn</button>
      <button id="midiClearBtn" class="btn-ghost" type="button">Clear Map</button>
      <span class="action-divider" aria-hidden="true"></span>
      <label class="theme-picker">
        <span>tema</span>
        <select data-theme-picker>
          <option value="phosphor">Phosphor CRT</option>
          <option value="amber">Amber CRT</option>
          <option value="dos">DOS Blue</option>
          <option value="dracula">Dracula</option>
          <option value="monokai">Monokai</option>
          <option value="solarized-dark">Solarized Dark</option>
          <option value="solarized-light">Solarized Light</option>
          <option value="nord">Nord</option>
          <option value="gruvbox">Gruvbox</option>
          <option value="one-dark">One Dark</option>
          <option value="tokyo-night">Tokyo Night</option>
        </select>
      </label>
    </div>

    <p class="engine-status" id="engineStatus" role="status">Audio engine idle</p>
  </header>`
);

function extractSection(source, id) {
  const marker = `id="${id}"`;
  const idAt = source.indexOf(marker);
  if (idAt < 0) {
    throw new Error("Missing section #" + id);
  }
  const start = source.lastIndexOf("<section", idAt);
  if (start < 0) {
    throw new Error("Missing <section for #" + id);
  }
  let depth = 0;
  let i = start;
  while (i < source.length) {
    if (source.startsWith("</section>", i)) {
      depth -= 1;
      i += 10;
      if (depth === 0) {
        return source.slice(start, i);
      }
      continue;
    }
    if (source.startsWith("<section", i)) {
      depth += 1;
      i += 8;
      continue;
    }
    i += 1;
  }
  throw new Error("Unclosed section #" + id);
}

const global = extractSection(html, "global");
const compose = extractSection(html, "compose");
const envelope = extractSection(html, "envelope");
const scenes = extractSection(html, "scenes");
const fx = extractSection(html, "fx");

const globalNext = global
  .replace('<span class="idx">01</span>Global Context', '<span class="idx">01</span>Global')
  .replace('id="global"', 'id="global" data-zone="sound"');

const composeNext = compose
  .replace('<span class="idx">02</span>Composicao', '<span class="idx">02</span>Compose')
  .replace('id="compose"', 'id="compose" data-zone="music"');

const scenesNext = scenes
  .replace('<span class="idx">04</span>Scene Morph', '<span class="idx">03</span>Scenes')
  .replace('id="scenes"', 'id="scenes" data-zone="live"');

const envelopeNext = envelope
  .replace('<span class="idx">03</span>Envelope ADSR', '<span class="idx">04</span>Voice · ADSR')
  .replace('id="envelope"', 'id="envelope" data-zone="voice"');

const fxNext = fx
  .replace('<span class="idx">05</span>Master Bus FX', '<span class="idx">05</span>Master FX')
  .replace('id="fx"', 'id="fx" data-zone="fx"')
  .replace(
    'style="margin-top:10px"',
    'class="fx-recall-row"'
  );

const sidebarInner = `
      <nav class="studio-nav" aria-label="Secoes do studio">
        <a href="#visualizer">Stage</a>
        <a href="#global">Global</a>
        <a href="#compose">Compose</a>
        <a href="#scenes">Scenes</a>
        <a href="#envelope">Voice</a>
        <a href="#fx">FX</a>
        <a href="#rack">Rack</a>
        <a href="#equations">Equations</a>
        <a href="#lab">Lab</a>
      </nav>

      <div class="sidebar-zone" data-zone-label="Som">
        ${globalNext}
      </div>
      <div class="sidebar-zone" data-zone-label="Musica">
        ${composeNext}
        ${scenesNext}
      </div>
      <div class="sidebar-zone" data-zone-label="Timbre">
        ${envelopeNext}
        ${fxNext}
      </div>
`;

html = html.replace(
  /<aside class="sidebar" aria-label="Controles globais">[\s\S]*?<\/aside>/,
  `<aside class="sidebar" aria-label="Controles do studio">
${sidebarInner}
    </aside>`
);

// Extract workspace panels
const visualizer = extractSection(html, "visualizer");
const rack = extractSection(html, "rack");
const equations = extractSection(html, "equations");

// Pull log-grid out of visualizer into lab
const logMatch = visualizer.match(/<div class="log-grid">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/);
if (!logMatch) {
  // try simpler
}

function extractDivByClass(source, className) {
  const openTag = `<div class="${className}">`;
  const start = source.indexOf(openTag);
  if (start < 0) {
    return null;
  }
  let depth = 0;
  let i = start;
  while (i < source.length) {
    if (source.startsWith("</div>", i)) {
      depth -= 1;
      i += 6;
      if (depth === 0) {
        return { block: source.slice(start, i), start: start, end: i };
      }
      continue;
    }
    if (source.startsWith("<div", i)) {
      depth += 1;
      i += 4;
      continue;
    }
    i += 1;
  }
  return null;
}

let visualizerBody = visualizer;
const logExtract = extractDivByClass(visualizerBody, "log-grid");
if (!logExtract) {
  throw new Error("log-grid not found in visualizer");
}
const logGrid = logExtract.block;
visualizerBody = visualizerBody.slice(0, logExtract.start) + visualizerBody.slice(logExtract.end);

visualizerBody = visualizerBody
  .replace(
    '<h2 class="panel-title"><span class="idx">06</span>Live Result Visualizer</h2>',
    `<div class="stage-head">
          <h2 class="panel-title"><span class="idx">01</span>Stage</h2>
          <p class="panel-hint stage-hint">HUD + graficos ao vivo. Use <kbd>G</kbd> para Modo Demo (gravação).</p>
        </div>`
  )
  .replace('id="visualizer"', 'id="visualizer" data-zone="stage"')
  .replace(
    '<div class="graph-toolbar">',
    `<details class="stage-tools">
          <summary>Plot tools</summary>
          <div class="graph-toolbar">`
  )
  .replace(
    "</div>\n\n        <section class=\"performance-hud\"",
    `</div>
        </details>

        <section class="performance-hud"`
  );

// Fix the details close - the replace for graph-toolbar closing might be wrong.
// Re-read: after first tool groups end there's `</div>` then performance-hud.
// I wrapped opening - need to close details before performance-hud.

if (!visualizerBody.includes("</details>")) {
  visualizerBody = visualizerBody.replace(
    /<\/div>\s*\n\s*<section class="performance-hud"/,
    `</div>\n        </details>\n\n        <section class="performance-hud"`
  );
}

const rackNext = rack
  .replace('<span class="idx">07</span>Instrument Stack', '<span class="idx">02</span>Instrument Rack')
  .replace('id="rack"', 'id="rack" data-zone="rack"');

const equationsNext = equations
  .replace('<span class="idx">08</span>Equation Engine', '<span class="idx">03</span>Equations')
  .replace('id="equations"', 'id="equations" data-zone="equations"');

const lab = `
      <section class="panel lab-panel" id="lab" data-zone="lab">
        <h2 class="panel-title"><span class="idx">04</span>Lab · MIDI & Log</h2>
        <p class="panel-hint">Mapeamentos MIDI, device e event log. No Modo Demo estes painéis ficam ocultos (tecla <kbd>D</kbd> revela tech overlay).</p>
        ${logGrid}
      </section>`;

const workflow = `
      <section class="panel workflow-panel" id="workflow" data-zone="guide">
        <h2 class="panel-title"><span class="idx">·</span>Fluxo</h2>
        <ol class="workflow-grid">
          <li class="workflow-step">
            <span class="workflow-num">01</span>
            <h3>Stage</h3>
            <p>Power, Demo, leia o HUD e os graficos.</p>
          </li>
          <li class="workflow-step">
            <span class="workflow-num">02</span>
            <h3>Rack</h3>
            <p>Esculpa camadas, pads MIDI e FX insert.</p>
          </li>
          <li class="workflow-step">
            <span class="workflow-num">03</span>
            <h3>Compose</h3>
            <p>Estilo, cenas e morph ao vivo.</p>
          </li>
          <li class="workflow-step">
            <span class="workflow-num">04</span>
            <h3>Demo</h3>
            <p>Modo Demo para apresentações e gravações.</p>
          </li>
        </ol>
      </section>`;

html = html.replace(
  /<div class="workspace">[\s\S]*?<\/div>\s*<\/main>/,
  `<div class="workspace">
${visualizerBody}

${rackNext}

${equationsNext}

${lab}

${workflow}
    </div>
  </main>`
);

// Remove old floating graphFocusBtn (now in topbar)
html = html.replace(
  /\s*<button id="graphFocusBtn" class="graph-focus-btn led-btn" type="button">Modo Graficos<\/button>\s*/,
  "\n\n  "
);

// Demo chrome overlay
html = html.replace(
  /<script type="module" src="src\/main.js"><\/script>/,
  `<div class="demo-chrome" id="demoChrome" hidden>
    <div class="demo-chrome-brand"><span aria-hidden="true">&phi;</span> Fractal // Live</div>
    <div class="demo-chrome-meta" id="demoChromeMeta">DEMO</div>
    <div class="demo-chrome-actions">
      <button type="button" class="btn-ghost" id="demoTechToggle" aria-pressed="false">Tech</button>
      <button type="button" class="led-btn" id="demoExitBtn">Studio</button>
    </div>
  </div>

  <script type="module" src="src/main.js"></script>`
);

fs.writeFileSync(path, html);
console.log("reorg complete", html.length);
