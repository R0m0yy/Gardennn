# Development Roadmap

## Done: Milestone 1, flight and engineering foundation

All 27 items of the "minimum complete playable milestone" are implemented. Evidence for each is in
`QA_REPORT.md`.

| # | Item | Where |
|---|---|---|
| 1 | Detailed playable garden region | `src/world/garden.js`, `structures.js` |
| 2–4 | Player character, movement, gameplay cameras | `src/game/player.js`, `cameras.js`, `src/gfx/figure.js` |
| 5–7 | Usable workshop, part placement/editing, ten materials | `src/ui/workshop.js`, `src/sim/catalog.js` |
| 8–10 | Cardboard glider, wood-and-fabric 1903 flyer, 1917 biplane (+ paper dart, 1894 glider, 1935 racer) | `src/sim/blueprint.js` |
| 11–16 | Shared flight simulation, control, take-off/launch, stable flight, stalls, landing | `src/sim/flightModel.js` |
| 17–18 | Crash damage, repair and modification | `flightModel.js`, `src/game/session.js` |
| 19 | Blueprint save/load with revisions | `src/core/save.js`, `src/main.js` |
| 20 | Wind (gusts, turbulence, shelter, slope lift, thermals) + rain, fog | `src/sim/world.js` |
| 21 | Insects with behaviour (ants, bees, ladybird, snail, butterflies) | `src/world/insects.js` |
| 22 | Historical flight challenges (three) | `src/game/missions.js` |
| 23 | Unrestricted test mode (Sandbox) | `src/main.js` |
| 24 | Flight instrumentation | `src/ui/panels.js` |
| 25 | Sound (fully synthesised) | `src/core/audio.js` |
| 26 | Menu and settings | `src/ui/panels.js` |
| 27 | Verified playable build | `npm test`, `npm run e2e` |

## Next

### Milestone 2: engineering depth
- Drag-to-place parts in 3D with snapping; asymmetric (non-mirrored) surfaces; component groups.
- Twin/multi-engine layouts with lateral offsets; folding and variable-pitch propellers; flaps.
- Per-part moisture and damage shown on the model; partial repairs that cost materials.
- Side-by-side revision comparison; overlay of two flights in the replay; a wind-tunnel station.
- Depends on: nothing new. The blueprint schema already has room (`z` offsets, `vertical`, `twin`).

### Milestone 3: historical technology
- More period aircraft (1909 monoplane, triplane, 1930s airliner, early jet) and rotorcraft, which need a
  rotor model the current panel method does not provide.
- Trials with period navigation and landing tasks; a walk-in museum.
- Depends on: Milestone 2 for multi-engine.

### Milestone 4: living garden
- More regions made playable (tree-root tunnels, pond boats and amphibians), wildlife territories, spiders,
  beetles, dragonflies; resource gathering for materials.
- Needs region streaming if the map grows beyond one grid.

### Milestone 5: warfare
- Ground vehicles (wheels vs tracks on the existing surface-friction model), projectiles, cover, damage,
  fortress attack/defence, a rival faction with patrol/investigate/attack state machines, AI pilots.
- An alternate-history sandbox mixing eras.
- Depends on: a vehicle physics module beside `flightModel.js`; the contact and damage code is reusable.

### Milestone 6: world polish
- Authored or generated high-detail meshes and textures to approach the concept art; animation polish
  (vehicle entry, tool use); cinematic camera; music; touch-first UI layout; packaged desktop builds.

## Known gaps inside Milestone 1 (candidates for a 1.1)

- The workshop edits by sliders and lists, not by dragging parts on the model.
- Boarding is a hop and a short fade, not a full climb-in animation.
- Carrying is the only manual transport; there is no cart or tow.
- No music. No colour-blind or remappable-controls options.
- Performance has not been measured on real GPUs (see QA report).
