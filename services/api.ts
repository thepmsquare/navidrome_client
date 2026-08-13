import {
  PingResponse,
  Search3Counts,
  Search3Params,
  SearchResult3,
  ServerCredentials,
  subsonicPingResponseWrapperSchema,
  subsonicSearch3ResponseWrapperSchema,
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

export async function search3(
  params: Search3Params,
  credentials?: ServerCredentials,
): Promise<SearchResult3> {
  const creds = credentials || (await getStoredCredentials());
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

export async function getArtistAlbumSongCounts(): Promise<Search3Counts> {
  const batchSize = 500;
  let artistOffset = 0;
  let albumOffset = 0;
  let songOffset = 0;

  let totalArtistCount = 0;
  let totalAlbumCount = 0;
  let totalSongCount = 0;

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

    const artistsLength = res.artist?.length ?? 0;
    const albumsLength = res.album?.length ?? 0;
    const songsLength = res.song?.length ?? 0;

    if (artistsLength > 0) {
      totalArtistCount += artistsLength;
      artistOffset += artistsLength;
    }
    if (artistsLength < batchSize) {
      fetchArtists = false;
    }

    if (albumsLength > 0) {
      totalAlbumCount += albumsLength;
      albumOffset += albumsLength;
    }
    if (albumsLength < batchSize) {
      fetchAlbums = false;
    }

    if (songsLength > 0) {
      totalSongCount += songsLength;
      songOffset += songsLength;
    }
    if (songsLength < batchSize) {
      fetchSongs = false;
    }
  }

  return {
    artistCount: totalArtistCount,
    albumCount: totalAlbumCount,
    songCount: totalSongCount,
  };
}
