import { getLyricsBySongId } from "@/services/api";
import {
  getLyricsCacheEntrySync,
  getLyricsModeSetting,
  getSongById,
  setLyricsModeSetting,
  upsertLyricsCacheEntry,
} from "@/services/db";
import { fetchLyricsFromLrclib } from "@/services/lrclib";
import {
  LyricsCacheRow,
  LyricsCacheStatus,
  LyricsMode,
  LyricsSource,
  LyricsTrackMetadata,
  NormalizedLyrics,
  NormalizedLyricsLine,
  StructuredLyrics,
} from "@/types";
import {
  DEFAULT_LYRICS_MODE,
  LYRICS_INSTRUMENTAL_CACHE_TTL_MS,
  LYRICS_NEGATIVE_CACHE_TTL_MS,
} from "@/utils/constants";

let activeLyricsMode: LyricsMode | null = null;
const lyricsModeListeners = new Set<(mode: LyricsMode) => void>();

export function getLyricsMode(): LyricsMode {
  if (!activeLyricsMode) {
    activeLyricsMode = getLyricsModeSetting();
  }
  return activeLyricsMode;
}

export function setLyricsMode(mode: LyricsMode): void {
  activeLyricsMode = mode;
  setLyricsModeSetting(mode);
  for (const listener of lyricsModeListeners) {
    try {
      listener(mode);
    } catch (e) {
      console.error("error in lyrics mode listener:", e);
    }
  }
}

export function resetLyricsMode(): void {
  activeLyricsMode = DEFAULT_LYRICS_MODE;
  for (const listener of lyricsModeListeners) {
    try {
      listener(DEFAULT_LYRICS_MODE);
    } catch (e) {
      console.error("error in lyrics mode listener:", e);
    }
  }
}

export function subscribeLyricsMode(
  listener: (mode: LyricsMode) => void,
): () => void {
  lyricsModeListeners.add(listener);
  listener(getLyricsMode());
  return () => {
    lyricsModeListeners.delete(listener);
  };
}

/**
 * Checks if lyrics have valid timestamped lines.
 */
export function isSyncedLyrics(
  lyrics: NormalizedLyrics | null | undefined,
): boolean {
  if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) return false;
  return Boolean(
    lyrics.synced && lyrics.lines.some((l) => typeof l.startMs === "number"),
  );
}

/**
 * Pure function to pick the winning lyrics according to the selected mode.
 * - 'file_only': use only server lyrics.
 * - 'file_first': use server lyrics; go online when server lyrics are missing OR unsynced.
 *   If online returns synced lyrics, they win over unsynced file lyrics.
 *   If online returns nothing or plain text, keep file lyrics.
 *   If file lyrics are missing, use online lyrics.
 *   A synced file lyric is never replaced by online in 'file_first'.
 * - 'online_first': use online lyrics (synced or plain); fall back to server if online has nothing.
 */
export function pickLyrics(
  mode: LyricsMode,
  serverLyrics: NormalizedLyrics | null,
  onlineLyrics: NormalizedLyrics | null,
  serverStatus?: LyricsCacheStatus,
  onlineStatus?: LyricsCacheStatus,
): NormalizedLyrics | null {
  if (mode === "file_only") {
    if (serverStatus === "instrumental") return null;
    return serverLyrics;
  }

  if (mode === "file_first") {
    if (serverStatus === "instrumental") return null;

    if (serverLyrics && isSyncedLyrics(serverLyrics)) {
      return serverLyrics;
    }

    if (serverLyrics && !isSyncedLyrics(serverLyrics)) {
      if (onlineLyrics && isSyncedLyrics(onlineLyrics)) {
        return onlineLyrics;
      }
      return serverLyrics;
    }

    // Server lyrics are missing
    if (onlineStatus === "instrumental") return null;
    return onlineLyrics;
  }

  if (mode === "online_first") {
    if (onlineStatus === "instrumental") return null;

    if (onlineLyrics) {
      return onlineLyrics;
    }

    // Fall back to server
    if (serverStatus === "instrumental") return null;
    return serverLyrics;
  }

  return serverLyrics;
}

/**
 * Pure function to determine whether an online lookup is required.
 */
