import { createAuthToken, generateSalt } from "@/utils/crypto";

export interface ServerCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

function getRestBaseUrl(rawUrl: string): string {
  const cleanUrl = rawUrl.replace(/\/+$/, "");
  return `${cleanUrl}/rest`;
}

async function buildAuthParams(
  credentials: ServerCredentials,
): Promise<string> {
  const { username, password } = credentials;
  const salt = generateSalt(6);
  const token = await createAuthToken(password, salt);

  const params = new URLSearchParams({
    u: username,
    t: token,
    s: salt,
    // TODO: think about this
    v: "1.12.0",
    // TODO: take from constants
    c: "myapp",
    f: "json",
  });

  return params.toString();
}

export async function ping(serverUrl: string) {
  const restBase = getRestBaseUrl(serverUrl);

  const url = `${restBase}/ping`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const data = await response.json();
  const res = data["subsonic-response"];

  if (res.status !== "ok") {
    throw new Error(res.error?.message || "Ping failed");
  }

  return res;
}

export async function login(credentials: ServerCredentials) {
  const restBase = getRestBaseUrl(credentials.serverUrl);
  const authQuery = await buildAuthParams(credentials);
  const url = `${restBase}/ping.view?${authQuery}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const data = await response.json();
  const res = data["subsonic-response"];

  if (res.status !== "ok") {
    throw new Error(res.error?.message || "Login failed: Invalid credentials");
  }

  return res;
}
