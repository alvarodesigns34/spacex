/** Regression check: prove the profiler rejects the old fullscreen-only counter behavior.
 * Run separately from profile.mjs (both use port 8803). A temporary sibling preserves its
 * imports and root directory; it is removed even when the child fails or times out.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const source = await readFile(new URL('./profile.mjs', import.meta.url), 'utf8');
const needle = 'renderer.info.autoReset = false;';
assert.equal(source.split(needle).length, 2, 'expected one counter instrumentation site');
const probe = new URL(`./.profile-counter-probe-${process.pid}.mjs`, import.meta.url);
try {
  await writeFile(probe, source.replace(needle, 'renderer.info.autoReset = true;'));
  await assert.rejects(
    promisify(execFile)(process.execPath, [fileURLToPath(probe), '--quality', 'low',
      '--only', 'overview', '--frames', '1', '--gcframes', '1'], { timeout: 240000 }),
    error => {
      assert.equal(error.code, 1, 'probe must fail normally, not time out');
      assert.match(error.stderr, /Invalid frame counters/);
      return true;
    },
  );
  console.log('PASS: restoring renderer.info.autoReset is rejected by the frame-counter guard.');
} finally {
  await unlink(probe).catch(() => {});
}
