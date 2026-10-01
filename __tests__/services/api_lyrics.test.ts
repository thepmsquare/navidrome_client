import { getLyricsBySongId } from "@/services/api";
import * as SecureStore from "expo-secure-store";

declare let global: any;

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@/utils/crypto", () => ({
  generateSalt: jest.fn(() => "mockSalt123"),
  createAuthToken: jest.fn(async () => "mockAuthToken456"),
}));

describe("api service: getLyricsBySongId", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === "serverUrl") return Promise.resolve("http://navidrome.local");
      if (key === "username") return Promise.resolve("testuser");
      if (key === "password") return Promise.resolve("testpass");
      if (key === "subsonicVersion") return Promise.resolve("1.16.1");
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should return empty array if id is empty or whitespace", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    expect(await getLyricsBySongId("")).toEqual([]);
    expect(await getLyricsBySongId("   ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should return structured lyrics on successful response", async () => {
    const mockResponse = {
      "subsonic-response": {
        status: "ok",
        version: "1.16.1",
        type: "navidrome",
        openSubsonic: true,
        lyricsList: {
          structuredLyrics: [
            {
              lang: "eng",
              synced: true,
              offset: 150,
              line: [
                { start: 1000, value: "line one" },
                { start: 2000, value: "line two" },
              ],
            },
          ],
        },
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await getLyricsBySongId("song-123");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/rest/getLyricsBySongId.view?"),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("id=song-123"),
    );
    expect(result).toHaveLength(1);
    expect(result[0].lang).toBe("eng");
    expect(result[0].synced).toBe(true);
    expect(result[0].offset).toBe(150);
    expect(result[0].line).toHaveLength(2);
  });

  it("should return empty array when structuredLyrics is missing or empty", async () => {
    const mockResponse = {
      "subsonic-response": {
        status: "ok",
        version: "1.16.1",
        lyricsList: {},
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await getLyricsBySongId("song-no-lyrics");
    expect(result).toEqual([]);
  });

  it("should return empty array when server returns Subsonic error 70 (not found)", async () => {
    const mockResponse = {
      "subsonic-response": {
        status: "failed",
        error: {
          code: 70,
          message: "The requested data was not found",
        },
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await getLyricsBySongId("song-err-70");
    expect(result).toEqual([]);
  });

  it("should throw error when server returns generic Subsonic error", async () => {
    const mockResponse = {
      "subsonic-response": {
        status: "failed",
        error: {
          code: 10,
          message: "Required parameter is missing",
        },
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    await expect(getLyricsBySongId("song-err-10")).rejects.toThrow(
      "Required parameter is missing",
    );
  });

  it("should throw error when HTTP status is not ok (e.g. 404, 501, 500)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    await expect(getLyricsBySongId("song-404")).rejects.toThrow(
      "getLyricsBySongId failed with status 404",
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 501,
    });
    await expect(getLyricsBySongId("song-501")).rejects.toThrow(
      "getLyricsBySongId failed with status 501",
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    await expect(getLyricsBySongId("song-500")).rejects.toThrow(
      "getLyricsBySongId failed with status 500",
    );
  });

  it("should throw error on network failure or invalid JSON", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network offline"));

    await expect(getLyricsBySongId("song-offline")).rejects.toThrow(
      "Network offline",
    );
  });

  it("should throw error on timeout", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("The operation was aborted due to timeout"));

    await expect(getLyricsBySongId("song-timeout")).rejects.toThrow(
      "The operation was aborted due to timeout",
    );
  });
});
