import {
  clearDatabase,
  getLocalCounts,
  getSyncMeta,
  setSyncMeta,
  upsertAlbumsBatch,
  upsertArtistsBatch,
  upsertPlaylistsBatch,
  upsertSongsBatch,
} from "@/services/db";
import { resetPlayer } from "@/services/player";
import { clearAllCachedSongs } from "@/services/songCache";
import {
  PingResponse,
  Playlist,
  PlaylistWithEntries,
  ScanStatus,
  ScrobbleParams,
  Search3Params,
  SearchResult3,
  ServerCredentials,
  subsonicGetPlaylistResponseWrapperSchema,
  subsonicGetPlaylistsResponseWrapperSchema,
  subsonicGetScanStatusResponseWrapperSchema,
  subsonicPingResponseWrapperSchema,
  subsonicSearch3ResponseWrapperSchema,
  SyncResult,
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
    artistCount: totalArtists,
    albumCount: totalAlbums,
    songCount: totalSongs,
    playlistCount: totalPlaylists,
    lastScan: currentLastScan,
    lastSyncedAt: now,
  };
}

export async function getCoverArtBaseUrl(): Promise<
  (id?: string | null) => string | null
> {
  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);
  return (id?: string | null) => {
    if (!id) return null;
    return `${restBase}/getCoverArt.view?${authQuery}&id=${encodeURIComponent(id)}&size=300`;
  };
}

export async function getSongStreamUrl(songId: string): Promise<string> {
  const creds = await getStoredCredentials();
  const restBase = getRestBaseUrl(creds.serverUrl);
  const authQuery = await buildAuthParams(creds);
  return `${restBase}/stream.view?${authQuery}&id=${encodeURIComponent(songId)}`;
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
