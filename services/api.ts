import {
  clearDatabase,
  getAlbumById,
  getDb,
  getLocalCounts,
  getSongById,
  getSyncMeta,
  setSyncMeta,
  updateAlbumPlayStats,
  updateSongPlayStats,
  upsertAlbumsBatch,
  upsertArtistsBatch,
  upsertPlaylistsBatch,
  upsertSongsBatch,
} from "@/services/db";
import { resetPlayer } from "@/services/player";
import { clearAllCachedSongs } from "@/services/songCache";
import {
  AlbumID3,
  AlbumList2Type,
  AlbumWithSongsID3,
  GetAlbumList2Params,
  PingResponse,
  Playlist,
  PlaylistWithEntries,
  RefreshPlayStatsResult,
  ScanStatus,
  ScrobbleParams,
  Search3Params,
  SearchResult3,
  ServerCredentials,
  SetRatingParams,
  StarParams,
  StructuredLyrics,
  subsonicGetAlbumList2ResponseWrapperSchema,
  subsonicGetAlbumResponseWrapperSchema,
  subsonicGetLyricsBySongIdResponseWrapperSchema,
  subsonicGetPlaylistResponseWrapperSchema,
  subsonicGetPlaylistsResponseWrapperSchema,
  subsonicGetScanStatusResponseWrapperSchema,
  subsonicPingResponseWrapperSchema,
  subsonicResponseWrapperSchema,
  subsonicSearch3ResponseWrapperSchema,
  SyncResult,
  UnstarParams,
} from "@/types";
import { APP_FULL_NAME } from "@/utils/constants";
import { createAuthToken, generateSalt } from "@/utils/crypto";
import * as SecureStore from "expo-secure-store";

function getRestBaseUrl(rawUrl: string): string {
  const cleanUrl = rawUrl.replace(/\/+$/, "");
  return `${cleanUrl}/rest`;
}

function buildDefaultParams(): string {
  const params = new URLSearchParams({
    f: "json",
  });

  return params.toString();
}

async function buildAuthParams(
  credentials: ServerCredentials,
): Promise<string> {
  const { username, password } = credentials;
  const salt = generateSalt(6);
  const token = await createAuthToken(password, salt);
  const subsonicVersion = await SecureStore.getItemAsync("subsonicVersion");
  if (!subsonicVersion) {
    throw new Error("unable to find subsonic version.");
  }
  const params = new URLSearchParams({
    u: username,
    t: token,
    s: salt,
    v: subsonicVersion,
    c: APP_FULL_NAME,
    f: "json",
  });

  return params.toString();
}

export async function getStoredCredentials(): Promise<ServerCredentials> {
  const serverUrl = await SecureStore.getItemAsync("serverUrl");
  const username = await SecureStore.getItemAsync("username");
  const password = await SecureStore.getItemAsync("password");

  if (!serverUrl || !username || !password) {
    throw new Error("missing stored credentials");
  }

  return { serverUrl, username, password };
}

export async function ping(serverUrl: string): Promise<PingResponse> {
  // supposed to be used during connect screen.
  // ignoring the status from response as that api needs username version and more.
  const restBase = getRestBaseUrl(serverUrl);
  const defaultQuery = buildDefaultParams();
  const url = `${restBase}/ping?${defaultQuery}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`http error: ${response.status}`);
  }

  const data = await response.json();
  const parsed = subsonicPingResponseWrapperSchema.parse(data);
  const res = parsed["subsonic-response"];

  if (res.type !== "navidrome") {
    throw new Error("server is not navidrome compatible.");
  }

  return res;
}

export async function login(credentials: ServerCredentials) {
  const restBase = getRestBaseUrl(credentials.serverUrl);
  const authQuery = await buildAuthParams(credentials);
  const url = `${restBase}/ping.view?${authQuery}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`http error: ${response.status}`);
  }

  const data = await response.json();
  console.log(data);
  const parsed = subsonicPingResponseWrapperSchema.parse(data);
  const res = parsed["subsonic-response"];

  if (res.status !== "ok") {
    throw new Error(res.error?.message || "login failed: invalid credentials");
  }

  return res;
}

