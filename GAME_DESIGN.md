# Game Design

## Pitch

You are an inventor one inch tall. A back garden is your continent. You design flying machines from
cardboard, wood, cloth and metal, launch them off a hill of dug soil, and find out, through physics rather
than scripted outcomes, whether your idea works. History's aircraft are there to fly and to beat.

This is not a vehicle collection game. The verb is **experiment**.

## Core loop

```
        design at the bench  ──►  read the predictions  ──►  build the prototype
              ▲                                                     │
              │                                                     ▼
   change one thing  ◄──  read the flight report  ◄──  carry / launch / fly / crash
```

Every pass through the loop produces a journal entry. A failed flight is recorded with an explanation, not
discarded: learning is the reward.

## Modes (implemented)

| Mode | What it is |
|---|---|
| **Inventor's Journey** | Eight steps from a cardboard glider to a 1917 scout. Each step unlocks materials, engines or blueprints. The weather changes on its own. |
| **Free Invention Sandbox** | Everything unlocked from the first minute. Pause menu sets weather, wind direction and time of day. This doubles as the Creative Playground: there are no enemies or resource costs in this build. |
| **Historical Trials** | 1894 The Hill (glide 7 m), 1903 Twelve Seconds (stay up 12 s off the rail into a headwind), 1917 Sunflower Circuit (four hoops and a landing). Period aircraft, unmodified, bronze/silver/gold. |

Not implemented: **Garden Warfare** (Milestone 5).

## Journey steps

1. Walk to the bench. 2. Build a first glider. 3. Launch it from the hill. 4. Glide 9 m (unlocks balsa,
spruce, rubber motor). 5. Eight seconds of powered flight (unlocks wood-and-fabric, bracing, skids, the 1903
engine and Flyer). 6. Twelve seconds in the 1903 Flyer (unlocks wheels, rotary engine, the 1917 scout).
7. Sunflower Circuit (unlocks everything else). 8. Open play.

## Invention systems

- **Parts**: fuselage (4 structures), flying surfaces (any number; wing, tailplane, foreplane, fin), engines
  (7), landing gear (2), ballast, pilot seat (seated/prone).
- **Materials** (10): paper, thin card, corrugated card, balsa, spruce, wood-and-fabric, foam plastic,
  aluminium, steel, carbon composite. Each has its own weight, strength, stiffness, toughness, drag and
  reaction to water.
- **Sections** (6): flat, reflexed, curved plate, deep pioneer camber, thick classic, symmetric.
- **Propulsion**: none, twisted rubber (burst then fade, no throttle), coreless and brushless electric
  (smooth throttle, battery weight), 1903 four-cylinder with twin chain-driven pushers (on/off, fades with
  heat, no torque), nine-cylinder rotary (blip throttle, torque, gyroscopic), supercharged inline, micro
  turbojet (slow spool, thrust that barely fades with speed).
- **Two editing depths**: Simple mode (coarse sliders, essential fields) and Engineering mode (taper, sweep,
  dihedral, control size, twin fins, gear geometry).
- **Tools**: templates, undo/redo, duplicate, remove, save, load, revisions (last 12 per design), blueprint
  codes for copy/paste. Not implemented: free 3D dragging of parts, component grouping, a separate mirror
  tool (surfaces are always built as mirrored pairs).

## World

One connected garden, 44 m square inside a plank fence (1,760 player-heights across).

| Place | Role |
|---|---|
| Workshop Clearing | Start. Hut with design bench, wall of history, journal desk; assembly deck. |
| Glider Hill | 1.35 m mound with a bungee catapult deck. Slope lift on its windward face. |
| Launch Rail | Low-friction wooden rail for skid aircraft. |
| Grass Runway | 9 m packed-earth strip, windsock. Weak thermals over the warm bare ground. |
| Flowerbed Valley | Sunflowers, the four hoops, bees. |
| The Pond | Water you can ditch in (and wade/swim). Jetty. Boats are not implemented. |
| Muddy Trenches | High rolling resistance, soft landings. Sandbags, cannon and trebuchet are set dressing. |
| Garden Fortress | Stone landmark with collision. No siege gameplay yet. |
| Tree roots | Backdrop only. |

Environment: day/night cycle, five weather presets (calm, breeze, gusty, rain, fog), wind with gusts,
turbulence, ground shelter, slope lift and thermals; rain wets the ground (less grip, more rolling drag) and
soaks paper and card.

## Wildlife

State-machine behaviour, not adaptive AI.

- **Ants** forage along a trail between nest and sugar cube, carry crumbs home, stop to inspect you, scatter
  from running engines, investigate a parked aircraft, and three guards chase and nip you near the nest.
- **Bees** commute between flowers; flying into one damages a wing.
- **Ladybird** crawls and flies off when approached. **Snail** and **butterflies** are ambient.

## Player

Walk, run, jump, crouch, wade/swim, carry a prototype, hop into a seat, repair. Health only matters near the
ant nest in this build. Climbing objects is limited to walkable slopes and box tops.

## Progression and saving

Autosave to browser storage: settings, journey step, trial medals, blueprints with revisions, the active
prototype, the last 40 journal entries, player position and time of day. Corrupt saves are set aside and a
clean one is started.
