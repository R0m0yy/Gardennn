# Progress

## Latest working state (2026-11-13)

Milestone 1 is playable: explore → design → build → carry/launch → fly → crash or land → read the report →
modify → repeat, with saving. `npm test` passes 16/16; see `QA_REPORT.md` for the browser test and for what
has not been verified (notably real-GPU performance, audio by ear, touch).

## Important decisions

- **Engine**: neither Unity nor Godot (nor Blender) was available in the build environment. The game is a
  WebGL application on three.js r170 with zero build step, which could be run and tested headlessly here and
  plays in any modern browser. Trade-off: no editor, no authored assets; everything is procedural.
- **Physics first**: one panel-method flight model for every aircraft, in real units at true miniature scale,
  shown at 0.4× time.
- **Pure simulation core** (`src/sim/`) with no rendering imports, so it is unit-tested in Node.

## Remaining tasks (highest value first)

1. Play it on real hardware; tune handling, camera and assist by feel; measure frame times per preset.
2. Touch layout pass for phones (HUD density, workshop panels).
3. Drag-to-place editing in the workshop; asymmetric parts.
4. Play-test Journey steps 4–8 and the 1894/1917 trials for difficulty.
5. Visual density near the workshop (authored props, better ground cover) toward the concept art.
6. Then Milestone 2 onward per `DEVELOPMENT_ROADMAP.md`.

## Commands

```bash
npm start                 # play at http://localhost:8080  (add ?q=low|medium|high)
npm test                  # physics/data tests
npm run e2e               # browser test (Playwright + Chromium must be resolvable by Node)
npm run build             # self-contained static copy in dist/ (no import map) for any static host
node tools/dev/scen.mjs scout_1917 1          # scripted flight trace in the terminal (template, assist)
node tools/dev/dbg.mjs 1 1.5                  # trace a historical trial inside the real game
node tools/dev/shots.mjs docs/screenshots     # re-render documentation screenshots
```

## Where to change things

- New aircraft: add a blueprint to `TEMPLATES` in `src/sim/blueprint.js`.
- New material / engine / wing section: add a row in `src/sim/catalog.js` (and unlock it in `missions.js`).
- Handling and assist: `Aircraft._step` in `src/sim/flightModel.js`.
- World layout: `WORLD` in `src/sim/world.js`; scenery in `src/world/`.
