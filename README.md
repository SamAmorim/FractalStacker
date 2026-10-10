# FractalStacker

Fractal Live Synth Studio — digital twin para carputer. Sintetizador generativo em
Web Audio + Web MIDI, sem build e sem dependências.

## Rodando

O código usa ES modules nativos, então **não abre via `file://`**. Precisa de um servidor HTTP:

```bash
npm start            # http://127.0.0.1:5173
PORT=8080 HOST=0.0.0.0 npm start   # expor na rede (ex.: tablet do carro)
npm run check        # valida sintaxe e se todo import aponta para um export existente
```

Qualquer outro servidor estático também serve (`python -m http.server`, Live Server etc.).

## Arquitetura

```
index.html            só markup; carrega styles/*.css e src/main.js
src/
  main.js             ponto de entrada: init() e wiring geral
  config/             dados puros, sem lógica (constantes, escalas, instrumentos, MIDI map padrão)
  core/               state global, matemática, utilitários de tempo
  algorithms/
    equations/        uma equação geradora por arquivo + index.js (registro EQUATIONS)
    equation-runtime  avalia a equação de cada instrumento por step
    harmonics         geração de timbres (PeriodicWave)
  theory/             notas, microtonalidade, série dodecafônica
  composition/        a "mente musical" (sem áudio, sem DOM — testável no Node)
    harmony           progressão funcional (Markov por movimento de fundamental), cadências, nomes de acordes
    form              frases de 8 compassos, seções Respiro/Desenvolvimento/Ápice/Retorno, curva de energia
    voicing           condução de vozes (inversão/drop-2 com menor movimento)
    motif             motivo de 2 compassos + desenvolvimento (repetição, inversão, retrógrado, sequência...)
    groove            gramática de bateria euclidiana por camada, ghost notes, viradas
  sequencer/
    scheduler         lookahead + contexto musical por step, humanize, sidechain
    players/          um "músico" por papel: drums, bass, pad, lead, arp, texture
    arpeggiator       padrões sobe/desce/converge/aleatório/fractal
    trigger, pitch    motor clássico (estilo "Fractal livre" e escalas atonais)
  audio/              AudioContext, buses (com ducking), envelopes, drive, osciladores, vozes por prioridade
  synths/             um motor por arquivo (drums, bass, pad, keys FM, pluck, noise) + registro
  effects/            wah, delay, reverb e fx-chain (roteamento bypass/process)
  scenes/             cenas A/B, morph e quantização
  midi/               entrada Web MIDI e MIDI learn
  monitor/            análise espectral / clip / tempo para o HUD
  ui/                 painéis e controles DOM, tema, log, status, transporte
  visuals/            canvases: channel rack, plano cartesiano, espiral phi, atividade
styles/
  themes.css          paletas (variáveis CSS por [data-theme])
  base.css, controls.css
  layout/             topbar, shell, footer
  components/         um arquivo por painel
  modes/              modo gráficos
  responsive.css      breakpoints (sempre por último)
scripts/              servidor de dev e checagem
```

Dependências fluem de cima para baixo: `config` → `core` → `algorithms`/`theory` → `composition` →
`sequencer`/`audio`/`synths`/`effects` → `ui`/`visuals` → `main.js`. `config/` não importa nada.

## Como a música é gerada

A cada compasso, `composition/form` decide seção e energia, e `composition/harmony` escolhe o acorde
(progressões são planejadas por frase, com cadência no último acorde e retorno do tema A após o ápice B).
A cada step, o scheduler monta um contexto (métrica, acorde, energia, fim de frase) e cada instrumento
toca segundo seu **papel** (`role` em `config/instruments.js`):

| papel   | o que faz |
|---------|-----------|
| drums   | camadas euclidianas (kick/snare/rim/hats) ativadas pela energia; viradas e prato na troca de seção |
| bass    | fundamental no tempo forte, quinta/oitava nos fracos, nota de aproximação antes da troca, glide |
| pad     | acorde inteiro com condução de vozes, sustentado até a próxima troca |
| lead    | motivo temático desenvolvido a cada 2 compassos; notas fortes caem em notas do acorde |
| arp     | arpejo do acorde atual no padrão/divisão/oitavas escolhidos |
| texture | swell no fim de frase, "ar" afinado na fundamental, grãos esparsos |

As **equações continuam sendo o DNA**: definem o contorno do motivo, as pausas do arpejo, ghost notes,
escolha de notas do baixo e brilho dos timbres. `Memoria` equilibra repetição × novidade; `Nova semente`
regenera progressão e motivo. O estilo "Fractal livre" e as escalas atonais usam o motor clássico.

Para inspecionar a lógica sem navegador, os módulos de `composition/` podem ser importados direto no Node.

## Estendendo

**Nova equação** — crie `src/algorithms/equations/minha-eq.js`:

```js
export const MINHA_EQ_EQUATION = {
  name: "Minha Eq",
  formula: "x = ...",
  compute: function (ctx, inst) {
    return 0.5; // 0..1, usado como probabilidade/intensidade do step
  }
};
```

e registre em `equations/index.js`. Ela aparece automaticamente nos seletores e na biblioteca.

**Novo sintetizador** — crie `src/synths/meu-synth.js` exportando
`triggerMeuSynth(inst, when, event)` (event traz `frequency`/`frequencies`, `velocity`, `duration`,
`value`), registre em `synths/index.js` e use `engine: "meuSynth"` em `config/instruments.js`.

**Novo papel musical** — crie `src/sequencer/players/meu-papel.js` com
`playMeuPapel(inst, eq, ctx)` retornando `play([...eventos], motivo)` ou `rest(motivo)`, registre em
`players/index.js` e use `role: "meuPapel"` no instrumento.

**Novo estilo** — adicione um preset em `config/styles.js` (ritmo harmônico, groove, arpejo,
sidechain...) e uma `<option>` em `#styleSelect`.

**Novo efeito** — crie `src/effects/meu-fx.js` com `createMeuFx(ctx)` retornando
`{ input, output, ... }` e `applyMeuFx(node, fx, now, tau)`; encaixe na cadeia em
`effects/fx-chain.js` (`createFxChain` e `applyFxParams`).

**Novo tema** — adicione um bloco `[data-theme="x"]` em `styles/themes.css` com as mesmas
variáveis dos outros e uma `<option value="x">` no seletor de tema em `index.html`.
