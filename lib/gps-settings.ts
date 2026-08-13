
import { api } from "./api-client";

export interface GpsSettings {
  
  accuracyGraceM: number;
  
  lateAfterMin: number;
  
  highAccuracy: boolean;
}


export const DEFAULT_GPS_SETTINGS: GpsSettings = {
  accuracyGraceM: 25,
  lateAfterMin: 10,
  highAccuracy: true,
};

export const GPS_LIMITS = {
  accuracyGraceM: { min: 0, max: 500 },
  lateAfterMin: { min: 0, max: 240 },
} as const;

interface GpsSettingsRow {
  accuracyGraceM: number;
  lateAfterMin: number;
  highAccuracy: boolean;
}


export async function fetchGpsSettings(): Promise<GpsSettings> {
  try {
    const { settings } = await api.get<{ settings: GpsSettingsRow }>("/gps-settings");
    return {
      accuracyGraceM: settings.accuracyGraceM,
      lateAfterMin: settings.lateAfterMin,
      highAccuracy: settings.highAccuracy,
    };
  } catch {
    return DEFAULT_GPS_SETTINGS;
  }
}


export function clampSetting(
  key: keyof typeof GPS_LIMITS,
  value: number
): number {
  const { min, max } = GPS_LIMITS[key];
  if (!Number.isFinite(value)) return DEFAULT_GPS_SETTINGS[key];
  return Math.min(Math.max(Math.round(value), min), max);
}
