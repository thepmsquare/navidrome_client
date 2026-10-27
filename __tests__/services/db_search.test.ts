import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  searchAlbums,
  searchArtists,
  searchCachedSongs,
  searchPlaylists,
  searchSongs,
} from "@/services/db";
import { AlbumID3, ArtistID3, Child, Playlist } from "@/types";

const mockGetAllSync = jest.fn();
const mockRunSync = jest.fn();

jest.mock("expo-sqlite", () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(),
    getAllSync: mockGetAllSync,
    runSync: mockRunSync,
    withTransactionSync: jest.fn((cb: () => void) => cb()),
    prepareSync: jest.fn(),
  })),
}));

describe("services/db search functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("searchSongs", () => {
    it("returns empty array when query is empty or only whitespace", () => {
      expect(searchSongs("")).toEqual([]);
      expect(searchSongs("   ")).toEqual([]);
      expect(mockGetAllSync).not.toHaveBeenCalled();
    });

    it("queries SQLite with tokens and fuzzy patterns", () => {
      const mockResult: Child[] = [
        {
          id: "s1",
          title: "comfortably numb",
          artist: "pink floyd",
          album: "the wall",
          duration: 382,
          size: 1000,
          contentType: "audio/mp3",
          suffix: "mp3",
        },
      ];
      mockGetAllSync.mockReturnValue(mockResult);

      const res = searchSongs("pink numb");
      expect(mockGetAllSync).toHaveBeenCalled();
      expect(res).toEqual(mockResult);
    });

    it("respects custom limit", () => {
      mockGetAllSync.mockReturnValue([]);
      searchSongs("test", 10);
      expect(mockGetAllSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10]),
      );
    });
  });

  describe("searchCachedSongs", () => {
    it("returns empty array when query is empty or only whitespace", () => {
      expect(searchCachedSongs("")).toEqual([]);
      expect(searchCachedSongs("   ")).toEqual([]);
      expect(mockGetAllSync).not.toHaveBeenCalled();
    });

    it("queries SQLite joined with song_cache", () => {
      const mockResult: Child[] = [
        {
          id: "s1",
          title: "offline track",
          artist: "artist 1",
          album: "album 1",
          duration: 200,
          size: 1000,
          contentType: "audio/mp3",
          suffix: "mp3",
        },
      ];
      mockGetAllSync.mockReturnValue(mockResult);

      const res = searchCachedSongs("track");
      expect(mockGetAllSync).toHaveBeenCalledWith(
        expect.stringContaining("INNER JOIN song_cache"),
        expect.any(Array),
      );
      expect(res).toEqual(mockResult);
    });

    it("respects custom limit", () => {
      mockGetAllSync.mockReturnValue([]);
      searchCachedSongs("test", 100);
      expect(mockGetAllSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([100]),
      );
    });
  });

  describe("searchAlbums", () => {
    it("returns empty array for empty query", () => {
      expect(searchAlbums("")).toEqual([]);
      expect(mockGetAllSync).not.toHaveBeenCalled();
    });

    it("queries albums with name and artist", () => {
      const mockAlbums: AlbumID3[] = [
        {
          id: "a1",
          name: "dark side of the moon",
          artist: "pink floyd",
        },
      ];
      mockGetAllSync.mockReturnValue(mockAlbums);

      const res = searchAlbums("dark side");
      expect(mockGetAllSync).toHaveBeenCalled();
      expect(res).toEqual(mockAlbums);
    });
  });

  describe("searchArtists", () => {
    it("returns empty array for empty query", () => {
      expect(searchArtists("")).toEqual([]);
      expect(mockGetAllSync).not.toHaveBeenCalled();
    });

    it("queries artists with name", () => {
      const mockArtists: ArtistID3[] = [
        {
          id: "ar1",
          name: "pink floyd",
        },
      ];
      mockGetAllSync.mockReturnValue(mockArtists);

      const res = searchArtists("floyd");
      expect(mockGetAllSync).toHaveBeenCalled();
      expect(res).toEqual(mockArtists);
    });
  });

  describe("searchPlaylists", () => {
    it("returns empty array for empty query", () => {
      expect(searchPlaylists("")).toEqual([]);
      expect(mockGetAllSync).not.toHaveBeenCalled();
    });

    it("queries playlists with name", () => {
      const mockPlaylists: Playlist[] = [
        {
          id: "p1",
          name: "rock classics",
        },
      ];
      mockGetAllSync.mockReturnValue(mockPlaylists);

      const res = searchPlaylists("classics");
      expect(mockGetAllSync).toHaveBeenCalled();
      expect(res).toEqual(mockPlaylists);
    });
  });

  describe("recent searches functions", () => {
    describe("getRecentSearches", () => {
      it("queries recent_searches ordered by timestamp desc with default limit", () => {
        mockGetAllSync.mockReturnValue([{ query: "floyd" }, { query: "beatles" }]);
        const res = getRecentSearches();
        expect(mockGetAllSync).toHaveBeenCalledWith(
          expect.stringContaining("FROM recent_searches ORDER BY timestamp DESC LIMIT ?"),
          [20],
        );
        expect(res).toEqual(["floyd", "beatles"]);
      });

      it("respects custom limit", () => {
        mockGetAllSync.mockReturnValue([{ query: "floyd" }]);
        const res = getRecentSearches(5);
        expect(mockGetAllSync).toHaveBeenCalledWith(expect.any(String), [5]);
        expect(res).toEqual(["floyd"]);
      });
    });

    describe("addRecentSearch", () => {
      it("ignores empty or whitespace query", () => {
        addRecentSearch("");
        addRecentSearch("   ");
        expect(mockRunSync).not.toHaveBeenCalled();
      });

      it("inserts trimmed query and prunes older searches", () => {
        addRecentSearch("  pink floyd  ");
        expect(mockRunSync).toHaveBeenCalledTimes(2);
        expect(mockRunSync).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining("INSERT INTO recent_searches"),
          ["pink floyd", expect.any(Number)],
        );
        expect(mockRunSync).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining("DELETE FROM recent_searches WHERE id NOT IN"),
        );
      });
    });

    describe("removeRecentSearch", () => {
      it("deletes specified recent search", () => {
        removeRecentSearch("pink floyd");
        expect(mockRunSync).toHaveBeenCalledWith(
          "DELETE FROM recent_searches WHERE query = ?",
          ["pink floyd"],
        );
      });
    });

    describe("clearRecentSearches", () => {
      it("deletes all recent searches", () => {
        clearRecentSearches();
        expect(mockRunSync).toHaveBeenCalledWith("DELETE FROM recent_searches");
      });
    });
  });
});

