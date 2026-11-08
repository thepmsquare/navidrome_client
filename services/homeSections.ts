import * as SecureStore from "expo-secure-store";

import { HOME_SECTIONS, type HomeSectionDefinition } from "@/components/home";
import { parseHomeSections } from "@/services/migration/settings";
import type { HomeSectionConfig } from "@/types";

export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
  { id: "most_played", visible: true },
  { id: "random_tracks", visible: true },
  { id: "recently_played", visible: true },
  { id: "random_albums", visible: true },
  { id: "newly_added_releases", visible: true },
  { id: "recently_released", visible: true },
];

export const HOME_SECTION_LABELS: Record<string, string> = {
  most_played: "most played",
  random_tracks: "random tracks",
  recently_played: "recently played",
  random_albums: "random albums",
  newly_added_releases: "newly added releases",
  recently_released: "recently released",
};

export async function getHomeSections(): Promise<HomeSectionConfig[]> {
  try {
    const raw = await SecureStore.getItemAsync("home_sections");
    const parsed = parseHomeSections(raw);
    if (parsed && parsed.length > 0) {
      // Ensure all current sections are represented (append missing ones)
      const existingIds = new Set(parsed.map((s) => s.id));
      const completeList = [...parsed];
      for (const def of DEFAULT_HOME_SECTIONS) {
        if (!existingIds.has(def.id)) {
          completeList.push({ ...def });
        }
      }
      return completeList;
    }
  } catch (err) {
    console.error("failed to read home_sections from secure store:", err);
  }
  return DEFAULT_HOME_SECTIONS.map((s) => ({ ...s }));
}

export async function saveHomeSections(
  sections: HomeSectionConfig[],
): Promise<void> {
  await SecureStore.setItemAsync("home_sections", JSON.stringify(sections));
}

export function resolveHomeSections(
  configs: HomeSectionConfig[] | null | undefined,
): HomeSectionDefinition[] {
  if (!configs || configs.length === 0) {
    return HOME_SECTIONS;
  }

  const sectionMap = new Map<string, HomeSectionDefinition>(
    HOME_SECTIONS.map((sec) => [sec.id, sec]),
  );

  const resolved: HomeSectionDefinition[] = [];
  const seen = new Set<string>();

  for (const config of configs) {
    if (seen.has(config.id)) continue;
    seen.add(config.id);
    const section = sectionMap.get(config.id);
    if (section && config.visible !== false) {
      resolved.push(section);
    }
  }

  // Include any new sections not present in configs (default visible: true)
  for (const section of HOME_SECTIONS) {
    if (!seen.has(section.id)) {
      resolved.push(section);
    }
  }

  return resolved;
}

