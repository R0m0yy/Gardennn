# EVOLUTION: Garden Wars

A miniature invention and engineering sandbox. You are one inch tall, the back garden is a continent,
and every flying machine you build is flown by real-time physics derived from the parts you chose.

**Status: Milestone 1 (flight & engineering) is playable.** Ground vehicles, combat and factions are
planned, not built. See `DEVELOPMENT_ROADMAP.md` and `QA_REPORT.md` for exactly what is and is not done.

## Requirements

- A desktop or tablet browser with WebGL 2 (Chrome, Edge, Firefox, Safari 16+).
- To run from source: Node.js 18+ (only for the tiny static file server and the tests). No build step.

## Run

```bash
npm start            # serves the folder at http://localhost:8080
```

Any static web server works (`python3 -m http.server`, GitHub Pages, …): the game is plain ES modules
plus a vendored copy of three.js r170. There is nothing to compile.

URL options: `?q=low|medium|high` forces a graphics preset.

## Controls

| On foot | |
|---|---|
| W A S D / left stick / on-screen stick | move (camera-relative) |
| Shift | run |
| Space | jump |
| C | crouch |
| E | use: design bench, wall of history, journal, your prototype |
| Mouse drag, wheel, ← → | rotate and zoom the camera |
| Tab | invention journal |
| Esc | pause; in Sandbox the pause menu sets weather, wind and time of day |

| Flying | |
|---|---|
| S / ↓ | stick back (nose up) |
| W / ↑ | stick forward (nose down) |
| A D / ← → | roll (drives the rudder on aircraft with no ailerons) |
| Q E | rudder |
| Shift / Ctrl (or R / F) | throttle up / down. Rubber and 1903 engines are on/off only |
| Space (hold, release) | draw and release the catapult on Glider Hill |
| T / G | pitch trim |
| C | chase / cockpit view |
| Enter | end the flight once stopped |
| Backspace | abandon and reset to the launch site |

Gamepads are supported (left stick, triggers for throttle, A/B/X/Y). Touch devices get an on-screen stick
and buttons.

## What you can do in this build

- Walk a detailed garden region: workshop, Glider Hill, launch rail, grass runway, pond, flowerbed, fortress.
- Design aircraft at the bench from parts: fuselage, any number of wings, tails, foreplanes, fins, engines,
  gear, ballast. Ten materials, six wing sections, seven engines. Undo/redo, duplicate, save/load, revisions,
  copy/paste blueprint codes.
- See mass, balance, stall speed, trim, glide ratio, strength and plain-language engineering warnings update
  as you edit; then build the prototype and fly it.
- Fly a cardboard glider, a paper dart, an 1894 hill glider, a 1903 canard biplane, a 1917 rotary scout and a
  1935 metal racer, or anything you invent. They share one physics model and behave very differently.
- Stall, spin, overstress and fold wings, break propellers, collapse landing gear, ditch in the pond, repair.
- Read a post-flight report with a scrubbable replay and an explanation of what happened and why.
- Three Historical Trials (1894, 1903, 1917), an eight-step Inventor's Journey, and a Free Invention Sandbox.

## Tests

```bash
npm test             # 16 headless physics/data tests (Node only)
npm run e2e          # browser end-to-end test; needs Playwright + Chromium resolvable by Node
```

## Layout

```
index.html, css/            page shell and UI styling
src/sim/                    pure simulation: catalog, blueprints, flight model, world/terrain/weather (no rendering)
src/gfx/                    procedural textures, aircraft and character model builders
src/world/                  garden, structures, sky/weather visuals, wildlife
src/game/                   player, cameras, flight sessions, missions
src/ui/                     HUD, panels, workshop editor
src/core/                   input, audio synthesis, save system
tests/                      unit tests and browser end-to-end test
vendor/                     three.js r170 (MIT) and its post-processing add-ons
```

## Licences

Game code and all generated art/audio: see repository owner. three.js is MIT (`vendor/THREE_LICENSE`).
No third-party art, models, fonts or audio are used: every texture is painted procedurally at start-up and
every sound is synthesised live.
