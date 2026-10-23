/**
 * Copies the Tesla Cybertruck's GLB from the cybertruck repository (a sibling checkout,
 * ../cybertruck, where Blender exports it: blender/scripts/export_web.py) into
 * assets/cybertruck/, and records where it came from: its size, SHA-256 and the commit that last
 * changed it there. The Cybertruck Lab loads the copy; tools/cybertruck-check.mjs checks that the
 * copy is the one recorded, so the site always says which version of the model it carries.
 * Run: node tools/cybertruck-sync.mjs [path to the cybertruck checkout]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_REPO = resolve(process.argv[2] ?? join(ROOT, '..', 'cybertruck'));
const SRC = 'web/models/cybertruck.glb';
const OUT = join(ROOT, 'assets', 'cybertruck');

const buf = await readFile(join(SRC_REPO, SRC));
const git = (...a) => execFileSync('git', ['-C', SRC_REPO, ...a], { encoding: 'utf8' }).trim();
// The commit that last changed the GLB, not the checkout's HEAD: a later documentation commit
// there does not make it another model. A copy with local changes is refused, since no commit
// would describe it.
if (git('status', '--porcelain', '--', SRC)) throw new Error(`${SRC} has uncommitted changes in ${SRC_REPO}`);
const [commit, date] = git('log', '-1', '--format=%H %cs', '--', SRC).split(' ');

const record = {
  file: 'cybertruck.glb',
  bytes: buf.length,
  sha256: createHash('sha256').update(buf).digest('hex'),
  source: { repo: 'alvarodesigns34/cybertruck', path: SRC, commit, date },
};
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'cybertruck.glb'), buf);
await writeFile(join(OUT, 'cybertruck.json'), JSON.stringify(record, null, 2) + '\n');
console.log(`assets/cybertruck/cybertruck.glb: ${(buf.length / 1e6).toFixed(2)} MB, ${record.sha256.slice(0, 12)}…, from ${commit.slice(0, 7)} (${date})`);
