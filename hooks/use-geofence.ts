"use client";

import { useEffect, useState } from "react";
import { distanceMeters, type LatLng } from "@/lib/geo";
import { effectiveGraceM } from "@/lib/geofence";

export type GeofenceState =
  | { status: "unsupported" }
  | { status: "seeking" }
  | { status: "denied"; message: string }
  | {
      status: "inside" | "outside";
      distance: number;
      accuracy: number;
      coords: LatLng;
      
      stale?: boolean;
    };


export function useGeofence(
  center: LatLng,
  radiusM: number,
  highAccuracy: boolean = true,
  accuracyGraceM: number = 0
): GeofenceState {
  const [state, setState] = useState<GeofenceState>({ status: "seeking" });

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({ status: "unsupported" });
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const d = distanceMeters(center, coords);
        const allowed = radiusM + effectiveGraceM(pos.coords.accuracy, accuracyGraceM);
        setState({
          status: d <= allowed ? "inside" : "outside",
          distance: Math.round(d),
          accuracy: Math.round(pos.coords.accuracy),
          coords,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({
            status: "denied",
            message:
              "Location permission denied — allow location access to mark attendance.",
          });
          return;
        }
        setState((prev) =>
          prev.status === "inside" || prev.status === "outside"
            ? { ...prev, stale: true }
            : { status: "seeking" }
        );
      },
      { enableHighAccuracy: highAccuracy, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [center.lat, center.lng, radiusM, highAccuracy, accuracyGraceM]);

  return state;
}
