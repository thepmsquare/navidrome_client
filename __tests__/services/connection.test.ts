import * as SecureStore from "expo-secure-store";

import * as api from "@/services/api";
import {
  addServerUrl,
  getServerConnectionState,
  normalizeServerUrl,
  pingServerUrl,
  removeServerUrl,
  saveServerUrls,
  switchActiveServerUrl,
} from "@/services/connection";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@/services/api", () => ({
  ping: jest.fn(),
}));

describe("connection service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("normalizeServerUrl", () => {
    it("adds http:// if protocol is missing and removes trailing slash", () => {
      expect(normalizeServerUrl("example.com/")).toBe("http://example.com");
      expect(normalizeServerUrl("https://example.com:4533///")).toBe(
        "https://example.com:4533",
      );
    });
  });

  describe("getServerConnectionState", () => {
    it("returns null values when secure store is empty", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const state = await getServerConnectionState();
      expect(state.activeUrl).toBeNull();
      expect(state.activeLabel).toBeNull();
      expect(state.serverUrls).toEqual([]);
    });

    it("backfills serverUrls if activeUrl exists but serverUrls was missing", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === "serverUrl") return Promise.resolve("http://primary.com");
        if (key === "serverUrlLabel") return Promise.resolve("primary");
        return Promise.resolve(null);
      });

      const state = await getServerConnectionState();
      expect(state.activeUrl).toBe("http://primary.com");
      expect(state.serverUrls).toEqual([
        { url: "http://primary.com", label: "primary" },
      ]);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "serverUrls",
        JSON.stringify([{ url: "http://primary.com", label: "primary" }]),
      );
    });

    it("parses stored serverUrls and ensures activeUrl is included", async () => {
      const stored = [{ url: "http://alt.com", label: "alt" }];
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === "serverUrl") return Promise.resolve("http://active.com");
        if (key === "serverUrls") return Promise.resolve(JSON.stringify(stored));
        return Promise.resolve(null);
      });

      const state = await getServerConnectionState();
      expect(state.serverUrls.length).toBe(2);
      expect(state.serverUrls.some((u) => u.url === "http://active.com")).toBe(
        true,
      );
    });
  });

  describe("switchActiveServerUrl", () => {
    it("updates serverUrl and serverUrlLabel in secure store", async () => {
      await switchActiveServerUrl("http://new-active.com", "new label");

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "serverUrl",
        "http://new-active.com",
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "serverUrlLabel",
        "new label",
      );
    });

    it("deletes serverUrlLabel if label is null", async () => {
      await switchActiveServerUrl("http://new-active.com", null);

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "serverUrlLabel",
      );
    });
  });

  describe("addServerUrl", () => {
    it("adds a normalized server url to the list", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === "serverUrl") return Promise.resolve("http://primary.com");
        if (key === "serverUrls")
          return Promise.resolve(
            JSON.stringify([{ url: "http://primary.com", label: "primary" }]),
          );
        return Promise.resolve(null);
      });

      const updated = await addServerUrl("newserver.com", "backup");
      expect(updated).toHaveLength(2);
      expect(updated[1]).toEqual({
        url: "http://newserver.com",
        label: "backup",
      });
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "serverUrls",
        JSON.stringify(updated),
      );
    });

    it("throws error if url already exists", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === "serverUrls")
          return Promise.resolve(
            JSON.stringify([{ url: "http://primary.com", label: "primary" }]),
          );
        return Promise.resolve(null);
      });

      await expect(addServerUrl("http://primary.com")).rejects.toThrow(
        "server url already exists",
      );
    });
  });

  describe("removeServerUrl", () => {
    it("removes an alternative server url", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === "serverUrl") return Promise.resolve("http://primary.com");
        if (key === "serverUrls")
          return Promise.resolve(
            JSON.stringify([
              { url: "http://primary.com", label: "primary" },
              { url: "http://alt.com", label: "alt" },
            ]),
          );
        return Promise.resolve(null);
      });

      const updated = await removeServerUrl("http://alt.com");
      expect(updated).toHaveLength(1);
      expect(updated[0].url).toBe("http://primary.com");
    });

    it("throws error when attempting to remove the active server url", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === "serverUrl") return Promise.resolve("http://primary.com");
        if (key === "serverUrls")
          return Promise.resolve(
            JSON.stringify([
              { url: "http://primary.com", label: "primary" },
              { url: "http://alt.com", label: "alt" },
            ]),
          );
        return Promise.resolve(null);
      });

      await expect(removeServerUrl("http://primary.com")).rejects.toThrow(
        "cannot remove active server url",
      );
    });

    it("throws error when only one server url remains", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === "serverUrl") return Promise.resolve(null);
        if (key === "serverUrls")
          return Promise.resolve(
            JSON.stringify([{ url: "http://other.com", label: "other" }]),
          );
        return Promise.resolve(null);
      });

      await expect(removeServerUrl("http://other.com")).rejects.toThrow(
        "at least one server url is required",
      );
    });
  });

  describe("saveServerUrls", () => {
    it("saves server urls directly to secure store", async () => {
      const urls = [{ url: "http://test.com", label: "test" }];
      await saveServerUrls(urls);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "serverUrls",
        JSON.stringify(urls),
      );
    });
  });

  describe("pingServerUrl", () => {
    it("returns latency and version when ping succeeds", async () => {
      (api.ping as jest.Mock).mockResolvedValueOnce({
        status: "ok",
        version: "1.16.1",
        type: "navidrome",
      });

      const result = await pingServerUrl("http://navidrome.org");
      expect(result.version).toBe("1.16.1");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("throws when ping fails", async () => {
      (api.ping as jest.Mock).mockRejectedValueOnce(
        new Error("network failure"),
      );

      await expect(pingServerUrl("http://bad.org")).rejects.toThrow(
        "network failure",
      );
    });
  });
});
