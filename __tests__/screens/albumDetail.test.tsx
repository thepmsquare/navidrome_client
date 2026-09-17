import React from "react";
import renderer from "react-test-renderer";

import AlbumDetailScreen from "@/app/(main)/library/album/[id]";
import { getCoverArtBaseUrl } from "@/services/api";
import { getAlbumById, getAllSongCacheEntries, getSongsByAlbumId } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { subscribeSongCache } from "@/services/songCache";
import { AlbumID3, Child } from "@/types";

const mockBack = jest.fn();
let mockParams = { id: "album-1" };

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
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

jest.mock("@/components/BulkSongCacheButton", () => ({
  BulkSongCacheButton: "BulkSongCacheButton",
}));

jest.mock("@/components/SongCacheButton", () => ({
  SongCacheButton: "SongCacheButton",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getAlbumById: jest.fn(),
  getSongsByAlbumId: jest.fn(),
  getAllSongCacheEntries: jest.fn(() => new Map()),
}));

jest.mock("@/services/songCache", () => ({
  subscribeSongCache: jest.fn(() => () => {}),
}));

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn(),
}));

const mockAlbum: AlbumID3 = {
  id: "album-1",
  name: "test album",
  artist: "test artist",
  coverArt: "cover-1",
  songCount: 2,
  year: 2024,
};

const mockSongs: Child[] = [
  {
    id: "song-1",
    title: "track 1",
    artist: "test artist",
    album: "test album",
    coverArt: "cover-1",
    duration: 180,
    size: 5000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
  {
    id: "song-2",
    title: "track 2",
    artist: "test artist",
    album: "test album",
    coverArt: "cover-1",
    duration: 200,
    size: 6000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
];

describe("AlbumDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
  });

  it("plays from track 1 (index 0) when top play icon is pressed", () => {
    (getAlbumById as jest.Mock).mockReturnValue(mockAlbum);
    (getSongsByAlbumId as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<AlbumDetailScreen />);
    });

    const { Appbar } = require("react-native-paper");
    const actions = component.root.findAllByType(Appbar.Action);
    const playAction = actions.find((a: any) => a.props.icon === "play");

    expect(playAction).toBeDefined();
    expect(playAction.props.disabled).toBe(false);

    renderer.act(() => {
      playAction.props.onPress();
    });

    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("disables top play icon when there are no songs", () => {
    (getAlbumById as jest.Mock).mockReturnValue(mockAlbum);
    (getSongsByAlbumId as jest.Mock).mockReturnValue([]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<AlbumDetailScreen />);
    });

    const { Appbar } = require("react-native-paper");
    const actions = component.root.findAllByType(Appbar.Action);
    const playAction = actions.find((a: any) => a.props.icon === "play");

    expect(playAction).toBeDefined();
    expect(playAction.props.disabled).toBe(true);

    renderer.act(() => {
      playAction.props.onPress();
    });

    expect(playPlaylist).not.toHaveBeenCalled();

    renderer.act(() => {
      component.unmount();
    });
  });
});
