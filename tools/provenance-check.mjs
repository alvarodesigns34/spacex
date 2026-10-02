/** Provenance gate, without a browser. Node 22.15+.
 *
 * figures.js states every checked dimension once, with its grade (A published, B measured on a
 * photograph, C secondary, D reconstructed) and its source. This gate fails when anything that
 * repeats one of those figures to a visitor says something else:
 *
 *  - a data sheet row linked to a figure (`fig` / `pad` in specs.js) must state its number, and
 *    carry a source that matches its grade: a published figure cannot be shown as ≈ or cited to
 *    Wikipedia, and a reconstructed one cannot be shown without ≈;
 *  - every figure must be stated in the sheet, and every graded figure must cite a source that
 *    exists (a reconstruction must say what it was reconstructed from);
 *  - the vehicle table at the top of the README must state each figure it is meant to;
 *  - a part count the sheet states (the modelled tiles) must be the count the check enforces;
 *  - every figure with a unit (m, tf, kN, in) written into a 3-D label in a vehicle builder must
 *    be stated in that vehicle's sheet: the Pad 2 trench label said 8.2 m for months after the
 *    trench, the sheet and the check had all become 4.2 m — and a label repeating a measured or
 *    reconstructed figure (grade B or D) must carry its ≈;
 *  - a source that was checked and found NOT to state a figure (RETRACTED) can never be cited
 *    for it again, nor carry it in its own label: a URL existing says nothing about what it says;
 *  - the README's description of the current state must not keep statements a later round
 *    overturned (README_RULES): each rule is one contradiction that was actually found.
 *
 * Mutations of the inputs must fail, so the gate cannot pass by checking nothing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { FIGURES, PAD_FIGURES, COUNTS, GRADES } = await import('../src/data/figures.js');
const { VEHICLES, SOURCES } = await import('../src/data/specs.js');
const README = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');
// Which exhibit's sheet each builder's labels answer to.
const LABEL_FILES = {
  'pad.js': ['starship'], 'starship.js': ['starship'], 'falcon.js': ['falcon9', 'falconheavy'],
  'falcon1.js': ['falcon1'], 'dragon.js': ['dragon'], 'starlink.js': ['starlink'],
  'roadster.js': ['roadster'], 'enginehall.js': ['engines'], 'f16.js': ['f16'],
  'gt3rs.js': ['gt3rs'],
};
// The guided tour's captions (main.js): each stop names an exhibit, so each figure it states
// answers to that exhibit's sheet, exactly as a 3-D label does.
const MAIN = readFileSync(fileURLToPath(new URL('../src/main.js', import.meta.url)), 'utf8');
export function tourStops(main) {
  const body = main.slice(main.indexOf('const TOUR = ['), main.indexOf('];', main.indexOf('const TOUR = [')));
  const out = [];
  for (const m of body.matchAll(/\[\s*'([a-z0-9]+)'\s*,\s*'([a-z0-9-]+)'\s*,\s*[\d.]+\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*(?:'([a-z0-9_]+)'|null)\s*\]/g)) {
    out.push({ id: m[1], preset: m[2], text: m[3].replace(/\\'/g, "'"), src: m[4] ?? null });
  }
  return out;
}
const TOUR = tourStops(MAIN);
const BUILDERS = Object.fromEntries(Object.keys(LABEL_FILES).map(f =>
  [f, readFileSync(fileURLToPath(new URL(`../src/vehicles/${f}`, import.meta.url)), 'utf8')]));

/** Sources checked against what they were cited for, and found not to say it. */
export const RETRACTED = [
  // Checked 27 Sep 2026: a construction-progress article with no tower height in it.
  { ref: 'se_pad2', values: [144.5, 474], what: 'la altura de la torre del Pad 2' },
];

/**
 * Statements the README must not make about the CURRENT state, each one a contradiction that
 * stood in it after a later round had overturned it. `bad(line, section)` flags a line; a line
 * can keep an old figure as history, but then it says so.
 */