type AuthStateListener = (isLoggedIn: boolean) => void;
const authStateListeners = new Set<AuthStateListener>();

export function subscribeAuthState(listener: AuthStateListener): () => void {
  authStateListeners.add(listener);
  return () => {
    authStateListeners.delete(listener);
  };
}

export function notifyAuthState(isLoggedIn: boolean): void {
  authStateListeners.forEach((listener) => {
    try {
      listener(isLoggedIn);
    } catch (e) {
      console.error("error in auth state listener:", e);
    }
  });
}

export type PlayStatsListener = () => void;
const playStatsListeners = new Set<PlayStatsListener>();

export function subscribePlayStats(listener: PlayStatsListener): () => void {
  playStatsListeners.add(listener);
  return () => {
    playStatsListeners.delete(listener);
  };
}

export function notifyPlayStatsUpdated(): void {
  playStatsListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error("error in play stats listener:", e);
    }
  });
}

export async function logout(): Promise<void> {
  // 1. Stop audio playback and reset in-memory player state
  try {
    await resetPlayer();
  } catch (error) {
    console.error("failed to reset player on logout:", error);
  }

  // 2. Cancel in-flight caching operations and delete cached songs on disk
  try {
    await clearAllCachedSongs();
  } catch (error) {
    console.error("failed to clear song cache on logout:", error);
  }

  // 3. Clear SQLite database tables
  try {
    clearDatabase();
  } catch (error) {
    console.error("failed to clear database on logout:", error);
  }

  // 4. Delete all auth credentials & stored preferences in parallel
  const keysToDelete = [
    "subsonicVersion",
    "serverUrl",
    "username",
    "password",
    "stop_playback_on_task_removed",
    "home_sections",
  ];
  await Promise.allSettled(
    keysToDelete.map((key) => SecureStore.deleteItemAsync(key)),
  );

  // 5. Notify auth state listeners
  notifyAuthState(false);
}

export async function search3(params: Search3Params): Promise<SearchResult3> {
  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);

  const queryParams = new URLSearchParams();
  queryParams.append("query", params.query);

  if (params.artistCount !== undefined) {
    queryParams.append("artistCount", params.artistCount.toString());
  }
  if (params.artistOffset !== undefined) {
    queryParams.append("artistOffset", params.artistOffset.toString());
  }
  if (params.albumCount !== undefined) {
    queryParams.append("albumCount", params.albumCount.toString());
  }
  if (params.albumOffset !== undefined) {
    queryParams.append("albumOffset", params.albumOffset.toString());
  }
  if (params.songCount !== undefined) {
    queryParams.append("songCount", params.songCount.toString());
  }
  if (params.songOffset !== undefined) {
    queryParams.append("songOffset", params.songOffset.toString());
  }
  if (params.musicFolderId !== undefined) {
    queryParams.append("musicFolderId", params.musicFolderId);
  }

  const url = `${restBase}/search3.view?${authQuery}&${queryParams.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`http error: ${response.status}`);
  }

  const data = await response.json();
  const parsed = subsonicSearch3ResponseWrapperSchema.parse(data);
  const res = parsed["subsonic-response"];

  if (res.status !== "ok") {
    throw new Error(res.error?.message || "search failed");
  }

  return res.searchResult3 || {};
}

export async function getScanStatus(): Promise<ScanStatus> {
  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);
  const url = `${restBase}/getScanStatus.view?${authQuery}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`http error: ${response.status}`);
  }

  const data = await response.json();
  const parsed = subsonicGetScanStatusResponseWrapperSchema.parse(data);
  const res = parsed["subsonic-response"];

  if (res.status !== "ok") {
    throw new Error(res.error?.message || "failed to get scan status");
  }

  if (!res.scanStatus) {
    throw new Error("missing scan status in response");
  }

  return res.scanStatus;
}

