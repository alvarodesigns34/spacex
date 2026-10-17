/**
 * Starts a download early and hands the bytes to whoever needs them later.
 *
 * The three Blender assets are ~100 MB between them, and the start-up used to fetch each one
 * only when its exhibit's turn came, after the procedural textures (seconds of main thread
 * with the network idle) and after the exhibits before it. Asking for all of them at the
 * start overlaps the download with that work. The bytes are the same, parsed the same way
 * by the same loader: only the moment of the request moves.
 */

const pending = new Map();

/** Starts (or joins) the download of `url`; resolves to its ArrayBuffer, rejects if the request fails. */
export function prefetch(url) {
  const key = String(url);
  let bytes = pending.get(key);
  if (!bytes) {
    bytes = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`${res.status}`);
      return res.arrayBuffer();
    });
    // A failed early request is reported to whoever takes it, not to the console as unhandled.
    bytes.catch(() => {});
    pending.set(key, bytes);
  }
  return bytes;
}

/** The bytes of `url`, started now if nobody has asked yet. The entry is dropped, so the buffer is not kept once parsed. */
export function takeBytes(url) {
  const bytes = prefetch(url);
  pending.delete(String(url));
  return bytes;
}
