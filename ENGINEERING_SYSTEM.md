# Engineering System

How a blueprint becomes a flying (or crashing) aircraft. Code: `src/sim/`.

## 1. One description, two consumers

A **blueprint** (`blueprint.js`) is plain JSON: a name, launch preference, pitch trim, and a list of parts.

| Part | Key fields |
|---|---|
| `fuselage` | kind (keel, truss, box, shell), material, length, width, height |
| `surface` | role, material, section, position x/y, span, chord, taper, sweep, dihedral, incidence, control type and size, bracing, vertical, twin spacing |
| `engine` | kind, position, pusher flag |
| `gear` | wheels + tail skid, or twin skids; position, track, leg height |
| `ballast` | mass, position |
| `pilot` | position, seated or prone |

The same object is passed to `Aircraft` (physics) and `buildAircraftMesh` (3D model). There is no separate
"stats" table per aircraft: historical types are just saved blueprints (`TEMPLATES`).

Serialisation is versioned (`v`). `sanitizeBlueprint` fills defaults, clamps every number to its schema range,
drops unknown parts and restores a missing fuselage or pilot, so old or hand-edited data cannot crash the game.

## 2. Catalog data (`catalog.js`)

- **Materials**: areal density, fuselage linear density, bending strength, bending stiffness, impact
  toughness, water absorption, surface roughness.
- **Sections**: zero-lift coefficient, maximum lift, profile drag, pitching moment, thickness, a critical
  Reynolds number below which thick sections separate, and a structural depth factor.
- **Engines**: mass, static thrust, pitch speed, throttle type (none / blip / smooth), endurance, spool time,
  reaction torque, rotor angular momentum, propeller diameter.
- **Fuselage kinds**: mass, frontal drag and side-area factors.

## 3. Building the model

`Aircraft.build()` turns parts into:

- **Point masses** with extents → total mass, centre of mass, principal moments of inertia.
- **Lifting panels**: each half-surface is split into 2–3 spanwise panels with position, chord axis, normal,
  area, aspect ratio and flags (aft of the centre of mass, in propwash, behind the main wing, biplane
  interference factor).
- **Drag bodies** for fuselage, pilot, gear, engine and bracing wires.
- **Contact points**: nose, tail, belly, wingtips, fin tip, wheels/skids, propeller tip.
- **Structure** per surface: bending capacity and stiffness from material, chord, section depth and bracing.

## 4. Each physics step (600 Hz, semi-implicit Euler)

For every panel: local velocity = aircraft velocity + rotation × arm − wind (+ propwash); angle of attack
(minus wing downwash for tail surfaces, plus control deflection scaled by control size and by how much the
structure twists under load); section lift from a finite-wing slope `2πAR/(AR+2)`, blended into a separated
flat-plate model past the stall; profile drag scaled by Reynolds number; induced drag with ground effect;
camber pitching moment. Forces are applied at each panel's own position, so the following are **emergent, not
scripted**: pitch/yaw/roll stability, control response, adverse yaw, dihedral effect, spiral and spin entry,
tip stall, the pitch-up of an aft centre of mass, the nose-over of a tail-dragger.

Then: bending moment per wing half → flex (changes panel geometry) and over-stress damage; engine thrust with
linear fall-off to the pitch speed, energy use, rubber torque curve, heat fade, reaction torque, gyroscopic
precession; spring-damper ground contacts with rolling/sliding friction by surface type; impact energy against
material toughness → damage; rain and pond water → moisture → more mass, less strength and stiffness.

## 5. Workshop analysis (`Aircraft.analyze`)

All read-outs call the same aerodynamic function as flight, in static conditions:

- neutral point and static margin from the slopes of lift and pitching moment
- stall speed, trim speed and angle, glide ratio from an angle-of-attack sweep (repeated at the trim speed
  because Reynolds number and control softness depend on speed)
- wing strength in g from bending at trim
- top speed and climb by balancing thrust against drag over a speed sweep
- directional and roll stability from a sideslip perturbation
- warnings in plain language (tail-heavy, will not trim, weak wing, no control, propeller below the gear…)

These are predictions. The only authority is the test flight.

## 6. Pilot assistance

"Accessible Flight" and "Simulation Flight" run the identical model. Accessible adds a co-pilot that only
moves the control surfaces the aircraft actually has: rate damping, bank-angle hold with torque trim,
turn coordination, stall and low-speed protection, artificial pitch stability for tail-heavy designs, and
tail-lift on the take-off run. Simulation keeps 12% of that. An aircraft without ailerons cannot be levelled
by aileron; one without an elevator cannot be protected from a stall.

## 7. Miniature-scale adaptations and honest limitations

- **Units are real**: metres, kilograms, newtons, air at 1.225 kg/m³. Aircraft are 13–30 cm across and weigh
  2–15 g, like real indoor models. They are not shrunken full-size aircraft with full-size numbers.
- **Low Reynolds number** (about 5,000–40,000): thin curved plates out-perform thick sections, lift maxima are
  low, drag is high. Section data reflect that, and thick sections are penalised below their critical value.
- **Cube-square law**: small things are relatively strong and survive crashes that would destroy a full-size
  machine. Strength values were scaled down from handbook figures so that structural failure is reachable in
  play (a card glider folds near 5 g). This is a gameplay adjustment.
- **Time**: the world is displayed at 0.4× real time (`TIME_SCALE`) so a model flying 4 m/s reads as a
  machine, the same over-cranking used to film miniatures. Reported times and speeds are true simulated values.
- **Simplifications**: no spanwise lift redistribution, no explicit propeller model (thrust curve only), no
  P-factor, diagonal inertia tensor, single downwash term, flex modelled as extra dihedral rather than a
  deforming mesh, wing-warping modelled as a spanwise-graded deflection. Collisions use sampled contact points,
  not full meshes. Historical types are "in the spirit of" their originals, tuned to show the right
  limitations, not validated against flight-test data.
