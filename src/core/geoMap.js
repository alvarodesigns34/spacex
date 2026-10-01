/**
 * Latitude and longitude ↔ the scene: the azimuthal equidistant map about the pad that the
 * X-15's flight (x15Fly.js trackToScene, x15Flight.js groundTrack) and the launch's globe
 * (plume.js FlightEarth) use, on a sphere of 6371 km. No three.js, so the checks can load it.
 */
import { LAUNCH_SITE } from '../data/gulf.js';

const R_EARTH = 6371000;
const D2R = Math.PI / 180;
const AZ = LAUNCH_SITE.azimuthDeg * D2R, SA = Math.sin(AZ), CA = Math.cos(AZ);
const LAT0 = LAUNCH_SITE.lat * D2R, LON0 = LAUNCH_SITE.lon * D2R;

/** Web Mercator tile coordinates at zoom z → latitude and longitude (radians). */
export function tileToGeo(tx, ty, z) {
  const n = 2 ** z;
  return [Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n))), (tx / n) * 2 * Math.PI - Math.PI];
}

/**
 * Latitude and longitude (radians) → the scene's (dx, dz) from the pad: distance and bearing
 * on the sphere, as north and east, then turned by the launch azimuth (x15Fly.js trackToScene).
 */
export function geoToScene(lat, lon) {
  const dl = lon - LON0;
  const c = Math.acos(Math.min(1, Math.sin(LAT0) * Math.sin(lat) + Math.cos(LAT0) * Math.cos(lat) * Math.cos(dl)));
  if (c < 1e-12) return [0, 0];
  const b = Math.atan2(Math.sin(dl) * Math.cos(lat), Math.cos(LAT0) * Math.sin(lat) - Math.sin(LAT0) * Math.cos(lat) * Math.cos(dl));
  const north = R_EARTH * c * Math.cos(b), east = R_EARTH * c * Math.sin(b);
  return [east * SA + north * CA, east * CA - north * SA];
}

