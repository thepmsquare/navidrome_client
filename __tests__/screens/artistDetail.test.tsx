import React from "react";
import renderer from "react-test-renderer";

import ArtistDetailScreen from "@/app/artist/[id]";
import { getArtistInfo, getCoverArtBaseUrl, star, unstar } from "@/services/api";
import {
  getAlbumsByArtistId,
  getAllSongCacheEntries,
  getArtistById,
  getSongsByArtistId,
  updateArtistStarred,
} from "@/services/db";
import { playPlaylist } from "@/services/player";
import { AlbumID3, ArtistID3, Child } from "@/types";

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockParams = { id: "artist-1" };

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/components/SongCacheButton", () => ({
  SongCacheButton: "SongCacheButton",
}));

jest.mock("@/components/MiniPlayer", () => ({
  MiniPlayer: "MiniPlayer",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(),
  getArtistInfo: jest.fn(),
  star: jest.fn(),
  unstar: jest.fn(),
  isSyncInProgress: jest.fn().mockReturnValue(false),
  subscribeSyncState: jest.fn().mockReturnValue(jest.fn()),
  subscribeAuthState: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock("@/services/db", () => ({
  getArtistById: jest.fn(),
  getAlbumsByArtistId: jest.fn(),
  getSongsByArtistId: jest.fn(),
  updateArtistStarred: jest.fn(),
  getAllSongCacheEntries: jest.fn(() => new Map()),
  getSyncMeta: jest.fn().mockReturnValue("2026-10-07T12:00:00.000Z"),
}));

jest.mock("@/services/songCache", () => ({
  subscribeSongCache: jest.fn(() => () => {}),
}));

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn(),
  usePlayerState: jest.fn(() => ({
    isPlaying: false,
    currentTrack: null,
  })),
}));

const mockArtist: ArtistID3 = {
  id: "artist-1",
  name: "pink floyd",
  albumCount: 2,
  starred: "2023-01-01T00:00:00Z",
  coverArt: "art-artist-1",
};

const mockAlbums: AlbumID3[] = [
  {
    id: "album-1",
    name: "the dark side of the moon",
    artist: "pink floyd",
    artistId: "artist-1",
    coverArt: "art-album-1",
    year: 1973,
    songCount: 10,
  },
  {
    id: "album-2",
    name: "wish you were here",
    artist: "pink floyd",
    artistId: "artist-1",
    coverArt: "art-album-2",
    year: 1975,
    songCount: 5,
  },
];

const mockSongs: Child[] = [
  {
    id: "song-1",
    title: "time",
    album: "the dark side of the moon",
    albumId: "album-1",
    artist: "pink floyd",
    artistId: "artist-1",
    duration: 425,
    track: 4,
  },
  {
    id: "song-2",
    title: "shine on you crazy diamond",
    album: "wish you were here",
    albumId: "album-2",
    artist: "pink floyd",
    artistId: "artist-1",
    duration: 810,
    track: 1,
  },
];

describe("ArtistDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: "artist-1" };
    (getArtistById as jest.Mock).mockReturnValue(mockArtist);
    (getAlbumsByArtistId as jest.Mock).mockReturnValue(mockAlbums);
    (getSongsByArtistId as jest.Mock).mockReturnValue(mockSongs);
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string) => `https://example.com/art/${id}`,
    );
    (getArtistInfo as jest.Mock).mockResolvedValue({
      biography: "legendary progressive rock band formed in london.",
    });
  });

  it("renders artist details, albums, and songs correctly", async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderer.create(<ArtistDetailScreen />);
    });

    const root = tree!.root;
    expect(root).toBeTruthy();
    expect(getArtistById).toHaveBeenCalledWith("artist-1");
    expect(getAlbumsByArtistId).toHaveBeenCalledWith("artist-1", "pink floyd");
    expect(getSongsByArtistId).toHaveBeenCalledWith("artist-1", "pink floyd");
  });

  it("plays all songs when play button is pressed", async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderer.create(<ArtistDetailScreen />);
    });

    const root = tree!.root;
    const playButtons = root.findAll((node) => node.props?.accessibilityLabel === "play all");
    expect(playButtons.length).toBeGreaterThan(0);

    await renderer.act(async () => {
      playButtons[0].props.onPress();
    });

    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);
  });

  it("renders empty state when artist has no songs", async () => {
    (getSongsByArtistId as jest.Mock).mockReturnValue([]);

    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderer.create(<ArtistDetailScreen />);
    });

    const root = tree!.root;
    const emptyTexts = root.findAll(
      (node) => node.props?.children === "no songs found",
    );
    expect(emptyTexts.length).toBeGreaterThan(0);
  });
});
