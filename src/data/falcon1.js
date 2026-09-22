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
  height: 21.336, footprint: 1.6764,
  summary: 'The small two-stage ancestor of Falcon 9. This exhibit follows the late Falcon 1 configuration: a Merlin 1C first stage, a pressure-fed Kestrel 2 upper stage, the long dark interstage and the aluminium biconic fairing dimensioned in the 2008 manufacturer guide.',
  specs: [
    { label: 'Height · both stages and fairing', value: '21.336 m (70 ft; commonly rounded to 21.3 m)', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Stage diameter', value: '1.6764 m (5.5 ft; commonly rounded to 1.7 m)', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Fairing diameter', value: '1.54 m · aluminium biconic', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Fairing height', value: '3.50 m · cylindrical base and two conic slopes', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'First-stage propellant tank', value: '402 in (10.21 m)', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'First-stage propulsion', value: '1 × Merlin 1C · pump-fed LOX / RP-1', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Upper-stage propulsion', value: '1 × Kestrel 2 · pressure-fed LOX / RP-1', source: 'spacex', ref: 'spacex_falcon1_2008' },
    { label: 'Independent scale cross-check', value: 'NASA: approximately 21.3 m × 1.7 m', source: 'nasa', ref: 'nasa_falcon1_2011' },
  ],
  approximations: [
    'The fairing follows the published 1.54 m × 3.50 m envelope and its two slope changes. Stage split stations, engine dimensions, tank domes, feed lines, RCS clocking and thrust supports remain measured educational reconstructions, not released manufacturing geometry.',
    'This is the late Merlin 1C configuration. The earlier Merlin 1A, later Merlin 1D, and proposed taller Falcon 1e are distinct configurations and are not represented.',
    'The 2008 guide includes proposed future capability and recovery plans; neither is presented here as a flown capability. NASA’s 2011 entry combines Falcon 1 and Falcon 1e, so it is used only to cross-check rounded external dimensions.',
    'Surface colours are a simplified museum reconstruction, without mission-specific payload logos. The interior contains representative empty tank structure, with no mission-specific satellite inside the fairing.',
  ],
  sources: ['spacex_falcon1_2008', 'nasa_falcon1_2011'],
  presets: [
    { id: 'overview', label: 'Overview', pos: [18, 12.5, 29], target: [0, 10.6, 0] },
    { id: 'merlin1c', label: 'Merlin 1C', pos: [2.85, 2.30, 3.45], target: [0, 0.88, 0] },
    { id: 'interstage', label: 'Stage separation', pos: [3.1, 14.2, 4.0], target: [0, 13.75, 0] },
    { id: 'cutaway', label: 'Upper stage · educational cutaway', pos: [-4.8, 16.2, 5.6], target: [0, 15.5, 0] },
    { id: 'fairing', label: 'Biconic fairing', pos: [3.3, 19.75, 4.4], target: [0, 19.55, 0] },
  ],
};