export function needsOnlineLookup(
  mode: LyricsMode,
  serverLyrics: NormalizedLyrics | null,
  serverStatus?: LyricsCacheStatus,
): boolean {
  if (mode === "file_only") {
    return false;
  }

  if (mode === "online_first") {
    return true;
  }

  if (mode === "file_first") {
    if (serverStatus === "instrumental") {
      return false;
    }
    if (serverLyrics && isSyncedLyrics(serverLyrics)) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Normalizes an individual OpenSubsonic StructuredLyrics entry into a clean NormalizedLyrics object.
 */
export function normalizeLyricsEntry(
  entry: StructuredLyrics,
): NormalizedLyrics {
  const isSynced = Boolean(entry.synced);
  const rawLines = entry.line ?? [];
  const lines: NormalizedLyricsLine[] = rawLines.map((l) => ({
    text: l.value ?? "",
    ...(typeof l.start === "number" ? { startMs: l.start } : {}),
  }));

  return {
    synced: isSynced,
    ...(entry.lang ? { lang: entry.lang } : {}),
    ...(typeof entry.offset === "number" ? { offsetMs: entry.offset } : {}),
    lines,
  };
}

/**
 * Selects the best lyrics entry from a list of structured lyrics.
 * Prioritizes a synced entry if several exist, otherwise takes the first valid entry.
 * Returns null if no valid lyrics with lines exist.
 */
export function selectBestLyrics(
  entries: StructuredLyrics[],
): NormalizedLyrics | null {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  const candidateEntries = entries.filter((e) => {
    const lines = e.line ?? [];
    return lines.length > 0;
  });

  if (candidateEntries.length === 0) {
    return null;
  }

  const syncedEntry = candidateEntries.find((e) => Boolean(e.synced));
  const best = syncedEntry ?? candidateEntries[0];

  return normalizeLyricsEntry(best);
}

/**
 * Parses cached lyrics row JSON into NormalizedLyrics.
 */
export function parseCachedRowLyrics(
  row: LyricsCacheRow | null,
): NormalizedLyrics | null {
  if (!row || row.status !== "found" || !row.linesJson) {
    return null;
  }

  try {
    const lines = JSON.parse(row.linesJson) as NormalizedLyricsLine[];
    return {
      synced: Boolean(row.synced),
      ...(row.lang ? { lang: row.lang } : {}),
      ...(typeof row.offsetMs === "number" ? { offsetMs: row.offsetMs } : {}),
      lines,
    };
  } catch {
    return null;
  }
}

/**
 * Synchronous accessor for cached lyrics applying the active mode.
 * Used during component render to eliminate delay for cached songs.
 */
export function getCachedLyricsSync(
  songId: string | null | undefined,
  mode?: LyricsMode,
): NormalizedLyrics | null {
  if (!songId || typeof songId !== "string" || songId.trim() === "") {
    return null;
  }

  const activeMode = mode ?? getLyricsMode();
  const serverRow = getLyricsCacheEntrySync(songId, "server");
  const serverLyrics = parseCachedRowLyrics(serverRow);
  const serverStatus = serverRow?.status;

  if (activeMode === "file_only") {
    return serverStatus === "instrumental" ? null : serverLyrics;
  }

  const onlineRow = getLyricsCacheEntrySync(songId, "lrclib");
  const onlineLyrics = parseCachedRowLyrics(onlineRow);
  const onlineStatus = onlineRow?.status;

  return pickLyrics(
    activeMode,
    serverLyrics,
    onlineLyrics,
    serverStatus,
    onlineStatus,
  );
}

async function resolveServerLyrics(
  songId: string,
  now: number,
  negativeTtlMs: number,
): Promise<{ lyrics: NormalizedLyrics | null; status: LyricsCacheStatus }> {
  const cachedRow = getLyricsCacheEntrySync(songId, "server");
  if (cachedRow) {
    if (cachedRow.status === "found" && cachedRow.linesJson) {
      const parsed = parseCachedRowLyrics(cachedRow);
      if (parsed) return { lyrics: parsed, status: "found" };
    } else if (cachedRow.status === "none") {
      if (now - cachedRow.fetchedAt < negativeTtlMs) {
        return { lyrics: null, status: "none" };
      }
    } else if (cachedRow.status === "instrumental") {
      return { lyrics: null, status: "instrumental" };
    }
  }

  try {
    const rawLyrics = await getLyricsBySongId(songId);
    const normalized = selectBestLyrics(rawLyrics);

    if (normalized && normalized.lines.length > 0) {
      upsertLyricsCacheEntry({
        songId,
        source: "server",
        status: "found",
        synced: normalized.synced,
        lang: normalized.lang ?? null,
        offsetMs: normalized.offsetMs ?? null,
        linesJson: JSON.stringify(normalized.lines),
        fetchedAt: now,
      });
      return { lyrics: normalized, status: "found" };
    }

    upsertLyricsCacheEntry({
      songId,
      source: "server",
      status: "none",
      synced: 0,
      lang: null,
      offsetMs: null,
      linesJson: null,
      fetchedAt: now,
    });
    return { lyrics: null, status: "none" };
  } catch {
    return { lyrics: null, status: "none" };
  }
}

async function resolveOnlineLyrics(
  songId: string,
  trackMeta: LyricsTrackMetadata,
  now: number,
  negativeTtlMs: number,
  instrumentalTtlMs: number,
): Promise<{ lyrics: NormalizedLyrics | null; status: LyricsCacheStatus }> {
  const cachedRow = getLyricsCacheEntrySync(songId, "lrclib");
  if (cachedRow) {
    if (cachedRow.status === "found" && cachedRow.linesJson) {
      const parsed = parseCachedRowLyrics(cachedRow);
      if (parsed) return { lyrics: parsed, status: "found" };
    } else if (cachedRow.status === "none") {
      if (now - cachedRow.fetchedAt < negativeTtlMs) {
        return { lyrics: null, status: "none" };
      }
    } else if (cachedRow.status === "instrumental") {
      if (now - cachedRow.fetchedAt < instrumentalTtlMs) {
        return { lyrics: null, status: "instrumental" };
      }
    }
  }

  // Duration check: if undefined, 0, or NaN, skip LRCLIB lookup entirely
  const duration = trackMeta.duration;
  if (typeof duration !== "number" || isNaN(duration) || duration <= 0) {
    return { lyrics: null, status: "none" };
  }

  try {
    const result = await fetchLyricsFromLrclib(trackMeta);
    if (!result || result.kind === "unavailable") {
      return { lyrics: null, status: "none" };
    }

    if (result.kind === "found") {
      upsertLyricsCacheEntry({
        songId,
        source: "lrclib",
        status: "found",
        synced: result.lyrics.synced,
        lang: result.lyrics.lang ?? null,
        offsetMs: result.lyrics.offsetMs ?? null,
        linesJson: JSON.stringify(result.lyrics.lines),
        fetchedAt: now,
      });
      return { lyrics: result.lyrics, status: "found" };
    }

    if (result.kind === "instrumental") {
      upsertLyricsCacheEntry({
        songId,
        source: "lrclib",
        status: "instrumental",
        synced: 0,
        lang: null,
        offsetMs: null,
        linesJson: null,
        fetchedAt: now,
      });
      return { lyrics: null, status: "instrumental" };
    }

    if (result.kind === "none") {
      upsertLyricsCacheEntry({
        songId,
        source: "lrclib",
        status: "none",
        synced: 0,
        lang: null,
        offsetMs: null,
        linesJson: null,
        fetchedAt: now,
      });
      return { lyrics: null, status: "none" };
    }
  } catch {
    return { lyrics: null, status: "none" };
  }

  return { lyrics: null, status: "none" };
}

/**
 * Resolves lyrics for a song using SQLite cache, provider preferences, and network fallback.
 * Provider-agnostic resolver.
 */
export async function resolveLyricsForSong(
  songId: string,
  trackMetaOrSource?: LyricsTrackMetadata | LyricsSource | null,
  options?: {
    mode?: LyricsMode;
    now?: number;
    negativeTtlMs?: number;
    instrumentalTtlMs?: number;
    onUpgrade?: (lyrics: NormalizedLyrics) => void;
  },
): Promise<NormalizedLyrics | null> {
  if (!songId || typeof songId !== "string" || songId.trim() === "") {
    return null;
  }

  const trackMeta =
    typeof trackMetaOrSource === "object" && trackMetaOrSource !== null
      ? trackMetaOrSource
      : undefined;

  const mode =
    options?.mode ??
    (trackMetaOrSource === "server" ? "file_only" : getLyricsMode());

  const now = options?.now ?? Date.now();
  const negativeTtlMs = options?.negativeTtlMs ?? LYRICS_NEGATIVE_CACHE_TTL_MS;
  const instrumentalTtlMs =
    options?.instrumentalTtlMs ?? LYRICS_INSTRUMENTAL_CACHE_TTL_MS;

  const dbSong = getSongById(songId);
  const meta: LyricsTrackMetadata = {
    title: trackMeta?.title ?? dbSong?.title ?? "",
    artist: trackMeta?.artist ?? dbSong?.artist ?? null,
    album: trackMeta?.album ?? dbSong?.album ?? null,
    duration:
      (typeof trackMeta?.duration === "number" && trackMeta.duration > 0
        ? trackMeta.duration
        : null) ??
      (typeof dbSong?.duration === "number" && dbSong.duration > 0
        ? dbSong.duration
        : null),
  };

  // 1. In 'file_only', never contact LRCLIB
  if (mode === "file_only") {
    const serverResult = await resolveServerLyrics(songId, now, negativeTtlMs);
    return pickLyrics(
      "file_only",
      serverResult.lyrics,
      null,
      serverResult.status,
      "none",
    );
  }

  // 2. In 'file_first'
  if (mode === "file_first") {
    const serverResult = await resolveServerLyrics(songId, now, negativeTtlMs);

    if (
      !needsOnlineLookup("file_first", serverResult.lyrics, serverResult.status)
    ) {
      return serverResult.lyrics;
    }

    if (serverResult.lyrics && options?.onUpgrade) {
      options.onUpgrade(serverResult.lyrics);
    }

    const onlineResult = await resolveOnlineLyrics(
      songId,
      meta,
      now,
      negativeTtlMs,
      instrumentalTtlMs,
    );

    const picked = pickLyrics(
      "file_first",
      serverResult.lyrics,
      onlineResult.lyrics,
      serverResult.status,
      onlineResult.status,
    );

    if (picked && options?.onUpgrade && picked !== serverResult.lyrics) {
      options.onUpgrade(picked);
    }

    return picked;
  }

  // 3. In 'online_first'
  if (mode === "online_first") {
    const onlineResult = await resolveOnlineLyrics(
      songId,
      meta,
      now,
      negativeTtlMs,
      instrumentalTtlMs,
    );

    if (onlineResult.status === "instrumental") {
      return null;
    }

    if (onlineResult.lyrics) {
      return onlineResult.lyrics;
    }

    // Fall back to server
    const serverResult = await resolveServerLyrics(songId, now, negativeTtlMs);
    return pickLyrics(
      "online_first",
      serverResult.lyrics,
      onlineResult.lyrics,
      serverResult.status,
      onlineResult.status,
    );
  }

  return null;
}

/**
 * Fetches lyrics for a given song ID from the server and returns the best normalized entry.
 * Direct fetch without reading or writing to SQLite cache.
 */
export async function fetchLyricsForSong(
  songId: string,
): Promise<NormalizedLyrics | null> {
  if (!songId || typeof songId !== "string" || songId.trim() === "") {
    return null;
  }

  try {
    const rawLyrics = await getLyricsBySongId(songId);
    return selectBestLyrics(rawLyrics);
  } catch {
    return null;
  }
}

/**
 * Computes the active lyric line index for a given playback position (in ms)
 * and optional offset (in ms) using binary search.
 */
export function getCurrentLyricsLineIndex(
  lines: NormalizedLyricsLine[],
  positionMs: number,
  offsetMs: number = 0,
): number {
  if (!lines || lines.length === 0) {
    return -1;
  }

  const effectiveTimeMs = positionMs + offsetMs;

  let low = 0;
  let high = lines.length - 1;
  let candidateIndex = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const lineStart = lines[mid].startMs;

    if (typeof lineStart !== "number") {
      high = mid - 1;
      continue;
    }

    if (lineStart <= effectiveTimeMs) {
      candidateIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (candidateIndex === -1) {
    return -1;
  }

  let finalIndex = candidateIndex;
  while (finalIndex >= 0 && lines[finalIndex].text.trim() === "") {
    finalIndex--;
  }

  return finalIndex;
}
