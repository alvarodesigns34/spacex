/**
 * Start-up helpers: waiting for a frame (the loading card repaints between steps) and the
 * message shown when the browser has no WebGL 2. Moved out of main.js unchanged.
 */

export const nextFrame = () => new Promise(r => requestAnimationFrame(r));

/**
 * Without WebGL 2 the WebGLRenderer constructor throws, the loading card freezes on
 * "Starting…" and the only explanation is in the console. The <noscript> covers a browser with
 * scripting off; this covers the commoner case of scripting on and no WebGL 2 — an old
 * browser, a locked-down machine, or hardware acceleration switched off, which is a setting
 * the visitor can go and change if someone tells them that is what is wrong.
 */
export function reportNoWebGL2() {
  const card = document.querySelector('#loading .loading-card');
  if (!card) return;
  card.querySelector('.loading-title').textContent = 'This experience needs WebGL 2';
  card.querySelector('.loading-track')?.remove();
  card.querySelector('.loading-text').textContent =
    'Your browser did not provide a WebGL 2 context. Enabling hardware acceleration in the '
    + 'browser settings, or opening the page in an up-to-date Chrome, Edge, Firefox or Safari, '
    + 'is usually enough.';
}
