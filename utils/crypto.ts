import * as Crypto from "expo-crypto";

export function generateSalt(length: number = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let salt = "";
  const bytes = new Uint8Array(length);
  Crypto.getRandomValues(bytes);

  for (let i = 0; i < length; i++) {
    salt += chars[bytes[i] % chars.length];
  }
  return salt;
}

export async function createAuthToken(
  password: string,
  salt: string,
): Promise<string> {
  const input = password + salt;

  const token = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.MD5,
    input,
  );

  return token;
}
