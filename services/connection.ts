import * as SecureStore from "expo-secure-store";

import { ping } from "@/services/api";
import type { ServerUrlItem } from "@/types/auth";

export interface ServerConnectionState {
  activeUrl: string | null;
  activeLabel: string | null;
  serverUrls: ServerUrlItem[];
}

export interface PingResult {
  latencyMs: number;
  version: string;
}

export function normalizeServerUrl(rawUrl: string): string {
  let trimmed = rawUrl.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = `http://${trimmed}`;
  }
  return trimmed.replace(/\/+$/, "");
}

export async function getServerConnectionState(): Promise<ServerConnectionState> {
  const activeUrl = await SecureStore.getItemAsync("serverUrl");
  const activeLabel = await SecureStore.getItemAsync("serverUrlLabel");
  const rawUrls = await SecureStore.getItemAsync("serverUrls");

  let serverUrls: ServerUrlItem[] = [];
  if (rawUrls) {
    try {
      const parsed = JSON.parse(rawUrls);
      if (Array.isArray(parsed)) {
        serverUrls = parsed.filter(
          (item): item is ServerUrlItem =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof item.url === "string" &&
            item.url.trim().length > 0,
        );
      }
    } catch {
      // ignore json parse error
    }
  }

  if (activeUrl && serverUrls.length === 0) {
    serverUrls = [{ url: activeUrl, label: activeLabel ?? "server url" }];
    await SecureStore.setItemAsync("serverUrls", JSON.stringify(serverUrls));
  } else if (activeUrl && !serverUrls.some((item) => item.url === activeUrl)) {
    serverUrls.unshift({ url: activeUrl, label: activeLabel ?? "server url" });
    await SecureStore.setItemAsync("serverUrls", JSON.stringify(serverUrls));
  }

  return {
    activeUrl,
    activeLabel,
    serverUrls,
  };
}

export async function switchActiveServerUrl(
  url: string,
  label?: string | null,
): Promise<void> {
  await SecureStore.setItemAsync("serverUrl", url);
  if (label !== undefined) {
    if (label === null) {
      await SecureStore.deleteItemAsync("serverUrlLabel");
    } else {
      await SecureStore.setItemAsync("serverUrlLabel", label);
    }
  }
}

export async function addServerUrl(
  url: string,
  label?: string | null,
): Promise<ServerUrlItem[]> {
  const normalized = normalizeServerUrl(url);
  const state = await getServerConnectionState();

  if (
    state.serverUrls.some(
      (item) => item.url.toLowerCase() === normalized.toLowerCase(),
    )
  ) {
    throw new Error("server url already exists");
  }

  const cleanLabel = label?.trim() || null;
  const updated: ServerUrlItem[] = [
    ...state.serverUrls,
    { url: normalized, label: cleanLabel },
  ];

  await SecureStore.setItemAsync("serverUrls", JSON.stringify(updated));
  return updated;
}

export async function removeServerUrl(url: string): Promise<ServerUrlItem[]> {
  const state = await getServerConnectionState();
  if (state.activeUrl === url) {
    throw new Error("cannot remove active server url");
  }
  if (state.serverUrls.length <= 1) {
    throw new Error("at least one server url is required");
  }

  const updated = state.serverUrls.filter((item) => item.url !== url);
  await SecureStore.setItemAsync("serverUrls", JSON.stringify(updated));
  return updated;
}

export async function saveServerUrls(
  serverUrls: ServerUrlItem[],
): Promise<void> {
  await SecureStore.setItemAsync("serverUrls", JSON.stringify(serverUrls));
}

export async function pingServerUrl(url: string): Promise<PingResult> {
  const start = Date.now();
  const res = await ping(url);
  return {
    latencyMs: Date.now() - start,
    version: res.version,
  };
}

