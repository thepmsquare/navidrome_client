import { getLyricsBySongId } from "@/services/api";
import {
  getLyricsCacheEntrySync,
  upsertLyricsCacheEntry,
} from "@/services/db";
import {
  LyricsSource,
  NormalizedLyrics,
  NormalizedLyricsLine,
  StructuredLyrics,
} from "@/types";
import { LYRICS_NEGATIVE_CACHE_TTL_MS } from "@/utils/constants";

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

  // Filter entries that have at least one line (even if empty string)
  const candidateEntries = entries.filter((e) => {
    const lines = e.line ?? [];
    return lines.length > 0;
  });

  if (candidateEntries.length === 0) {
    return null;
  }

  // Prefer a synced entry
  const syncedEntry = candidateEntries.find((e) => Boolean(e.synced));
  const best = syncedEntry ?? candidateEntries[0];

  return normalizeLyricsEntry(best);
}

/**
 * Synchronous accessor for cached lyrics.
 * Used during component render to eliminate delay for cached songs.
 */
export function getCachedLyricsSync(
  songId: string | null | undefined,
  source: LyricsSource = "server",
): NormalizedLyrics | null {
  if (!songId || typeof songId !== "string" || songId.trim() === "") {
    return null;
  }

  const row = getLyricsCacheEntrySync(songId, source);
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
 * Resolves lyrics for a song using SQLite cache and network fallback.
 * Provider-agnostic resolver.
 * - found in cache -> returns immediately
 * - none in cache & within negative TTL -> returns null without network
 * - miss or expired none -> fetches from server
 * - caches DEFINITIVE results only ('found' or 'none')
 * - network/server failures are NOT cached
 */
export async function resolveLyricsForSong(
  songId: string,
  source: LyricsSource = "server",
  options?: { now?: number; negativeTtlMs?: number },
): Promise<NormalizedLyrics | null> {
  if (!songId || typeof songId !== "string" || songId.trim() === "") {
    return null;
  }

  const now = options?.now ?? Date.now();
  const negativeTtlMs =
    options?.negativeTtlMs ?? LYRICS_NEGATIVE_CACHE_TTL_MS;

  const cachedRow = getLyricsCacheEntrySync(songId, source);
  if (cachedRow) {
    if (cachedRow.status === "found" && cachedRow.linesJson) {
      try {
        const lines = JSON.parse(
          cachedRow.linesJson,
        ) as NormalizedLyricsLine[];
        return {
          synced: Boolean(cachedRow.synced),
          ...(cachedRow.lang ? { lang: cachedRow.lang } : {}),
          ...(typeof cachedRow.offsetMs === "number"
            ? { offsetMs: cachedRow.offsetMs }
            : {}),
          lines,
        };
      } catch {
        // Fall through to refetch if parse failed
      }
    } else if (cachedRow.status === "none") {
      const isFresh = now - cachedRow.fetchedAt < negativeTtlMs;
      if (isFresh) {
        return null;
      }
    }
  }

  // Network fetch for source 'server'
  try {
    const rawLyrics = await getLyricsBySongId(songId);
    const normalized = selectBestLyrics(rawLyrics);

    if (normalized && normalized.lines.length > 0) {
      upsertLyricsCacheEntry({
        songId,
        source,
        status: "found",
        synced: normalized.synced,
        lang: normalized.lang ?? null,
        offsetMs: normalized.offsetMs ?? null,
        linesJson: JSON.stringify(normalized.lines),
        fetchedAt: now,
      });
      return normalized;
    }

    // Definitive empty result from server (status: ok, but no lyrics found)
    upsertLyricsCacheEntry({
      songId,
      source,
      status: "none",
      synced: 0,
      lang: null,
      offsetMs: null,
      linesJson: null,
      fetchedAt: now,
    });
    return null;
  } catch {
    // Network or server error: do NOT cache as 'none'
    return null;
  }
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
 *
 * Offset sign convention:
 * Positive offset (+) shifts lyrics earlier in time (effective position = positionMs + offsetMs).
 * Negative offset (-) delays lyrics.
 *
 * Rules:
 * - Returns -1 before the first timestamp.
 * - Blank lines (whitespace/empty text) are never highlighted; if the search lands on a blank line,
 *   the previous non-blank line remains highlighted.
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
