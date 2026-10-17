/**
 * The guided tour's stops: [exhibit, authored view, seconds, caption, source]. Moved out of
 * main.js unchanged; tools/provenance-check.mjs reads the captions from here.
 */

// ---- Guided tour ----------------------------------------------------------------------
// A museum has a route through it. This one walks every exhibit, stopping where the authored
// views already point, and hands the camera straight back the moment the visitor touches it —
// the same courtesy the launch sequence extends.
// Each stop says one thing worth knowing about what is on screen, and where it comes from.
// Every figure here is one the data sheet already carries with that source; an estimate or a
// reconstruction says so.
export const TOUR = [
  ['starship', 'site', 8, 'Pad 2 at Starbase, rebuilt at 1:1: a square, water-cooled launch mount with 20 hold-down clamps over a bidirectional flame trench, and catch arms of ≈26 m. The tower is ≈480 ft with a 10 ft lightning rod, the FAA\'s planning figure.', 'nsf_pad2'],
  ['starship', 'engines', 6, '33 Raptor 3 hang in the open below Super Heavy\'s thrust ring. Each Raptor 3 is 1.3 m across, 2.9 m tall and gives 250 tf.', 'spacex_starship'],
  ['starship', 'tiles', 6, 'The real ship carries about 18,000 hexagonal tiles; 13,267 are modelled here, each 0.26 m across the flats.', 'wiki_starship'],
  ['starship', 'flaps', 6, 'Two forward flaps on the leeward side and two aft flaps steer the ship back through the atmosphere. On V3 each aft flap has one actuator with three motors.', 'spacex_v3'],
  ['starship', 'trench', 6, 'The flame trench: a concrete bathtub lined with stainless steel, open at both ends, with a deflector of steel pipes in the middle. Its 22 m width and 4.2 m depth are reconstructed.', 'nsf_pad2'],
  ['falcon9', 'overview', 6, 'Falcon 9 Block 5: 70 m tall and 3.66 m across (12 ft), nine Merlin 1D on the first stage and one Merlin Vacuum above.', 'spacex_f9'],
  ['falcon9', 'octaweb', 5, 'The Octaweb: eight Merlin 1D round a centre engine, 845 kN each at sea level.', 'wiki_merlin'],
  ['falcon9', 'interstage', 5, 'The black interstage carries the four titanium grid fins at its base and the pneumatic pushers that separate the stages.', 'wiki_f9b5'],
  ['falconheavy', 'overview', 6, 'Falcon Heavy: three first-stage cores, 27 Merlins, 12.2 m wide and 70 m tall.', 'spacex_fh'],
  ['falconheavy', 'engines', 5, '27 Merlin 1D: 22,819 kN together at sea level.', 'spacex_fh'],
  ['dragon', 'overview', 6, 'Crew Dragon: 8.1 m with its trunk and 4 m across the heat shield; up to seven crew, four on space-station missions.', 'spacex_dragon'],
  ['dragon', 'superdraco', 5, 'Eight SuperDraco escape engines in four pairs, 71 kN each. The two windows sit either side of the hatch.', 'spacex_dragon'],
  ['dragon', 'trunk', 5, 'The trunk is half solar array and half radiator, and is jettisoned before re-entry.', 'nasa_ccp_presskit'],
  ['starlink', 'overview', 6, 'Starlink V2 Mini: two solar wings of 52.5 m² each, about 30 m tip to tip.', 'teslarati_v2mini'],
  ['starlink', 'antennas', 5, 'The Earth-facing side of the bus, where the phased-array antennas are.', null],
  ['roadster', 'overview', 6, 'Tesla Roadster, first generation: 3.946 m long and 1.851 m across the mirrors. It flew on the first Falcon Heavy on 6 February 2018.', 'tesla_roadster_sm'],
  ['roadster', 'detail', 5, 'An 871 mm front overhang and a 2,351 mm wheelbase, from Tesla\'s own service manual.', 'tesla_roadster_sm'],
  ['roadster', 'starman', 5, 'Starman: a mannequin in a SpaceX pressure suit, at the wheel.', 'wiki_roadster'],
  ['roadster', 'earth', 7, 'In orbit, on its payload adapter. The Earth behind it is illustrative, not a map.', 'spacex_fh_demo'],
  ['engines', 'overview', 6, 'Raptor 3, Raptor Vacuum and Merlin 1D side by side, all at 1:1.', 'spacex_starship'],
  ['engines', 'raptor', 5, 'Raptor 3: 1.3 m across, 2.9 m tall, 250 tf. Its plumbing is folded into the housings: a charcoal bell, the chamber rings, the manifold disc and the turbopump block.', 'spacex_starship'],
  ['engines', 'rvac', 5, 'Raptor Vacuum: a 2.3 m exit, 4.4 m tall, 275 tf. Its extension is cooled by radiating heat away.', 'spacex_starship'],
  ['falcon1', 'overview', 6, 'Falcon 1, 2008 configuration: 21.98 m from nozzle exit to tip and 1.681 m across, from the dimensioned drawing in its 2008 user\'s guide.', 'spacex_falcon1_2008'],
  ['falcon1', 'cutaway', 6, 'An educational cutaway of the second stage, with its pressure-fed Kestrel engine inside the interstage.', 'spacex_falcon1_2008'],
  ['gt3rs', 'overview', 6, 'Porsche 911 GT3 RS (992), 2023: 4.572 m long, 1.900 m wide and 1.322 m tall to the rear wing\'s upper edge, which stands above the roof.', 'porsche_techdata'],
  ['gt3rs', 'side', 5, 'Behind the rear axle, a naturally aspirated flat six of 3,996 cm³: 386 kW (525 PS) at 8,500 rpm, 9,000 rpm maximum. Press B to drive it.', 'porsche_techdata'],
  ['gt3rs', 'rear', 5, 'The swan-neck wing, with the first DRS on a production Porsche: 409 kg of downforce at 200 km/h and 860 kg at 285 km/h.', 'porsche_presskit'],
  ['gt3rs', 'wheel', 5, 'Centre-lock wheels on 275/35 ZR 20 tyres in front and 335/30 ZR 21 behind; 408 × 36 mm cast iron discs with six-piston callipers.', 'porsche_techdata'],
  ['h2r', 'overview', 6, 'Kawasaki Ninja H2R, 2027: 2.070 m long, 0.850 m wide across its carbon wings, 1.160 m tall; 216 kg ready to ride. Closed-course only.', 'kawasaki_h2r'],
  ['h2r', 'engine', 5, 'A supercharged 998 cm³ inline four in a green steel trellis: 228 kW at 14,000 rpm, 240 kW with ram air, 165 Nm at 12,500 rpm. Press N to ride it.', 'kawasaki_h2r'],
];
