// Data catalog: materials, airfoils, engines. Everything the simulation knows about a
// component comes from these tables, so new content is data, not code.
// Units are SI at true miniature scale (a pilot is ~25 mm tall, aircraft weigh grams).

// areal   : kg/m^2 of a finished lifting surface made from the material
// lin     : kg/m of a standard fuselage member made from it
// strength: bending capacity, N*m per metre of root chord
// stiff   : bending stiffness EI, N*m^2 per metre of chord
// tough   : impact energy (J) the material shrugs off before damage
// soak    : 0..1 how quickly rain / pond water ruins it
// rough   : extra profile-drag coefficient from surface finish / thick edges
export const MATERIALS = {
  paper:      { name: 'Paper',                areal: 0.080, lin: 0.004, strength: 0.05, stiff: 0.004, tough: 0.020, soak: 1.0,  rough: 0.004, cost: 1,  era: 0, color: 0xf3efe2, look: 'paper',
                note: 'Feather-light but floppy. Wings flex, controls go soft at speed, and rain ruins it.' },
  card:       { name: 'Thin cardboard',       areal: 0.250, lin: 0.008, strength: 0.115, stiff: 0.027,  tough: 0.045, soak: 0.8,  rough: 0.006, cost: 1,  era: 0, color: 0xb98d5a, look: 'card',
                note: 'Cereal-box card. Stiffer than paper, three times the weight, hates water.' },
  corrugated: { name: 'Corrugated cardboard', areal: 0.480, lin: 0.012, strength: 0.45,  stiff: 0.25,   tough: 0.070, soak: 0.9,  rough: 0.016, cost: 1,  era: 0, color: 0xa87b47, look: 'corrugated',
                note: 'Thick fluted board: rigid and tough, but heavy with draggy blunt edges.' },
  balsa:      { name: 'Balsa sheet',          areal: 0.240, lin: 0.006, strength: 1.2,  stiff: 0.8,   tough: 0.020, soak: 0.25, rough: 0.003, cost: 3,  era: 1, color: 0xe6cfa0, look: 'wood',
                note: 'Superb stiffness for its weight, but brittle in a crash.' },
  timber:     { name: 'Spruce timber',        areal: 0.600, lin: 0.020, strength: 2.0,   stiff: 1.5,     tough: 0.050, soak: 0.1,  rough: 0.004, cost: 2,  era: 0, color: 0x8a5a2b, look: 'wood',
                note: 'Strong and dependable, and you pay for it in grams.' },
  fabric:     { name: 'Wood frame & fabric',  areal: 0.120, lin: 0.008, strength: 0.065,  stiff: 0.35,   tough: 0.012, soak: 0.15, rough: 0.005, cost: 4,  era: 1, color: 0xe9dcc0, look: 'fabric',
                note: 'Spars and ribs under doped linen: the pioneers\' recipe. Light, strong when wire-braced, tears easily.' },
  plastic:    { name: 'Foam plastic',         areal: 0.110, lin: 0.012, strength: 0.12,  stiff: 0.15,   tough: 0.050, soak: 0,    rough: 0.005, cost: 4,  era: 3, color: 0xd8e4ea, look: 'plastic',
                note: 'Light, waterproof and bouncy; flexes under hard manoeuvres.' },
  aluminum:   { name: 'Aluminium skin',       areal: 0.540, lin: 0.018, strength: 0.9,  stiff: 1.3,     tough: 0.060, soak: 0,    rough: 0.002, cost: 7,  era: 2, color: 0xc4c9cf, look: 'metal',
                note: 'Smooth stressed skin for fast aircraft. Too heavy for a slow wing.' },
  steel:      { name: 'Steel sheet',          areal: 1.180, lin: 0.045, strength: 1.6,   stiff: 2.2,     tough: 0.150, soak: 0,    rough: 0.003, cost: 5,  era: 1, color: 0x7d8288, look: 'steel',
                note: 'Nearly indestructible. Needs enormous power or enormous wings to leave the ground.' },
  composite:  { name: 'Carbon composite',     areal: 0.250, lin: 0.007, strength: 2.0,   stiff: 2.6,     tough: 0.050, soak: 0,    rough: 0.002, cost: 10, era: 4, color: 0x2a2d33, look: 'carbon',
                note: 'Modern miracle: card-like weight with better-than-metal stiffness.' },
};

// Section data are for the low Reynolds numbers (roughly 5,000 - 40,000) of inch-scale wings.
// reCrit: below this chord Reynolds number the section suffers laminar separation.
export const AIRFOILS = {
  flat:      { name: 'Flat plate',          cl0: 0.0,  clmax: 0.75, cd0: 0.022, cm0: 0,     thick: 0.01, camber: 0,    reCrit: 0,     structF: 1.0,
               note: 'A plain sheet. Honest, draggy at high lift, works at any size.' },
  reflex:    { name: 'Reflexed plate',      cl0: -0.03, clmax: 0.72, cd0: 0.024, cm0: 0.035, thick: 0.01, camber: -0.02, reCrit: 0,    structF: 1.1,
               note: 'Trailing edge bent up. Lets a tailless wing or dart hold its own nose up.' },
  cambered:  { name: 'Curved plate',        cl0: 0.38, clmax: 1.05, cd0: 0.028, cm0: -0.06, thick: 0.015, camber: 0.05, reCrit: 0,     structF: 1.15,
               note: 'A gently arched sheet: the best lifting shape for tiny, slow wings.' },
  deep:      { name: 'Deep pioneer camber', cl0: 0.52, clmax: 1.18, cd0: 0.038, cm0: -0.10, thick: 0.02, camber: 0.08, reCrit: 0,     structF: 1.2,
               note: 'Lilienthal / Wright style arch. Lots of lift, lots of drag, strong nose-down pull.' },
  thick:     { name: 'Thick classic airfoil', cl0: 0.32, clmax: 1.25, cd0: 0.016, cm0: -0.07, thick: 0.12, camber: 0.035, reCrit: 45000, structF: 1.9,
               note: 'Deep spar, great at speed and size. At tiny scale the air separates and it underperforms.' },
  symmetric: { name: 'Symmetric airfoil',   cl0: 0.0,  clmax: 0.95, cd0: 0.015, cm0: 0,     thick: 0.09, camber: 0,    reCrit: 30000, structF: 1.6,
               note: 'Flies the same upside-down. Ideal for tails and aerobatics.' },
};

