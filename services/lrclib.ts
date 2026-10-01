import {
  LyricsTrackMetadata,
  NormalizedLyrics,
  NormalizedLyricsLine,
  OnlineLyricsProviderResult,
} from "@/types";
import { LRCLIB_USER_AGENT } from "@/utils/constants";

export interface LyricsProvider {
  name: "lrclib";
  fetchLyrics(
    track: LyricsTrackMetadata,
  ): Promise<OnlineLyricsProviderResult | null>;
}

export interface LrclibResponse {
  id: number;
  name?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const LRCLIB_BASE_URL = "https://lrclib.net/api";
const TIMEOUT_MS = 8000;
const MAX_DURATION_DIFF_SECS = 3;

/**
 * Parses timestamp string into milliseconds.
 * Supports [mm:ss.xx] and [mm:ss.xxx].
 */
export function parseLrcTimestamp(minStr: string, secStr: string, fracStr?: string): number {
  const minutes = parseInt(minStr, 10);
  const seconds = parseInt(secStr, 10);
  let fracMs = 0;
  if (fracStr) {
    if (fracStr.length === 1) {
      fracMs = parseInt(fracStr, 10) * 100;
    } else if (fracStr.length === 2) {
      fracMs = parseInt(fracStr, 10) * 10;
    } else {
      fracMs = parseInt(fracStr.slice(0, 3), 10);
    }
  }
  return minutes * 60000 + seconds * 1000 + fracMs;
}

/**
 * Parses LRC formatted string into NormalizedLyrics.
 * - Supports [mm:ss.xx] and [mm:ss.xxx]
 * - Supports multiple timestamps per line
 * - Trims line text
 * - Preserves blank timestamped lines (spacing)
 * - Ignores metadata tags like [ar:], [ti:], [al:], [offset:], etc.
 * - Sorts lines by startMs
 * Returns null if no valid timestamped lines exist.
 */
export function parseLrc(lrcContent: string | null | undefined): NormalizedLyrics | null {
  if (!lrcContent || typeof lrcContent !== "string" || lrcContent.trim() === "") {
    return null;
  }

  const rawLines = lrcContent.split(/\r?\n/);
  const parsedLines: NormalizedLyricsLine[] = [];

  // Match timestamps like [01:23.45] or [01:23.456]
  const timestampRegex = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check if line contains any metadata tags [tag: value] and no timestamps
    const hasTimestamp = /\[\d{1,3}:\d{2}/.test(trimmed);
    if (!hasTimestamp) {
      continue;
    }

    // Extract all timestamps in this line
    const matches: { startMs: number }[] = [];
    let match: RegExpExecArray | null;
    timestampRegex.lastIndex = 0;
    while ((match = timestampRegex.exec(trimmed)) !== null) {
      const startMs = parseLrcTimestamp(match[1], match[2], match[3]);
      matches.push({ startMs });
    }

    if (matches.length === 0) {
      continue;
    }

    // Remove all timestamp tags to get text content
    const text = trimmed.replace(/\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]/g, "").trim();

    for (const m of matches) {
      parsedLines.push({
        startMs: m.startMs,
        text,
      });
    }
  }

  if (parsedLines.length === 0) {
    return null;
  }

  parsedLines.sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0));

  return {
    synced: true,
    lines: parsedLines,
  };
}

/**
 * Parses plain text lyrics into unsynced NormalizedLyrics.
 */
export function parsePlainLyrics(plain: string | null | undefined): NormalizedLyrics | null {
  if (!plain || typeof plain !== "string" || plain.trim() === "") {
    return null;
  }

  const lines: NormalizedLyricsLine[] = plain
    .split(/\r?\n/)
    .map((l) => ({ text: l.trim() }));

  if (lines.length === 0) {
    return null;
  }

  return {
    synced: false,
    lines,
  };
}

/**
 * Converts an Lrclib item to an OnlineLyricsProviderResult.
 */
export function convertLrclibItem(item: LrclibResponse): OnlineLyricsProviderResult {
  if (item.instrumental) {
    return { kind: "instrumental" };
  }

  if (item.syncedLyrics) {
    const parsed = parseLrc(item.syncedLyrics);
    if (parsed && parsed.lines.length > 0) {
      return { kind: "found", lyrics: parsed };
    }
  }

  if (item.plainLyrics) {
    const plain = parsePlainLyrics(item.plainLyrics);
    if (plain && plain.lines.length > 0) {
      return { kind: "found", lyrics: plain };
    }
  }

  if (item.instrumental === false && !item.syncedLyrics && !item.plainLyrics) {
    return { kind: "none" };
  }

  return { kind: "none" };
}

