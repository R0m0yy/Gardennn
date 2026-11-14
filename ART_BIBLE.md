# Art Bible

## Reference

The four concept paintings supplied by the creative director (workshop under giant grass, trench line with
tank, red triplane over the fortress, pioneer flyer over the pond) are the target: a hand-built miniature
diorama in warm golden light, dense with small crafted detail, framed by towering blades and blossoms.

**Honest gap:** those paintings are far denser and more painterly than this build. Everything here is
generated procedurally at start-up in a browser, with no sculpted or scanned assets. The build aims at the
same *composition, palette, scale cues and material vocabulary*; it does not reach the reference's fidelity.
Closing that gap is the purpose of Milestone 6 and would need authored meshes and textures.

## Scale

- The inventor is 25 mm tall. Everything is modelled in metres at true size.
- Grass blades 10–40 cm (4–16 body heights), sunflowers 1–2 m, the flowerpot 0.9 m, a raindrop the size of
  a head, an ant a third of your height.
- Scale cues are deliberate: a forgotten trowel, a terracotta pot, plank fence boards, a sugar cube.

## Palette and light

- Default time 08:36: low warm sun (`#ffd9a0`), blue-to-cream sky, cream fog. Golden hour returns at 16:30.
- Greens run yellow-green to deep leaf green; soil is warm tan to umber; wood is honey, chestnut and
  weathered grey; accents are lantern orange, banner red, brass.
- ACES tone mapping, soft shadows that follow the action, optional bloom, and a "miniature lens": a
  tilt-shift blur at the top and bottom of the frame plus a slight vignette.

## Materials

Painted on canvases at boot (`src/gfx/textures.js`): planked wood in four tones, doped fabric with rib
shadows, kraft card, corrugated card, ruled paper, riveted aluminium, rusted steel, brass, carbon weave,
soil with pebbles and cracks, stone courses with moss, mossy shingles, terracotta, bark, sandbag weave.
Aircraft parts take their look from their catalogue material, so a cardboard wing looks like cardboard.

## Aircraft

Built from the blueprint (`aircraftMesh.js`): cambered or thick lofted wings, separate animated control
surfaces, visible spars and ribs on fabric wings, interplane and cabane struts with crossed bracing wires,
kingposts on braced monoplanes, four fuselage constructions, spoked wheels, skids, seven engine models (the
rotary's cylinders spin with the propeller; the 1903 engine drives two chain-linked pushers), a seated or
prone pilot, roundels on the service scout. Wings visibly flex and fold; gear collapses; broken propellers
shorten.

## Characters and wildlife

The inventor wears a flat cap, brass goggles, waistcoat and braces, with natural rather than cartoon
proportions, procedurally animated (walk, run, jump, crouch, carry, work, seated, prone). Ants, bees,
ladybird, snail and butterflies are small stylised-realistic models.

## Architecture

Timber-frame workshop with mossy shingles, plank floor, blueprint board, shelves of jars, brass gear wheels,
lanterns, radio valves, crates, barrels, ladder, banner and a canvas awning over the assembly deck. Stone
fortress with crenellated towers, gatehouse and portcullis, banners, palisade, torches. Launch rail on
sleepers, bungee catapult deck, pebble-edged runway, twig hoops.

## UI

Engineering-notebook parchment panels with serif type and ink colours for menus, workshop and reports;
dark brass-edged instruments for the flight HUD. Every button does something.

## Camera

Exploration: orbiting 2.5D view with zoom; vegetation between camera and inventor dissolves in a dithered
window and bends away from feet and wheels. Flight: chase view with speed-widened field of view, or cockpit.
Workshop: orbit and zoom around the model with click-to-select.
