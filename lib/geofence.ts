
import { distanceMeters, type LatLng } from "./geo";

export interface GeofenceResult {
  
  distanceM: number;
  
  allowedM: number;
  within: boolean;
  
  source: "postgis" | "haversine";
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

interface GeofenceCheckRow {
  distance_m: number | string | null;
  allowed_m: number | string | null;
  within: boolean | null;
}


export function checkSessionGeofence(args: {
  lat: number;
  lng: number;
  graceM: number;
  fence: { lat: number; lng: number; radiusM: number };
}): GeofenceResult {
  return haversineWithin(
    { lat: args.lat, lng: args.lng },
    { lat: args.fence.lat, lng: args.fence.lng },
    args.fence.radiusM,
    args.graceM
  );
}
void ({} as GeofenceCheckRow);