// thrust: static thrust (N). vPitch: airspeed at which a fixed-pitch prop stops pulling (m/s).
// throttle: 'none' (runs flat out until empty), 'blip' (off / part / full), 'smooth'
// endurance: seconds at full power. spool: throttle response time constant (s).
// torque: reaction torque per newton of thrust (N*m/N). gyro: rotor angular momentum at full power (kg*m^2/s).
export const ENGINES = {
  rubber:   { name: 'Twisted rubber band',      mass: 0.0012, thrust: 0.04, vPitch: 6.5,  throttle: 'none',   endurance: 22,  spool: 0.15, torque: 0.012, gyro: 0,       prop: 0.05, era: 0, sound: 'rubber', props: 1,
              note: 'Wind it up, let it go. A burst of torque that fades — no throttle, no second chance.' },
  electric: { name: 'Coreless motor + cell',    mass: 0.0026, thrust: 0.05, vPitch: 8.5,  throttle: 'smooth', endurance: 110, spool: 0.12, torque: 0.006, gyro: 0,       prop: 0.04, era: 4, sound: 'electric', props: 1,
              note: 'Smooth, obedient thrust. The battery is dead weight you carry all flight.' },
  electricL:{ name: 'Brushless motor + pack',   mass: 0.0052, thrust: 0.11, vPitch: 12,   throttle: 'smooth', endurance: 90,  spool: 0.12, torque: 0.007, gyro: 2e-7,    prop: 0.05, era: 4, sound: 'electric', props: 1,
              note: 'Serious power, serious weight. Wants a stiff airframe.' },
  wright:   { name: '1903 four-cylinder, twin chain-driven pushers', mass: 0.0030, thrust: 0.036, vPitch: 9.0, throttle: 'none', endurance: 75, spool: 0.8, torque: 0, gyro: 0, prop: 0.036, era: 1, sound: 'wright', props: 2, fade: 0.18,
              note: 'No throttle: it runs or it doesn\'t. Counter-rotating props cancel torque; power sags as it heats.' },
  rotary:   { name: 'Nine-cylinder rotary',     mass: 0.0027, thrust: 0.046, vPitch: 13,   throttle: 'blip',   endurance: 120, spool: 0.25, torque: 0.004, gyro: 1.0e-6,  prop: 0.038, era: 2, sound: 'rotary', props: 1,
              note: 'The whole engine spins with the propeller. Huge power-to-weight; the gyroscope fights every turn.' },
  inline:   { name: 'Supercharged inline',      mass: 0.0048, thrust: 0.11, vPitch: 19,   throttle: 'smooth', endurance: 100, spool: 0.3,  torque: 0.008, gyro: 4e-7,    prop: 0.042,  era: 3, sound: 'inline', props: 1,
              note: '1930s-40s muscle. Smooth throttle and enough thrust to break weak wings.' },
  jet:      { name: 'Micro turbojet',           mass: 0.0040, thrust: 0.09, vPitch: 70,   throttle: 'smooth', endurance: 35,  spool: 2.2,  torque: 0, gyro: 3e-7, prop: 0, era: 3, sound: 'jet', props: 0,
              note: 'Thrust that barely fades with speed, slow to spool, drinks fuel.' },
};

export const FUSELAGE_KINDS = {
  keel:  { name: 'Folded keel / stick', massF: 0.6, cdFront: 0.9, sideF: 0.9, note: 'A single spine. Minimal weight and drag.' },
  truss: { name: 'Open truss frame',    massF: 1.0, cdFront: 1.6, sideF: 0.25, note: 'Bare longerons and wires. Light, draggy, little side area.' },
  box:   { name: 'Covered box',         massF: 1.6, cdFront: 0.75, sideF: 1.0, note: 'Skinned frame with a cockpit. The classic biplane body.' },
  tube:  { name: 'Streamlined shell',   massF: 1.9, cdFront: 0.32, sideF: 1.0, note: 'Rounded monocoque. Heavy to build, slips through the air.' },
};

export const ERAS = ['Pre-1900: paper, kites & gliders', '1900s: pioneers', '1910s: the Great War', '1920s-40s: metal & speed', 'Modern & experimental'];

export const RHO = 1.225;      // air density kg/m^3
export const NU = 1.5e-5;      // kinematic viscosity m^2/s
export const G = 9.81;
export const PILOT_MASS = 0.0006; // a one-inch inventor with goggles and toolkit
