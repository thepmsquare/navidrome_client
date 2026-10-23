import * as Haptics from "expo-haptics";

import { getHapticsEnabled } from "@/services/db";

export async function triggerHapticSelection(): Promise<void> {
  try {
    if (!getHapticsEnabled()) return;
    await Haptics.selectionAsync();
  } catch {}
}

export async function triggerHapticImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
): Promise<void> {
  try {
    if (!getHapticsEnabled()) return;
    await Haptics.impactAsync(style);
  } catch {}
}
