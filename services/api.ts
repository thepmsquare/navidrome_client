import {
  clearDatabase,
  getLocalCounts,
  getSyncMeta,
  setSyncMeta,
  upsertAlbumsBatch,
  upsertArtistsBatch,
  upsertSongsBatch,
} from "@/services/db";
import {
  PingResponse,
  ScanStatus,
  Search3Params,
  ScrobbleParams,
  SearchResult3,
  ServerCredentials,
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

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync("subsonicVersion");
  await SecureStore.deleteItemAsync("serverUrl");
  await SecureStore.deleteItemAsync("username");
  await SecureStore.deleteItemAsync("password");
  clearDatabase();
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

  const data = await response.json();
  const parsed = subsonicPingResponseWrapperSchema.safeParse(data);
  if (parsed.success && parsed.data["subsonic-response"].status === "ok") {
    return true;
  }
  if (parsed.success && parsed.data["subsonic-response"].error) {
    throw new Error(
      parsed.data["subsonic-response"].error.message || "scrobble failed",
    );
  }
  return true;
}

export async function scrobbleSong(songId: string): Promise<void> {
  try {
    await scrobble({ id: songId, submission: false });
    await scrobble({ id: songId, submission: true, time: Date.now() });
  } catch (error) {
    console.error("failed to scrobble song:", error);
  }
}




