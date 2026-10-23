/**
 * The Cybertruck Lab's asset against its contract, without a browser: the GLB is the copy
 * tools/cybertruck-sync.mjs recorded (size and SHA-256), it asks for no extension the centre
 * cannot decode, and every part carries what the Lab reads from it (system, staged explosion,
 * fidelity grade, Spanish label) under a tree whose parents have no rotation (the explosion
 * directions are in the parent's frame: cybertruck/CLAUDE.md). The Draco decoder and Reflector it
 * needs are three r170's own files, byte for byte.
 * Run: node tools/cybertruck-check.mjs
 */
import { registerHooks } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  return next(specifier, context);
} });
const { readGlb } = await import('./glb.mjs');

let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const at = (p) => new URL('../' + p, import.meta.url);
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// ---- The vendored files, against three@0.170.0 from npm (hashes taken from the package).
{
  const R170 = {
    'loaders/DRACOLoader.js': '8a90b39b6c0d7faa70410cdd19348029a83a9f2d5f71e11b665a5f48330a4c72',
    'objects/Reflector.js': '012ecf98f5fc9bd262871e33d79392a25c04c2573ed68852eb3b8d2d39f9808b',
    'libs/draco/README.md': '8b9d277bf5743f4ce8d85d63c16690071b53f81796e877d4d395af943bde02a0',
    'libs/draco/gltf/draco_decoder.wasm': 'a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac',
    'libs/draco/gltf/draco_wasm_wrapper.js': '8bb2952d2ba7d67e1414f8df819410cb0434a666be53f671fff75f68843d76f6',
    // The fallback DRACOLoader takes where WebAssembly is unavailable.
    'libs/draco/gltf/draco_decoder.js': '8625489da79a805f4f2a7d511c3e52d8b4085608a9d2a4d5f4f9de5db0aea04f',
  };
  const bad = [];
  for (const [f, h] of Object.entries(R170)) {
    const got = await readFile(at('vendor/three/examples/jsm/' + f)).then(sha, () => 'missing');
    if (got !== h) bad.push(`${f} (${got === 'missing' ? 'missing' : 'differs'})`);
  }
  report(!bad.length, 'vendor: DRACOLoader, el decodificador Draco y Reflector son los de three r170, byte a byte', bad.length ? bad.join(', ') : `${Object.keys(R170).length} archivos`);
}

// ---- The copy is the one recorded.
const rec = JSON.parse(await readFile(at('assets/cybertruck/cybertruck.json'), 'utf8'));
const buf = await readFile(at('assets/cybertruck/' + rec.file));
report(buf.length === rec.bytes && sha(buf) === rec.sha256, 'el GLB es la copia anotada por cybertruck-sync (tamaño y SHA-256)',
  `${(buf.length / 1e6).toFixed(2)} MB · ${rec.source.repo}@${rec.source.commit.slice(0, 7)} (${rec.source.date})`);

const glb = await readGlb(at('assets/cybertruck/' + rec.file));
const { json } = glb;

// ---- Extensions: what it requires, the centre's three r170 decodes (Draco through the vendored
// decoder; texture transforms and WebP natively).
{
  const CAN = new Set(['KHR_draco_mesh_compression', 'KHR_texture_transform', 'EXT_texture_webp']);
  const extra = (json.extensionsRequired ?? []).filter(e => !CAN.has(e));
  report(!extra.length, 'extensiones requeridas que el centro sabe leer', extra.length ? `sin soporte: ${extra.join(', ')}` : (json.extensionsRequired ?? []).join(', '));
}

// ---- The tree and the parts.
{
  const roots = json.scenes[json.scene ?? 0].nodes.map(i => json.nodes[i]);
  const root = roots[0];
  report(roots.length === 1 && root.name === 'CYBERTRUCK_ROOT', 'una sola raíz, CYBERTRUCK_ROOT', roots.map(r => r.name).join(', '));
  const parts = json.nodes.filter(n => n !== root);
  const names = json.nodes.map(n => n.name);
  report(new Set(names).size === names.length, 'nombres de nodo únicos (el Lab busca las piezas por nombre)', `${names.length} nodos`);

  const STAGES = Object.keys(root.extras?.explode_stage_windows ?? {}).map(Number);
  const wrong = [];
  for (const n of parts) {
    const x = n.extras ?? {}, d = x.explode_dir ?? [];
    const len = Math.hypot(...d);
    if (typeof x.system !== 'string' || !x.system) wrong.push(`${n.name}: system`);
    else if (!STAGES.includes(x.explode_stage)) wrong.push(`${n.name}: explode_stage ${x.explode_stage}`);
    else if (d.length !== 3 || Math.abs(len - 1) > 1e-3) wrong.push(`${n.name}: explode_dir`);
    else if (!(x.explode_dist > 0)) wrong.push(`${n.name}: explode_dist`);
    else if (!['V', 'R', 'A'].includes(x.fidelity)) wrong.push(`${n.name}: fidelity ${x.fidelity}`);
    else if (typeof x.label_es !== 'string' || !x.label_es) wrong.push(`${n.name}: label_es`);
  }
  report(STAGES.length === 6 && STAGES.every((s, i) => s === i + 1) && !wrong.length,
    'cada pieza lleva sistema, etapa (1–6), dirección unitaria y distancia de explosión, grado de fidelidad (V/R/A) y etiqueta',
    wrong.length ? `${wrong.length} mal: ${wrong.slice(0, 4).join('; ')}` : `${parts.length} piezas, etapas ${STAGES.join(' ')}`);
  report(parts.length === 1138, 'las 1.138 piezas de la versión 4.2 del Cybertruck', `${parts.length}`);

  const rotated = json.nodes.filter(n => n.children?.length && n.rotation && Math.abs(n.rotation[3]) < 1 - 1e-9);
  report(!rotated.length, 'los nodos con hijos no tienen rotación (la explosión va en el marco del padre, que debe coincidir con el del mundo)',
    rotated.length ? rotated.slice(0, 5).map(n => n.name).join(', ') : 'ninguno');
  const fid = { V: 0, R: 0, A: 0 }; for (const n of parts) fid[n.extras.fidelity]++;
  report(true, 'fidelidad declarada en el modelo', `Verificado ${fid.V} · Reconstruido ${fid.R} · Aproximado ${fid.A}`);
}

// ---- The deploy publishes assets/ and vendor/ (the GLB and its decoder reach the site).
{
  const wf = await readFile(at('.github/workflows/pages.yml'), 'utf8');
  const cp = /cp -r[^\n]*/.exec(wf)?.[0] ?? '';
  report(/\bassets\b/.test(cp) && /\bvendor\b/.test(cp), 'el despliegue publica assets/ y vendor/', cp.trim() || 'sin copia');
  const wasm = await stat(at('vendor/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm')).catch(() => null);
  report(!!wasm, 'el decodificador WebAssembly está en vendor/', wasm ? `${(wasm.size / 1024).toFixed(0)} KB` : 'falta');
}

process.exit(failed ? 1 : 0);