export async function client_app_sync(
  force: boolean = false,
): Promise<SyncResult> {
  const scanStatus = await getScanStatus();

  let playStatsRefreshed = false;
  if (!force) {
    try {
      const statsRes = await refreshPlayStats();
      if (
        statsRes.refreshed &&
        (statsRes.albumsUpdated > 0 || statsRes.songsUpdated > 0)
      ) {
        playStatsRefreshed = true;
      }
    } catch (error) {
      console.error("failed to refresh play stats during sync:", error);
    }
  }

  const storedLastScan = getSyncMeta("lastScan");
  const currentLastScan = scanStatus.lastScan ?? "";

  if (
    !force &&
    storedLastScan &&
    currentLastScan &&
    storedLastScan === currentLastScan
  ) {
    const localCounts = getLocalCounts();
    return {
      synced: false,
      playStatsRefreshed,
      artistCount: localCounts.artistCount,
      albumCount: localCounts.albumCount,
      songCount: localCounts.songCount,
      playlistCount: localCounts.playlistCount,
      lastScan: storedLastScan,
      lastSyncedAt: getSyncMeta("lastSyncedAt") ?? undefined,
    };
  }

  const batchSize = 500;
  let artistOffset = 0;
  let albumOffset = 0;
  let songOffset = 0;

  let totalArtists = 0;
  let totalAlbums = 0;
  let totalSongs = 0;

  let fetchArtists = true;
  let fetchAlbums = true;
  let fetchSongs = true;

  while (fetchArtists || fetchAlbums || fetchSongs) {
    const res = await search3({
      query: "",
      artistCount: fetchArtists ? batchSize : 0,
      artistOffset,
      albumCount: fetchAlbums ? batchSize : 0,
      albumOffset,
      songCount: fetchSongs ? batchSize : 0,
      songOffset,
    });

    const artists = res.artist || [];
    const albums = res.album || [];
    const songs = res.song || [];

    if (fetchArtists) {
      if (artists.length > 0) {
        upsertArtistsBatch(artists);
        totalArtists += artists.length;
        artistOffset += artists.length;
      }
      if (artists.length < batchSize) {
        fetchArtists = false;
      }
    }

    if (fetchAlbums) {
      if (albums.length > 0) {
        upsertAlbumsBatch(albums);
        totalAlbums += albums.length;
        albumOffset += albums.length;
      }
      if (albums.length < batchSize) {
        fetchAlbums = false;
      }
    }

    if (fetchSongs) {
      if (songs.length > 0) {
        upsertSongsBatch(songs);
        totalSongs += songs.length;
        songOffset += songs.length;
      }
      if (songs.length < batchSize) {
        fetchSongs = false;
      }
    }
  }

  let totalPlaylists = 0;
  try {
    const playlists = await getPlaylists();
    if (playlists.length > 0) {
      upsertPlaylistsBatch(playlists);
      totalPlaylists = playlists.length;
    }
  } catch (error) {
    console.error("failed to sync playlists:", error);
  }

  const now = new Date().toISOString();
  if (currentLastScan) {
    setSyncMeta("lastScan", currentLastScan);
  }
  setSyncMeta("lastSyncedAt", now);

  return {
    synced: true,
    playStatsRefreshed,
    artistCount: totalArtists,
    albumCount: totalAlbums,
    songCount: totalSongs,
    playlistCount: totalPlaylists,
    lastScan: currentLastScan,
    lastSyncedAt: now,
  };
}

export async function getCoverArtBaseUrl(defaultSize: number = 300): Promise<
  (id?: string | null, size?: number) => string | null
> {
  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);
  return (id?: string | null, size?: number) => {
    if (!id) return null;
    const targetSize = size ?? defaultSize;
    return `${restBase}/getCoverArt.view?${authQuery}&id=${encodeURIComponent(id)}&size=${targetSize}`;
  };
}

export async function getSongStreamUrl(songId: string): Promise<string> {
  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);
  return `${restBase}/stream.view?${authQuery}&id=${encodeURIComponent(songId)}`;
}

export async function getSongDownloadUrl(songId: string): Promise<string> {
  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);
  return `${restBase}/download.view?${authQuery}&id=${encodeURIComponent(songId)}`;
}