const HISTORY = /\b(antes|entonces|anterior|histórico|Histórico|en lugar de|ya no|era|eran|usaba|usaban)\b/;
export const README_RULES = [
  { name: 'recuento de losetas antiguo presentado como actual', bad: (l) => /13[ .\u00a0]?132/.test(l) && !HISTORY.test(l) },
  { name: 'celosía más alta que la torre entera, sin la salvedad', bad: (l) => /145–150/.test(l) && !/error/.test(l) },
  { name: '474 ft presentado como dato publicado o citado', bad: (l, sec) => /474 ft/.test(l) && (/se publica su altura|publicado de 474|torre de 144,5 m \(474 ft\)/.test(l) || (/^\|\s*Citado/.test(l))) },
  { name: 'fila «Citado» del pad con la altura de la torre', bad: (l) => /^\|\s*Citado\s*\|/.test(l) && /144,5|474/.test(l) },
  { name: 'Falcon 9: los 1,9 m asignados todavía al adaptador', bad: (l, sec) => sec === 'Discrepancias entre fuentes' && /adaptador de carga bajo la cofia/.test(l) && !HISTORY.test(l) },
  { name: 'Starlink: superficie un 8 % corta presentada como actual', bad: (l, sec) => sec === 'Discrepancias entre fuentes' && /8 %/.test(l) && !HISTORY.test(l) },
];

const SOURCE_FOR_GRADE = {
  A: ['spacex', 'official', 'nasa'],
  C: ['wiki', 'press', 'faa'],
};

/** Numbers written in a string, each with the half-unit of its last written digit. */
function numbersIn(text, decimalComma = false) {
  const out = [];
  const re = decimalComma ? /\d+(?:,\d+)?/g : /\d[\d,]*(?:\.\d+)?/g;
  for (const m of text.matchAll(re)) {
    let t = m[0];
    if (decimalComma) t = t.replace(',', '.');
    else t = t.replace(/,/g, '');
    const dec = t.includes('.') ? t.split('.')[1].length : 0;
    out.push({ n: Number(t), half: 0.5 * 10 ** -dec });
  }
  return out;
}
const states = (text, value, decimalComma) =>
  numbersIn(text, decimalComma).some(({ n, half }) => Math.abs(n - value) <= half + 1e-9);

/** The vehicle table at the top of the README: first cell → third cell. */
function readmeTable(readme) {
  const rows = [];
  const lines = readme.split('\n');
  const start = lines.findIndex(l => /^\|\s*Vehículo\s*\|/.test(l));
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const cells = lines[i].split('|').map(c => c.trim());
    rows.push({ name: cells[1], size: cells[3] });
  }
  return rows;
}