/**
 * Fetches lyrics from LRCLIB.
 * 1. Checks track duration. If missing, <= 0 or NaN, skips lookup without error.
 * 2. Attempts GET /api/get with track_name, artist_name, album_name, duration.
 * 3. On 404, falls back to GET /api/search with track_name, artist_name.
 * 4. In search results: rejects candidates > 3s off duration, prefers synced lyrics
 *    when two candidates are within tolerance, and picks the closest duration.
 * 5. Definitive answer: 404 on /get AND no acceptable search result returns { kind: 'none' }.
 * 6. Failures (429, 5xx, timeout, network error) return { kind: 'unavailable' } (never cached).
 */
export async function fetchOnlineLyricsFromLrclib(
  track: LyricsTrackMetadata,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number },
): Promise<OnlineLyricsProviderResult | null> {
  const duration = track.duration;
  if (typeof duration !== "number" || isNaN(duration) || duration <= 0) {
    return null;
  }

  const title = track.title?.trim();
  if (!title) {
    return null;
  }

  const artist = track.artist?.trim() ?? "";
  const album = track.album?.trim() ?? "";
  const durationSecs = Math.round(duration);

  const fetchImpl = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? TIMEOUT_MS;

  // 1. Try GET /api/get
  const getParams = new URLSearchParams({
    track_name: title,
    artist_name: artist,
    duration: String(durationSecs),
  });
  if (album) {
    getParams.append("album_name", album);
  }

  const getUrl = `${LRCLIB_BASE_URL}/get?${getParams.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let getResponse: Response;
  try {
    getResponse = await fetchImpl(getUrl, {
      method: "GET",
      headers: {
        "User-Agent": LRCLIB_USER_AGENT,
      },
      signal: controller.signal,
    });
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timer);
  }

  if (getResponse.ok) {
    try {
      const data = (await getResponse.json()) as LrclibResponse;
      if (typeof data.duration === "number") {
        const diff = Math.abs(data.duration - duration);
        if (diff <= MAX_DURATION_DIFF_SECS) {
          return convertLrclibItem(data);
        }
      } else {
        return convertLrclibItem(data);
      }
    } catch {
      return { kind: "unavailable" };
    }
    // If duration diff > 3s, fall through to search fallback
  } else if (getResponse.status !== 404) {
    return { kind: "unavailable" };
  }

  // 2. Fall back to GET /api/search (track_name + artist_name)
  const searchParams = new URLSearchParams({
    track_name: title,
  });
  if (artist) {
    searchParams.append("artist_name", artist);
  }

  const searchUrl = `${LRCLIB_BASE_URL}/search?${searchParams.toString()}`;
  const searchController = new AbortController();
  const searchTimer = setTimeout(() => searchController.abort(), timeoutMs);

  let searchResponse: Response;
  try {
    searchResponse = await fetchImpl(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": LRCLIB_USER_AGENT,
      },
      signal: searchController.signal,
    });
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(searchTimer);
  }

  if (!searchResponse.ok) {
    return { kind: "unavailable" };
  }

  let searchData: LrclibResponse[];
  try {
    searchData = (await searchResponse.json()) as LrclibResponse[];
  } catch {
    return { kind: "unavailable" };
  }

  if (!Array.isArray(searchData) || searchData.length === 0) {
    return { kind: "none" };
  }

  // Filter candidates within 3 seconds of the song's duration
  const validCandidates = searchData.filter((item) => {
    if (typeof item.duration !== "number") return false;
    return Math.abs(item.duration - duration) <= MAX_DURATION_DIFF_SECS;
  });

  if (validCandidates.length === 0) {
    return { kind: "none" };
  }

  // Pick closest candidate, preferring syncedLyrics when within tolerance
  validCandidates.sort((a, b) => {
    const aSynced = Boolean(a.syncedLyrics && a.syncedLyrics.trim().length > 0);
    const bSynced = Boolean(b.syncedLyrics && b.syncedLyrics.trim().length > 0);

    if (aSynced && !bSynced) return -1;
    if (!aSynced && bSynced) return 1;

    const aDiff = Math.abs((a.duration ?? 0) - duration);
    const bDiff = Math.abs((b.duration ?? 0) - duration);
    return aDiff - bDiff;
  });

  return convertLrclibItem(validCandidates[0]);
}

export const fetchLyricsFromLrclib = fetchOnlineLyricsFromLrclib;

export const lrclibProvider: LyricsProvider = {
  name: "lrclib",
  fetchLyrics: fetchOnlineLyricsFromLrclib,
};
