# QA Report: Milestone 1

Date: 2026-11-13. Environment: Linux container, Node 22, headless Chromium with **software WebGL
(SwiftShader)**. No GPU, no display, no audio device, no physical input devices.

## 1. What was executed

### 1.1 Headless physics and data tests: `npm test` → 16 passed, 0 failed

These run the exact simulation modules the game uses.

| Test | Verifies |
|---|---|
| every template builds | six aircraft build, analyse to finite values, are directionally stable |
| aircraft are mechanically distinct | racer stalls >1.5× faster than the scout; scout >1.5× the Flyer's top speed; Flyer is pitch-unstable and marginally powered |
| cardboard is not steel | steel copy is >2.5× heavier, stalls >1.4× faster, is stronger, and stays airborne far less long |
| wing geometry | smaller span raises stall speed and shortens the glide; longer span lowers stall speed and weakens the wing |
| mass and balance | moving ballast aft makes the margin negative, raises the "tail-heavy" warning, and the aircraft pitches up/stalls and flies far less distance |
| controls | stick back raises the nose, stick right rolls right, right rudder yaws right |
| stall | full back-stick without assistance stalls the wing and lift falls well below weight |
| assist | the same abuse with Accessible Flight stalls less than half as often |
| powered take-off | scout and racer climb away; the Flyer leaves the rail later and climbs far less; a rubber motor runs out and cannot be throttled; an electric motor follows the throttle |
| rotary asymmetry | hands-off at full power the scout rolls against its propeller |
| landing / crash / repair | a gentle arrival leaves 100% condition; a dive into the ground destroys the airframe and lists damage; repair restores everything |
| damaged wing | a 75%-damaged wing half rolls the aircraft |
| structure | a long paper wing rated under 2 g folds in a pull-out and raises a structure event |
| weather | rain adds >20% mass to cardboard and none to aluminium; head/tail wind shorten/lengthen ground distance |
| blueprints | JSON round-trip preserves mass; junk is rejected; out-of-range values are clamped; missing essentials restored |
| world | physics reads the terrain mesh grid; surfaces, colliders, wind shelter, fence draft, hoop detection, unlock tables |

### 1.2 Browser end-to-end test: `npm run e2e` → 20 checks passed, 0 failed

Drives the real page (low quality preset, 960×720) frame by frame through injected keyboard state and real
DOM clicks.

| Check | Player-facing behaviour |
|---|---|
| walk | WASD moves the inventor |
| workshop | changing wing material changes the mass read-out; undo restores it; read-outs and warnings render |
| build → fly → report | "Build prototype" rolls out the glider; hill catapult launch; glide of about 11 m; report with replay track; journal entry; blueprint saved |
| powered flight | the scout takes off from the runway under keyboard control |
| menu / settings | three mode cards; settings dialog changes the flight model |
| Journey | first objective shown; no engines unlocked at start; steps 1–3 complete via bench, build, and a carried prototype mounted on the hill and flown |
| rain | ground wetness rises, raindrops render, cardboard absorbs water in flight |
| 1903 trial | trial menu button sets up the Flyer on the rail in a headwind; it leaves the rail under its own power |
| persistence | progress, blueprints, journal and the prototype survive a reload |
| corruption | a truncated save is set aside and the game still boots |
| errors | zero console errors or uncaught exceptions throughout |

### 1.3 Visual inspection

Screenshots were rendered through the game (`docs/screenshots/`) and inspected for: menu, exploration view,
workshop hut, design bench, catapult, glide, flight report, powered flight. Defects found and fixed during
development: stray "null" hint text, oversized planks, bright oversized pebbles, lagging chase camera,
low-poly backdrop, over-strong lens blur.

## 2. Defects found by testing and fixed

- Propellers larger than the gear could clear (instant prop strike) → propeller sizes corrected; a workshop
  warning now flags propellers that reach below the gear.
- Light airframes chattered forever on the ground, so flights never ended → softer wingtip contacts, ground
  scrubbing of rotation, wider rest threshold.
- Hauling the scout off below flying speed caused a wing-drop crash even with assistance → low-speed and
  tail-lift protection in the co-pilot; aileron throw reduced to stop aileron-induced tip stall.
- The pitch-unstable Flyer could not be rotated or was over-rotated → larger cambered foreplane; in
  Accessible Flight the stick commands angle of attack on unstable designs.
- The garden was too short for the Flyer's flat climb → enlarged to 44 m square.
- Propwash on the tail made the scout pitch up violently with power → propwash halved.
- Stalls were being counted while sliding on the ground → only counted airborne above 1 m/s.

## 3. Not verified (be sceptical here)

| Area | Why | Risk |
|---|---|---|
| **Frame rate and performance on real hardware** | Only software rendering was available, at several seconds per frame. No frame times, memory or GPU cost were measured. | Unknown. `high` may be too heavy for integrated GPUs; `low` is the default on touch devices as a precaution. |
| **Feel of real-time control** | Tests step the simulation; nobody has flown it by hand at 60 fps. Tuning (assist gains, camera, speeds) is from simulated inputs. | Handling may feel too twitchy or too tame. |
| **Audio** | No audio device. The WebAudio graph was created without errors; nothing was heard. | Levels and timbres are untested by ear. |
| **Touch controls and gamepad** | Code paths exist; no touch or gamepad device was available. Layout at phone width was not screenshot-tested. | Likely rough on phones. |
| **Safari / Firefox** | Only Chromium was run. | Low to medium. |
| **Medium/high quality paths** | Screenshots were rendered at medium (bloom + lens pass) without errors; high was not rendered. | Low. |
| **Trials 1894 and 1917 end-to-end**, Journey steps 4–8 | Mechanics are covered piecewise (hoop detection, scoring functions, powered flight) but these were not played to completion by the automated test. | Medium: goals may be too hard or too easy. |
| **Long sessions** | No soak test for leaks. | Unknown. |

## 4. Known limitations

- Visual fidelity is well below the concept art: all geometry and textures are procedural.
- Only the six listed aircraft are tuned; arbitrary inventions are simulated consistently but can be numerically
  lively at extreme proportions (very small inertia, very large control surfaces).
- Collision for aircraft uses about a dozen sample points; a wing can pass through a thin stem between them.
- Insects do not collide with the player or parked aircraft (bees do damage aircraft in flight).
- The pond has buoyancy and drag but no boats. The fortress, trenches, cannon and trebuchet are scenery.
- One prototype exists in the world at a time.