export function audit({ figures, pad, counts, vehicles, sources, readme, builders = {}, tour = [] }) {
  const problems = [];
  const bad = (msg) => problems.push(msg);
  // Values a visitor must see with ≈: every measured (B) or reconstructed (D) figure.
  const approxValues = [...Object.values(pad), ...Object.values(figures).flatMap(f => Object.values(f).filter(x => x && typeof x === 'object' && 'grade' in x))]
    // Measured, reconstructed, or published but stated as approximate (a planning figure).
    .filter(f => f.grade === 'B' || f.grade === 'D' || f.approx).map(f => f.value);
  const graded = (where, f) => {
    if (!GRADES[f.grade]) return bad(`${where}: grado desconocido «${f.grade}»`);
    if (f.grade === 'D') { if (!f.note && !f.label) bad(`${where}: una reconstrucción debe decir de qué sale`); }
    else if (!sources[f.ref]) bad(`${where}: la fuente «${f.ref}» no existe en SOURCES`);
  };
  const rowAgrees = (where, row, f) => {
    if (!states(row.value, f.value)) bad(`${where}: la fila «${row.label}» dice «${row.value}», que no enuncia ${f.value}`);
    const allowed = SOURCE_FOR_GRADE[f.grade];
    if (allowed && !allowed.includes(row.source)) bad(`${where}: cifra de grado ${f.grade} citada como «${row.source}» en «${row.label}»`);
    if (f.grade === 'A' && row.approx) bad(`${where}: cifra publicada (A) marcada ≈ en «${row.label}»`);
    if ((f.grade === 'B' || f.grade === 'D') && !row.approx) bad(`${where}: cifra de grado ${f.grade} sin la marca ≈ en «${row.label}»`);
    if (f.ref && row.ref && f.ref !== row.ref) bad(`${where}: la fila cita «${row.ref}» y la cifra, «${f.ref}»`);
  };

  const starship = vehicles.find(v => v.id === 'starship');
  for (const v of vehicles) {
    const f = figures[v.id];
    if (!f) { bad(`${v.id}: sin cifras en figures.js`); continue; }
    if (v.height !== f.height?.value) bad(`${v.id}: la ficha declara altura ${v.height} y figures.js ${f.height?.value}`);
    if (v.footprint !== f.footprint?.value) bad(`${v.id}: la ficha declara huella ${v.footprint} y figures.js ${f.footprint?.value}`);
    for (const key of ['height', 'footprint', 'breadth', 'mirrors', 'length']) {
      const fig = f[key];
      if (!fig) continue;
      graded(`${v.id}.${key}`, fig);
      const rows = v.specs.filter(r => [].concat(r.fig ?? []).includes(key));
      if (!rows.length) bad(`${v.id}.${key}: ninguna fila de la ficha enuncia ${fig.value}`);
      for (const row of rows) rowAgrees(`${v.id}.${key}`, row, fig);
    }
    for (const row of v.specs) for (const key of [].concat(row.fig ?? [])) {
      if (!f[key]) bad(`${v.id}: la fila «${row.label}» apunta a una cifra «${key}» que no existe`);
    }
  }
  for (const [key, fig] of Object.entries(pad)) {
    graded(`pad.${key}`, fig);
    const rows = starship.specs.filter(r => (r.pad ?? []).includes(key));
    if (fig.sheet && !rows.some(r => r.label === fig.sheet)) bad(`pad.${key}: la fila «${fig.sheet}» no la enuncia`);
    for (const row of rows) rowAgrees(`pad.${key}`, row, fig);
  }
  for (const [id, list] of Object.entries(counts)) for (const c of list) {
    graded(`${id}.${c.key}`, c);
    if (!c.sheet) continue;
    const row = vehicles.find(x => x.id === id)?.specs.find(r => r.label === c.sheet);
    if (!row) bad(`${id}.${c.key}: no hay fila «${c.sheet}» en la ficha`);
    else if (!states(row.value, c.want)) bad(`${id}.${c.key}: la fila «${c.sheet}» dice «${row.value}», que no enuncia ${c.want}`);
  }

  // Figures with a unit in the 3-D labels (literal strings; a template built from a constant
  // cannot drift from it). Each must be stated somewhere in the owning exhibit's sheet.
  for (const [file, text] of Object.entries(builders)) {
    const ids = LABEL_FILES[file] ?? [];
    const sheet = ids.flatMap(id => {
      const v = vehicles.find(x => x.id === id);
      return v ? [...v.specs.map(r => r.value), ...(v.approximations ?? [])] : [];
    }).join(' · ');
    for (const m of text.matchAll(/\{\s*label:\s*'((?:[^'\\]|\\.)*)'\s*,\s*position/g)) {
      for (const u of m[1].matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(?:m|tf|kN|in)\b/g)) {
        const [{ n, half }] = numbersIn(u[1]);
        const said = numbersIn(sheet).some(x => Math.abs(x.n - n) <= half + 1e-9);
        if (!said) bad(`${file}: la etiqueta «${m[1]}» dice ${u[0]}, que la ficha de ${ids.join('/')} no enuncia`);
        const approx = approxValues.some(v => Math.abs(v - n) <= half + 1e-9);
        if (approx && !/≈\s*$/.test(m[1].slice(0, u.index))) bad(`${file}: la etiqueta «${m[1]}» da ${u[0]}, una cifra reconstruida o estimada, sin ≈`);
      }
    }
  }

  // The tour's captions: every figure with a unit must be on the stop's exhibit sheet, a
  // measured or reconstructed one must carry ≈, and a cited source must exist.
  for (const stop of tour) {
    const v = vehicles.find(x => x.id === stop.id);
    if (!v) { bad(`tour: la parada «${stop.preset}» nombra un expositor inexistente «${stop.id}»`); continue; }
    if (!v.presets.some(p => p.id === stop.preset)) bad(`tour: ${stop.id} no tiene la vista «${stop.preset}»`);
    if (stop.src && !sources[stop.src]) bad(`tour: ${stop.id}/${stop.preset} cita «${stop.src}», que no existe en SOURCES`);
    const sheet = [...v.specs.map(r => r.value), ...(v.approximations ?? [])].join(' · ');
    for (const u of stop.text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(?:m²|mm|m|tf|kN|in)(?![A-Za-z])/g)) {
      const [{ n, half }] = numbersIn(u[1]);
      const hits = numbersIn(sheet).some(x => Math.abs(x.n - n) <= half + 1e-9);
      const inMm = /mm/.test(u[0]) && numbersIn(sheet).some(x => Math.abs(x.n * 1000 - n) <= half * 1000 + 1e-6 || Math.abs(x.n - n / 1000) <= 0.0005 + 1e-9);
      if (!hits && !inMm) bad(`tour: ${stop.id}/${stop.preset} dice ${u[0]}, que la ficha de ${stop.id} no enuncia`);
      // Only this exhibit's own measured or reconstructed figures (the pad's for Starship):
      // Dragon's published 4 m is not Starlink's reconstructed 4.0 m wing.
      const own = [...Object.values(figures[stop.id] ?? {}), ...(stop.id === 'starship' ? Object.values(pad) : [])]
        .filter(f => f && typeof f === 'object' && (f.grade === 'B' || f.grade === 'D' || f.approx)).map(f => f.value);
      const approx = own.some(x => Math.abs(x - n) <= half + 1e-9);
      if (approx && !/≈\s*$/.test(stop.text.slice(0, u.index)) && !/reconstructed|estimate/.test(stop.text)) bad(`tour: ${stop.id}/${stop.preset} da ${u[0]}, una cifra reconstruida o estimada, sin ≈ ni salvedad`);
    }
  }

  // Retracted attributions: not in a figure, not in a sheet row, not in the source's own label.
  for (const r of RETRACTED) {
    const hit = (v) => r.values.some(x => Math.abs(v - x) < 1e-6);
    for (const [key, f] of Object.entries(pad)) if (f.ref === r.ref && hit(f.value)) bad(`pad.${key}: cita «${r.ref}» para ${r.what}, que esa fuente no da`);
    for (const [id, fs] of Object.entries(figures)) for (const [key, f] of Object.entries(fs)) {
      if (f && typeof f === 'object' && f.ref === r.ref && hit(f.value)) bad(`${id}.${key}: cita «${r.ref}» para ${r.what}, que esa fuente no da`);
    }
    for (const v of vehicles) for (const row of v.specs) {
      if (row.ref === r.ref && numbersIn(row.value).some(x => hit(x.n))) bad(`${v.id}: la fila «${row.label}» atribuye ${r.what} a «${r.ref}», que no la da`);
    }
    const label = sources[r.ref]?.label ?? '';
    if (numbersIn(label).some(x => hit(x.n))) bad(`SOURCES.${r.ref}: su etiqueta afirma ${r.what}, que la fuente no da`);
  }

  // README: the current-state contradictions that were actually found.
  let section = '';
  for (const line of readme.split('\n')) {
    const h = line.match(/^#{2,3}\s+(.*)/);
    if (h) { section = h[1].trim(); continue; }
    for (const rule of README_RULES) if (rule.bad(line, section)) bad(`README (${section || 'inicio'}): ${rule.name} — «${line.slice(0, 110)}…»`);
  }

  const table = readmeTable(readme);
  if (table.length !== vehicles.length) bad(`README: la tabla tiene ${table.length} filas y hay ${vehicles.length} expositores`);
  for (const v of vehicles) {
    const row = table.find(r => r.name.startsWith(v.name) || (v.id === 'starship' && r.name.startsWith('Starship')));
    if (!row) { bad(`README: sin fila para ${v.name}`); continue; }
    for (const key of figures[v.id]?.readme ?? []) {
      const val = figures[v.id][key].value;
      if (!states(row.size, val, true)) bad(`README: la fila de ${v.name} dice «${row.size}», que no enuncia ${val}`);
    }
  }
  return problems;
}

