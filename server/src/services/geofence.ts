
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371e3;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

export interface GeofenceResult {
  distanceM: number;
  allowedM: number;
  within: boolean;
  source: "haversine";
}

export function effectiveGraceM(accuracyM: number, graceCapM: number): number {
  const acc = Number.isFinite(accuracyM) ? Math.max(accuracyM, 0) : 0;
  const cap = Number.isFinite(graceCapM) ? Math.max(graceCapM, 0) : 0;
  return Math.min(acc, cap);
}

export function haversineWithin(
  point: LatLng,
  fence: LatLng,
  radiusM: number,
  graceM: number
): GeofenceResult {
  const distanceM = distanceMeters(point, fence);
  const allowedM = radiusM + Math.max(graceM, 0);
  return { distanceM, allowedM, within: distanceM <= allowedM, source: "haversine" };
}
