import { createAuthToken, generateSalt } from "@/utils/crypto";
import * as Crypto from "expo-crypto";

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: {
    MD5: "MD5",
  },
  getRandomValues: jest.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = i;
    }
    return array;
  }),
  digestStringAsync: jest.fn().mockResolvedValue("mocked_md5_hash_token"),
}));

describe("crypto utils", () => {
  describe("generateSalt", () => {
    it("should generate a salt string with the default length of 6", () => {
      const salt = generateSalt();
      expect(salt).toHaveLength(6);
      expect(typeof salt).toBe("string");
    });

    it("should generate a salt string with a specified custom length", () => {
      const customLength = 12;
      const salt = generateSalt(customLength);
      expect(salt).toHaveLength(customLength);
    });

    it("should only contain valid lowercase alphanumeric characters", () => {
      const salt = generateSalt(32);
      expect(salt).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe("createAuthToken", () => {
    it("should compute md5 hash using password and salt", async () => {
      const password = "secretpassword";
      const salt = "abc123";

      const token = await createAuthToken(password, salt);

      expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.MD5,
        "secretpasswordabc123",
      );
      expect(token).toBe("mocked_md5_hash_token");
    });
  });
});
