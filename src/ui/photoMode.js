/**
 * Photo mode (key O): frame a picture and save it, then put everything back exactly.
 *
 * What it changes, and nothing else: the tone mapping (filmic or neutral), the camera's field of view (in the free cameras only: the
 * drives and the rides own theirs), the exposure compensation in stops on top of the metering
 * (environment.js setExposureBias), the Sun's elevation and azimuth (environment.js setSun, the
 * same path as the Sun slider), and whether the interface shows. Every value is read when the
 * mode opens; Reset and closing restore those exact values, not defaults.
 *
 * Save writes the frame as a PNG: the main loop hands over the canvas right after it has drawn it
 * (requestShot), because without preserveDrawingBuffer a read at any other moment returns a
 * cleared buffer. Labels and rulers are DOM, not in the canvas: the picture is the scene alone.
 *
 * No depth of field and no motion blur: the brief asks for none by default, and a fake one would
 * blur exactly the detail the models are built to show.
 */
export function createPhotoMode({ env, camera, rig, hud, requestShot, onClose }) {
  const root = document.createElement('div');
  root.className = 'photo hidden';
  root.id = 'photo';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Photo mode');
  root.innerHTML = `
    <div class="photo-head"><span class="photo-title">Photo mode</span><kbd>O</kbd></div>
    <label class="photo-row">Field of view <output id="ph-fov-v"></output>
      <input type="range" id="ph-fov" min="10" max="90" step="1"></label>
    <label class="photo-row">Exposure <output id="ph-ev-v"></output>
      <input type="range" id="ph-ev" min="-2" max="2" step="0.1"></label>
    <label class="photo-row">Sun elevation <output id="ph-el-v"></output>
      <input type="range" id="ph-el" step="1"></label>
    <label class="photo-row">Sun azimuth <output id="ph-az-v"></output>
      <input type="range" id="ph-az" min="0" max="359" step="1"></label>
    <label class="photo-row">Tone <select id="ph-tone"><option value="filmic">Filmic (cinematic)</option><option value="neutral">Neutral (inspection)</option></select></label>
    <label class="photo-check"><input type="checkbox" id="ph-ui"> Hide interface</label>
    <div class="photo-btns">
      <button type="button" class="tool-btn" id="ph-save">Save PNG</button>
      <button type="button" class="tool-btn" id="ph-reset">Reset</button>
      <button type="button" class="tool-btn" id="ph-close">Close</button>
    </div>
    <p class="photo-note">Free cameras only for the field of view. No depth of field or motion blur.</p>`;
  document.body.append(root);
  const $ = (id) => root.querySelector(`#${id}`);
  const fov = $('ph-fov'), ev = $('ph-ev'), el = $('ph-el'), az = $('ph-az'), ui = $('ph-ui'), tone = $('ph-tone');
  el.min = String(env.SUN_MIN); el.max = String(env.SUN_MAX);

  let open = false, saved = null;
  const fovFree = () => rig.mode !== undefined && camera.isPerspectiveCamera;

  function show() {
    $('ph-fov-v').textContent = `${Number(fov.value).toFixed(0)}°`;
    const e = Number(ev.value);
    $('ph-ev-v').textContent = `${e > 0 ? '+' : ''}${e.toFixed(1)} EV`;
    $('ph-el-v').textContent = `${Number(el.value).toFixed(0)}°`;
    $('ph-az-v').textContent = `${Number(az.value).toFixed(0)}°`;
  }
  function apply() {
    if (fovFree()) { camera.fov = Number(fov.value); camera.updateProjectionMatrix(); }
    env.setExposureBias(Number(ev.value));
    if (env.toneMappingKind !== tone.value) env.setToneMapping(tone.value);
    env.setSun(Number(el.value), Number(az.value));
    const slider = document.getElementById('sun');
    if (slider) slider.value = String(Math.round(Number(el.value)));
    show();
  }
  function setHidden(on) {
    ui.checked = on;
    // The interface and the labels' layer; the photo panel itself stays, faded, to undo it.
    document.body.classList.toggle('photo-ui-off', on);
  }
  function load(v) {
    fov.value = String(v.fov); ev.value = String(v.ev); el.value = String(v.elev); az.value = String(v.azim); tone.value = v.tone;
  }

  function openMode() {
    if (open) return;
    const sun = env.sunAngles;
    saved = { fov: camera.fov, ev: env.exposureBias, elev: sun.elev, azim: ((sun.azim % 360) + 360) % 360, tone: env.toneMappingKind };
    load(saved);
    fov.disabled = !fovFree();
    open = true;
    root.classList.remove('hidden');
    show();
    fov.focus();
  }
  /** Back to the values the mode found, exactly. */
  function reset() {
    if (!saved) return;
    load(saved);
    apply();
    setHidden(false);
  }
  function close() {
    if (!open) return;
    reset();
    open = false;
    saved = null;
    root.classList.add('hidden');
    onClose?.();
  }

  for (const input of [fov, ev, el, az]) input.addEventListener('input', apply);
  tone.addEventListener('change', apply);
  ui.addEventListener('change', () => setHidden(ui.checked));
  $('ph-reset').addEventListener('click', reset);
  $('ph-close').addEventListener('click', close);
  $('ph-save').addEventListener('click', () => {
    requestShot((url) => {
      const a = document.createElement('a');
      const t = new Date();
      const stamp = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}-${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}${String(t.getSeconds()).padStart(2, '0')}`;
      a.href = url; a.download = `vehicle-center-${stamp}.png`;
      document.body.append(a); a.click(); a.remove();
      hud?.notice?.('Picture saved.', 2500);
    });
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  });

  return {
    get open() { return open; },
    toggle() { if (open) close(); else openMode(); },
    show: openMode, close, reset,
    /** For the checks: the values the mode will restore. */
    get saved() { return saved; },
    dispose() { root.remove(); },
  };
}