export async function scrobble(params: ScrobbleParams): Promise<boolean> {
  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);

  const queryParams = new URLSearchParams();
  queryParams.append("id", params.id);
  if (params.time !== undefined) {
    queryParams.append("time", params.time.toString());
  }
  if (params.submission !== undefined) {
    queryParams.append("submission", params.submission.toString());
  }

  const url = `${restBase}/scrobble.view?${authQuery}&${queryParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`scrobble request failed with status ${response.status}`);
  }

  try {
    const data = await response.json();
    const subResponse = data?.["subsonic-response"];
    if (subResponse?.status === "failed" || subResponse?.error) {
      throw new Error(subResponse.error?.message || "scrobble failed");
    }
  } catch (err: any) {
    if (err.message && !err.message.includes("JSON")) {
      throw err;
    }
  }
  if (params.submission) {
    try {
      const song = getSongById(params.id);
      if (song) {
        const playedTime =
          typeof params.time === "number" && !isNaN(params.time)
            ? new Date(params.time).toISOString()
            : new Date().toISOString();
        updateSongPlayStats(song.id, playedTime, (song.playCount ?? 0) + 1);
        if (song.albumId) {
          const album = getAlbumById(song.albumId);
          if (album) {
            updateAlbumPlayStats(album.id, playedTime, (album.playCount ?? 0) + 1);
          }
        }
        notifyPlayStatsUpdated();
      }
    } catch (e) {
      console.error("failed to bump local play stats on scrobble:", e);
    }
  }

  return true;
}

export async function scrobbleSong(songId: string, time?: number): Promise<void> {
  await scrobble({ id: songId, submission: true, time: time ?? Date.now() });
}

export async function getPlaylists(username?: string): Promise<Playlist[]> {
  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);

  let url = `${restBase}/getPlaylists.view?${authQuery}`;
  if (username) {
    url += `&username=${encodeURIComponent(username)}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `getPlaylists request failed with status ${response.status}`,
    );
  }

  const data = await response.json();
  const parsed = subsonicGetPlaylistsResponseWrapperSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("failed to parse getPlaylists response");
  }

  const res = parsed.data["subsonic-response"];
  if (res.status !== "ok") {
    throw new Error(res.error?.message || "getPlaylists failed");
  }

  return res.playlists?.playlist ?? [];
}

export async function getPlaylist(
  playlistId: string,
): Promise<PlaylistWithEntries> {
  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);

  const url = `${restBase}/getPlaylist.view?${authQuery}&id=${encodeURIComponent(playlistId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `getPlaylist request failed with status ${response.status}`,
    );
  }

  const data = await response.json();
  const parsed = subsonicGetPlaylistResponseWrapperSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("failed to parse getPlaylist response");
  }

  const res = parsed.data["subsonic-response"];
  if (res.status !== "ok") {
    throw new Error(res.error?.message || "getPlaylist failed");
  }

  if (!res.playlist) {
    throw new Error("playlist not found in response");
  }

  return res.playlist;
}

export async function setRating(params: SetRatingParams): Promise<boolean>;
export async function setRating(id: string, rating: number): Promise<boolean>;
export async function setRating(
  idOrParams: string | SetRatingParams,
  ratingArg?: number,
): Promise<boolean> {
  let id: string;
  let rating: number;

  if (typeof idOrParams === "object" && idOrParams !== null) {
    id = idOrParams.id;
    rating = idOrParams.rating;
  } else {
    id = idOrParams;
    rating = ratingArg!;
  }

  if (!id || typeof id !== "string" || id.trim() === "") {
    throw new Error("id is required");
  }

  if (
    typeof rating !== "number" ||
    !Number.isFinite(rating) ||
    rating < 0 ||
    rating > 5 ||
    !Number.isInteger(rating)
  ) {
    throw new Error("rating must be an integer between 0 and 5");
  }

  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);

  const queryParams = new URLSearchParams();
  queryParams.append("id", id);
  queryParams.append("rating", rating.toString());

  const url = `${restBase}/setRating.view?${authQuery}&${queryParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`setRating request failed with status ${response.status}`);
  }

  try {
    const data = await response.json();
    const parsed = subsonicResponseWrapperSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("failed to parse setRating response");
    }

    const res = parsed.data["subsonic-response"];
    if (res.status !== "ok") {
      throw new Error(res.error?.message || "setRating failed");
    }
  } catch (err: any) {
    if (err.message && !err.message.toLowerCase().includes("json")) {
      throw err;
    }
  }

  return true;
}