let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` ${detail}` : ''}`);
  if (!ok) failed++;
};

const base = { figures: FIGURES, pad: PAD_FIGURES, counts: COUNTS, vehicles: VEHICLES, sources: SOURCES, readme: README, builders: BUILDERS, tour: TOUR };
if (TOUR.length < 20) { console.log(`FAIL la visita guiada: solo se leyeron ${TOUR.length} paradas de main.js`); process.exit(1); }
const found = audit(base);
report(found.length === 0, 'Cifras, ficha y README coinciden, con fuente según su grado', found.length ? `\n  ${found.join('\n  ')}` : '');

// Negative controls: each is one realistic drift, and each must be caught.
const clone = (x) => structuredClone(x);
const withVehicles = (fn) => { const v = clone(VEHICLES); fn(v); return { ...base, vehicles: v }; };
const mutants = [
  ['README con otra altura del Dragon', { ...base, readme: README.replace('| 8,1 m |', '| 8,2 m |') }],
  ['fila de la ficha con otra cifra', withVehicles(v => { v.find(x => x.id === 'falconheavy').specs.find(r => r.fig === 'footprint').value = '12.4 m'; })],
  ['cifra publicada mostrada como ≈', withVehicles(v => { v.find(x => x.id === 'dragon').specs.find(r => r.fig === 'height').approx = true; })],
  ['cifra publicada citada a Wikipedia', withVehicles(v => { v.find(x => x.id === 'falcon9').specs.find(r => r.fig === 'height').source = 'wiki'; })],
  ['reconstrucción sin ≈', withVehicles(v => { delete v.find(x => x.id === 'roadster').specs.find(r => r.fig === 'breadth').approx; })],
  ['fila del pad con la zanja antigua', withVehicles(v => { const r = v.find(x => x.id === 'starship').specs.find(x => (x.pad ?? []).includes('trenchDepth')); r.value = r.value.replace('4.2 m deep', '8.2 m deep'); })],
  ['cabecera de la ficha escrita a mano', withVehicles(v => { v.find(x => x.id === 'falcon9').footprint = 3.7; })],
  ['cifra sin fila en la ficha', withVehicles(v => { for (const r of v.find(x => x.id === 'engines').specs) delete r.fig; })],
  ['recuento de losetas antiguo en la ficha', withVehicles(v => { const r = v.find(x => x.id === 'starship').specs.find(x => x.label === 'Heat shield'); r.value = r.value.replace('13,267', '13,132'); })],
  ['etiqueta 3-D con la zanja antigua', { ...base, builders: { ...BUILDERS, 'pad.js': BUILDERS['pad.js'] + "\n{ label: 'Bidirectional flame trench · 8.2 m', position: [0, 0, 0] }" } }],
  ['fuente inexistente', { ...base, figures: { ...FIGURES, dragon: { ...FIGURES.dragon, height: { ...FIGURES.dragon.height, ref: 'no_such_source' } } } }],
  // The round of 27 Sep 2026: each drift that was found, put back.
  ['torre atribuida otra vez al artículo que no da la altura', { ...base, pad: { ...PAD_FIGURES, towerH: { ...PAD_FIGURES.towerH, ref: 'se_pad2' } } }],
  ['fila de la ficha con la torre citada a ese artículo', withVehicles(v => { const r = v.find(x => x.id === 'starship').specs.find(x => (x.pad ?? []).includes('towerH')); r.ref = 'se_pad2'; })],
  ['cifra y fila de la torre citadas, de acuerdo entre sí, a ese artículo', (() => { const b = withVehicles(v => { const r = v.find(x => x.id === 'starship').specs.find(x => (x.pad ?? []).includes('towerH')); r.ref = 'se_pad2'; }); return { ...b, pad: { ...PAD_FIGURES, towerH: { ...PAD_FIGURES.towerH, ref: 'se_pad2' } } }; })()],
  ['etiqueta de la fuente que vuelve a prometer 474 ft', { ...base, sources: { ...SOURCES, se_pad2: { ...SOURCES.se_pad2, label: 'Space Explored — progress on the second Starship pad (474 ft tower)' } } }],
  ['etiqueta 3-D con la altura aproximada de la torre sin ≈', { ...base, builders: { ...BUILDERS, 'pad.js': BUILDERS['pad.js'].replace('tower · ≈480 ft + 10 ft rod', 'tower · 149.5 m') } }],
  ['README con las 13 132 losetas como cifra actual', { ...base, readme: README + '\n- El escudo lleva 13 132 losetas.\n' }],
  ['README con la celosía a 145–150 m sin la salvedad', { ...base, readme: README + '\nLa celosía llega a ≈145–150 m.\n' }],
  ['README con la torre en la fila «Citado»', { ...base, readme: README.replace('| Citado | brazos de unos 26 m', '| Citado | torre de 144,5 m (474 ft) · brazos de unos 26 m') }],
  ['README con el adaptador del Falcon 9 en las discrepancias', { ...base, readme: README.replace('### Discrepancias entre fuentes\n', '### Discrepancias entre fuentes\n\n- La diferencia se asigna al adaptador de carga bajo la cofia.\n') }],
  // Guided tour captions (28 Sep 2026).
  ['parada de la visita con la zanja antigua', { ...base, tour: TOUR.map(t => t.preset === 'trench' ? { ...t, text: t.text.replace('4.2 m', '8.2 m') } : t) }],
  ['parada de la visita con la torre sin ≈', { ...base, tour: TOUR.map(t => t.preset === 'site' ? { ...t, text: 'The tower is 149.5 m tall.' } : t) }],
  ['parada de la visita con una fuente inexistente', { ...base, tour: TOUR.map((t, i) => i === 0 ? { ...t, src: 'no_such_source' } : t) }],
  ['README con el Starlink un 8 % corto en las discrepancias', { ...base, readme: README.replace('### Discrepancias entre fuentes\n', '### Discrepancias entre fuentes\n\n- El modelo queda un 8 % por debajo en superficie.\n') }],
];
for (const [name, input] of mutants) {
  const p = audit(input);
  report(p.length > 0, `Control negativo: ${name}`, p.length ? `(${p[0]})` : '(no detectado)');
}
if (failed) process.exit(1);
