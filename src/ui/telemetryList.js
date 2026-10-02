/**
 * The drive's and the flight's main readings as text, for a screen reader (audit of 2 Oct 2026,
 * H25): the instruments themselves are drawn on a canvas the reader cannot see. A description
 * list with each reading's name and unit, refreshed twice a second at most and in a fixed order;
 * not a live region (a value changing sixty times a second would never stop talking): the
 * reader reads it when the visitor asks, and the events go on announcing themselves in the
 * messages list beside it.
 */
export function createTelemetryList(parent, label, fields) {
  const dl = document.createElement('dl');
  dl.className = 'sr-only telemetry-list';
  dl.setAttribute('aria-label', label);
  const cells = {};
  for (const [key, name] of fields) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = name;
    dd.textContent = '—';
    dl.append(dt, dd);
    cells[key] = dd;
  }
  parent.appendChild(dl);
  let last = 0;
  return {
    element: dl,
    /** values: { key: text }; refreshed at most every 0.5 s unless forced. */
    update(values, force = false) {
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      if (!force && now - last < 500) return;
      last = now;
      for (const [k, v] of Object.entries(values)) if (cells[k] && cells[k].textContent !== v) cells[k].textContent = v;
    },
  };
}
