/** Historical Falcon 1, late Merlin 1C configuration. SI conversion of the 2008 guide. */
export const FALCON1_SOURCES = {
  spacex_falcon1_2008: {
    label: 'SpaceX — Falcon 1 User’s Guide, Rev 7 (May 2008; preserved PDF)',
    url: 'https://spacex.com.pl/files/2017-10/falcon1usersguide.pdf',
  },
  nasa_falcon1_2011: {
    label: 'NASA — Routine Payload Environmental Assessment (2011), p. 2–24',
    url: 'https://www.nasa.gov/wp-content/uploads/2024/10/nasa-routine-payload-ea-fonsi-2011.pdf',
  },
};

export const FALCON1 = {
  id: 'falcon1', name: 'Falcon 1', subtitle: 'Historical exhibit · Merlin 1C configuration',
  height: 21.984, footprint: 1.6805,
  summary: 'The small two-stage ancestor of Falcon 9. This exhibit follows the late Falcon 1 configuration: a Merlin 1C first stage, a pressure-fed Kestrel 2 upper stage, the long dark interstage and the aluminium biconic fairing dimensioned in the 2008 manufacturer guide.',
  specs: [
    { label: 'Height · nozzle exit to tip', value: '21.98 m (865.5 in, from the Figure 2-5 stations; the summary table rounds to 70 ft)', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Stage diameter', value: '1.681 m (Ø66.16 in, Figure 2-5; 5.5 ft in the table)', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Fairing diameter', value: '1.524 m (Ø60.00 in) · aluminium biconic', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Fairing height', value: '3.44 m (stations 756.36 → 891.83 in; slope changes at 817.20 and 847.32)', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Stations read off Figure 2-5', value: 'gimbal 100 in · aft ring 133 · interstage 524 · separation 649 · fairing 756', source: 'derived', approx: true },
    { label: 'First-stage propellant tank', value: '402 in (10.21 m)', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'First-stage propulsion', value: '1 × Merlin 1C · pump-fed LOX / RP-1', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Upper-stage propulsion', value: '1 × Kestrel 2 · pressure-fed LOX / RP-1', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Independent scale cross-check', value: 'NASA: approximately 21.3 m × 1.7 m', source: 'nasa', ref: 'nasa_falcon1_2011' },
  ],
  approximations: [
    'Stations come from the dimensioned layout drawing in the 2008 guide (Figure 2-5). Its labelled stations are exact; the others (nozzle exit, throat, aft ring, interstage, separation, Kestrel, upper tank) are read off the drawing at 2.90 px/in and good to about half an inch. Feed lines, RCS clocking and small hardware remain reconstructions from photographs.',
    'Discrepancy in the source: the guide\'s summary table gives 70 ft (21.34 m) and 5.5 ft, but its own dimensioned drawing gives 865.5 in (21.98 m) from nozzle exit to tip and Ø66.16 in. The model follows the drawing, which agrees with the fairing figure (3.5 m [136 in] above the separation plane) and is dimensioned rather than rounded.',
    'This is the late Merlin 1C configuration. The earlier Merlin 1A, later Merlin 1D, and proposed taller Falcon 1e are distinct configurations and are not represented.',
    'The 2008 guide includes proposed future capability and recovery plans; neither is presented here as a flown capability. NASA’s 2011 entry combines Falcon 1 and Falcon 1e, so it is used only to cross-check rounded external dimensions.',
    'Surface colours are a simplified museum reconstruction, without mission-specific payload logos. The interior contains representative empty tank structure, with no mission-specific satellite inside the fairing.',
  ],
  sources: ['spacex_falcon1_2008', 'nasa_falcon1_2011'],
  presets: [
    { id: 'overview', label: 'Overview', pos: [18.5, 12.8, 29.5], target: [0, 10.9, 0] },
    { id: 'merlin1c', label: 'Merlin 1C and thrust frame', pos: [0.5, 1.9, 4.6], target: [0, 1.55, 0] },
    { id: 'interstage', label: 'Stage separation', pos: [3.1, 16.2, 4.0], target: [0, 15.8, 0] },
    { id: 'cutaway', label: 'Upper stage · educational cutaway', pos: [-5.0, 16.4, 5.8], target: [0, 15.9, 0] },
    { id: 'fairing', label: 'Biconic fairing', pos: [3.3, 20.3, 4.4], target: [0, 20.1, 0] },
  ],
};
