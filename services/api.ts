import {
  PingResponse,
  ServerCredentials,
  subsonicPingResponseWrapperSchema,
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
