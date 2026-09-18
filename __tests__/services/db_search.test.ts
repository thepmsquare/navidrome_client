import {
  searchAlbums,
  searchArtists,
  searchPlaylists,
  searchSongs,
} from "@/services/db";
import { AlbumID3, ArtistID3, Child, Playlist } from "@/types";

const mockGetAllSync = jest.fn();

jest.mock("expo-sqlite", () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(),
    getAllSync: mockGetAllSync,
    runSync: jest.fn(),
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
});
