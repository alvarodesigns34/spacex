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
 *  - the vehicle table at the top of the README must state each figure it is meant to.
 *
 * Mutations of the inputs must fail, so the gate cannot pass by checking nothing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { FIGURES, PAD_FIGURES, COUNTS, GRADES } = await import('../src/data/figures.js');
const { VEHICLES, SOURCES } = await import('../src/data/specs.js');
const README = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');

const SOURCE_FOR_GRADE = {
  A: ['spacex', 'official', 'nasa'],
  C: ['wiki', 'press'],
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

export function audit({ figures, pad, counts, vehicles, sources, readme }) {
  const problems = [];
  const bad = (msg) => problems.push(msg);
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
    for (const key of ['height', 'footprint', 'breadth', 'mirrors']) {
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
  for (const [id, list] of Object.entries(counts)) for (const c of list) graded(`${id}.${c.key}`, c);

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

const base = { figures: FIGURES, pad: PAD_FIGURES, counts: COUNTS, vehicles: VEHICLES, sources: SOURCES, readme: README };
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
  ['fuente inexistente', { ...base, figures: { ...FIGURES, dragon: { ...FIGURES.dragon, height: { ...FIGURES.dragon.height, ref: 'no_such_source' } } } }],
];
for (const [name, input] of mutants) {
  const p = audit(input);
  report(p.length > 0, `Control negativo: ${name}`, p.length ? `(${p[0]})` : '(no detectado)');
}
if (failed) process.exit(1);