export async function star(params: StarParams): Promise<boolean>;
export async function star(id: string): Promise<boolean>;
export async function star(paramsOrId: string | StarParams): Promise<boolean> {
  const params: StarParams =
    typeof paramsOrId === "string" ? { id: paramsOrId } : paramsOrId;

  if (!params || typeof params !== "object") {
    throw new Error("at least one id, albumId, or artistId must be provided");
  }

  const queryParams = new URLSearchParams();

  const appendParam = (key: string, value?: string | string[]) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (typeof v === "string" && v.trim() !== "") {
          queryParams.append(key, v);
        }
      });
    } else if (typeof value === "string" && value.trim() !== "") {
      queryParams.append(key, value);
    }
  };

  appendParam("id", params.id);
  appendParam("albumId", params.albumId);
  appendParam("artistId", params.artistId);

  if (queryParams.toString() === "") {
    throw new Error("at least one id, albumId, or artistId must be provided");
  }

  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);

  const url = `${restBase}/star.view?${authQuery}&${queryParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`star request failed with status ${response.status}`);
  }

  try {
    const data = await response.json();
    const parsed = subsonicResponseWrapperSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("failed to parse star response");
    }

    const res = parsed.data["subsonic-response"];
    if (res.status !== "ok") {
      throw new Error(res.error?.message || "star failed");
    }
  } catch (err: any) {
    if (err.message && !err.message.toLowerCase().includes("json")) {
      throw err;
    }
  }

  return true;
}

export async function unstar(params: UnstarParams): Promise<boolean>;
export async function unstar(id: string): Promise<boolean>;
export async function unstar(
  paramsOrId: string | UnstarParams,
): Promise<boolean> {
  const params: UnstarParams =
    typeof paramsOrId === "string" ? { id: paramsOrId } : paramsOrId;

  if (!params || typeof params !== "object") {
    throw new Error("at least one id, albumId, or artistId must be provided");
  }

  const queryParams = new URLSearchParams();

  const appendParam = (key: string, value?: string | string[]) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (typeof v === "string" && v.trim() !== "") {
          queryParams.append(key, v);
        }
      });
    } else if (typeof value === "string" && value.trim() !== "") {
      queryParams.append(key, value);
    }
  };

  appendParam("id", params.id);
  appendParam("albumId", params.albumId);
  appendParam("artistId", params.artistId);

  if (queryParams.toString() === "") {
    throw new Error("at least one id, albumId, or artistId must be provided");
  }

  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);

  const url = `${restBase}/unstar.view?${authQuery}&${queryParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`unstar request failed with status ${response.status}`);
  }

  try {
    const data = await response.json();
    const parsed = subsonicResponseWrapperSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("failed to parse unstar response");
    }

    const res = parsed.data["subsonic-response"];
    if (res.status !== "ok") {
      throw new Error(res.error?.message || "unstar failed");
    }
  } catch (err: any) {
    if (err.message && !err.message.toLowerCase().includes("json")) {
      throw err;
    }
  }

  return true;
}

