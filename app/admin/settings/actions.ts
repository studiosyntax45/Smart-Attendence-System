"use client";

import { api } from "@/lib/api-client";
import { clampSetting } from "@/lib/gps-settings";

export interface SettingsResult {
  ok?: boolean;
  error?: string;
}


export async function updateGpsSettings(
  _prev: SettingsResult,
  formData: FormData
): Promise<SettingsResult> {
  const accuracyGraceM = clampSetting(
    "accuracyGraceM",
    Number(formData.get("accuracy_grace_m"))
  );
  const lateAfterMin = clampSetting(
    "lateAfterMin",
    Number(formData.get("late_after_min"))
  );
  const highAccuracy = formData.get("high_accuracy") === "on";

  try {
    await api.put("/gps-settings", { accuracyGraceM, lateAfterMin, highAccuracy });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update settings." };
  }
}