export async function getLyricsBySongId(
  id: string,
): Promise<StructuredLyrics[]> {
  if (!id || typeof id !== "string" || id.trim() === "") {
    return [];
  }

  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);

  const queryParams = new URLSearchParams();
  queryParams.append("id", id);

  const url = `${restBase}/getLyricsBySongId.view?${authQuery}&${queryParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`getLyricsBySongId failed with status ${response.status}`);
  }

  const data = await response.json();
  const parsed =
    subsonicGetLyricsBySongIdResponseWrapperSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("invalid getLyricsBySongId response format");
  }

  const res = parsed.data["subsonic-response"];
  if (res.status !== "ok") {
    // If the server explicitly says error 70 (not found) or similar Subsonic error:
    if (res.error?.code === 70) {
      return [];
    }
    throw new Error(
      res.error?.message ?? "subsonic returned non-ok status for getLyricsBySongId",
    );
  }

  const rawList = res.lyricsList?.structuredLyrics;
  if (!rawList) {
    return [];
  }

  return Array.isArray(rawList) ? rawList : [rawList];
}

export type RequestTimeoutOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export async function getAlbumList2(
  params: GetAlbumList2Params,
  options?: RequestTimeoutOptions,
): Promise<AlbumID3[]>;
export async function getAlbumList2(
  type: AlbumList2Type,
  size?: number,
  offset?: number,
  options?: RequestTimeoutOptions,
): Promise<AlbumID3[]>;
export async function getAlbumList2(
  typeOrParams: AlbumList2Type | GetAlbumList2Params,
  sizeArgOrOptions?: number | RequestTimeoutOptions,
  offsetArg?: number,
  optionsArg?: RequestTimeoutOptions,
): Promise<AlbumID3[]> {
  const options =
    typeof sizeArgOrOptions === "object"
      ? sizeArgOrOptions
      : optionsArg;
  const params: GetAlbumList2Params =
    typeof typeOrParams === "string"
      ? {
          type: typeOrParams,
          size: typeof sizeArgOrOptions === "number" ? sizeArgOrOptions : undefined,
          offset: offsetArg,
        }
      : typeOrParams;

  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);

  const queryParams = new URLSearchParams();
  queryParams.append("type", params.type);
  if (params.size !== undefined) {
    queryParams.append("size", params.size.toString());
  }
  if (params.offset !== undefined) {
    queryParams.append("offset", params.offset.toString());
  }
  if (params.fromYear !== undefined) {
    queryParams.append("fromYear", params.fromYear.toString());
  }
  if (params.toYear !== undefined) {
    queryParams.append("toYear", params.toYear.toString());
  }
  if (params.genre !== undefined) {
    queryParams.append("genre", params.genre);
  }
  if (params.musicFolderId !== undefined) {
    queryParams.append("musicFolderId", params.musicFolderId);
  }

  const url = `${restBase}/getAlbumList2.view?${authQuery}&${queryParams.toString()}`;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let signal = options?.signal;
  if (options?.timeoutMs) {
    const controller = new AbortController();
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }
    timer = setTimeout(() => {
      controller.abort();
    }, options.timeoutMs);
    signal = controller.signal;
  }

  try {
    const response = signal
      ? await fetch(url, { signal })
      : await fetch(url);
    if (!response.ok) {
      throw new Error(
        `getAlbumList2 request failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    const parsed = subsonicGetAlbumList2ResponseWrapperSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("failed to parse getAlbumList2 response");
    }

    const res = parsed.data["subsonic-response"];
    if (res.status !== "ok") {
      throw new Error(res.error?.message || "getAlbumList2 failed");
    }

    const rawList = res.albumList2?.album ?? res.albumList?.album;
    if (!rawList) {
      return [];
    }

    return Array.isArray(rawList) ? rawList : [rawList];
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function getAlbum(
  albumId: string,
  options?: RequestTimeoutOptions,
): Promise<AlbumWithSongsID3> {
  if (!albumId || typeof albumId !== "string" || albumId.trim() === "") {
    throw new Error("albumId is required");
  }

  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);

  const url = `${restBase}/getAlbum.view?${authQuery}&id=${encodeURIComponent(albumId)}`;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let signal = options?.signal;
  if (options?.timeoutMs) {
    const controller = new AbortController();
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }
    timer = setTimeout(() => {
      controller.abort();
    }, options.timeoutMs);
    signal = controller.signal;
  }

  try {
    const response = signal
      ? await fetch(url, { signal })
      : await fetch(url);
    if (!response.ok) {
      throw new Error(`getAlbum request failed with status ${response.status}`);
    }

    const data = await response.json();
    const parsed = subsonicGetAlbumResponseWrapperSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("failed to parse getAlbum response");
    }

    const res = parsed.data["subsonic-response"];
    if (res.status !== "ok") {
      throw new Error(res.error?.message || "getAlbum failed");
    }

    if (!res.album) {
      throw new Error("album not found in response");
    }

    const rawSong = res.album.song;
    const songList = rawSong
      ? Array.isArray(rawSong)
        ? rawSong
        : [rawSong]
      : [];

    return {
      ...res.album,
      song: songList,
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function refreshPlayStats(): Promise<RefreshPlayStatsResult> {
  try {
    const [recentAlbums, frequentAlbums] = await Promise.all([
      getAlbumList2({ type: "recent", size: 30 }, { timeoutMs: 10000 }),
      getAlbumList2({ type: "frequent", size: 30 }, { timeoutMs: 10000 }),
    ]);

    const albumMap = new Map<string, AlbumID3>();
    for (const album of recentAlbums) {
      if (album?.id) {
        albumMap.set(album.id, album);
      }
    }
    for (const album of frequentAlbums) {
      if (album?.id) {
        if (albumMap.has(album.id)) {
          const existing = albumMap.get(album.id)!;
          albumMap.set(album.id, {
            ...existing,
            ...album,
            playCount:
              album.playCount !== undefined && album.playCount !== null
                ? existing.playCount !== undefined && existing.playCount !== null
                  ? Math.max(existing.playCount, album.playCount)
                  : album.playCount
                : existing.playCount,
            played:
              album.played && existing.played
                ? album.played > existing.played
                  ? album.played
                  : existing.played
                : album.played ?? existing.played,
          });
        } else {
          albumMap.set(album.id, album);
        }
      }
    }

    interface ChangedAlbum {
      id: string;
      played: string | null;
      playCount: number | null;
    }
    const changedAlbums: ChangedAlbum[] = [];

    for (const remoteAlbum of albumMap.values()) {
      const localAlbum = getAlbumById(remoteAlbum.id);
      if (!localAlbum) {
        // Skip albums that don't exist locally
        continue;
      }

      const remotePlayed = remoteAlbum.played ?? null;
      const remotePlayCount = remoteAlbum.playCount ?? null;
      const localPlayed = localAlbum.played ?? null;
      const localPlayCount = localAlbum.playCount ?? null;

      const hasChanged =
        remotePlayed !== localPlayed || remotePlayCount !== localPlayCount;

      if (hasChanged) {
        changedAlbums.push({
          id: remoteAlbum.id,
          played: remotePlayed,
          playCount: remotePlayCount,
        });
      }
    }

    interface ChangedSong {
      id: string;
      played: string | null;
      playCount: number | null;
    }
    const changedSongsMap = new Map<string, ChangedSong>();

    for (const changedAlbum of changedAlbums) {
      const albumData = await getAlbum(changedAlbum.id, { timeoutMs: 10000 });
      const remoteSongs = albumData.song ?? [];

      for (const remoteSong of remoteSongs) {
        if (!remoteSong?.id) continue;
        const localSong = getSongById(remoteSong.id);
        if (!localSong) {
          // Skip songs that don't exist locally
          continue;
        }

        const remoteSongPlayed = remoteSong.played ?? null;
        const remoteSongPlayCount = remoteSong.playCount ?? null;
        const localSongPlayed = localSong.played ?? null;
        const localSongPlayCount = localSong.playCount ?? null;

        const songChanged =
          remoteSongPlayed !== localSongPlayed ||
          remoteSongPlayCount !== localSongPlayCount;

        if (songChanged) {
          changedSongsMap.set(remoteSong.id, {
            id: remoteSong.id,
            played: remoteSongPlayed,
            playCount: remoteSongPlayCount,
          });
        }
      }
    }

    const db = getDb();
    let albumsUpdated = 0;
    let songsUpdated = 0;

    db.withTransactionSync(() => {
      for (const alb of changedAlbums) {
        const didUpdate = updateAlbumPlayStats(
          alb.id,
          alb.played,
          alb.playCount,
        );
        if (didUpdate) {
          albumsUpdated++;
        }
      }

      for (const song of changedSongsMap.values()) {
        const didUpdate = updateSongPlayStats(
          song.id,
          song.played,
          song.playCount,
        );
        if (didUpdate) {
          songsUpdated++;
        }
      }
    });

    if (albumsUpdated > 0 || songsUpdated > 0) {
      notifyPlayStatsUpdated();
    }

    return {
      refreshed: true,
      albumsUpdated,
      songsUpdated,
    };
  } catch (error) {
    console.error("failed to refresh play stats:", error);
    return { refreshed: false };
  }
}

