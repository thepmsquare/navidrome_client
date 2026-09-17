import React from "react";
import renderer from "react-test-renderer";

import PlaylistDetailScreen from "@/app/(main)/library/playlist/[id]";
import { getCoverArtBaseUrl, getPlaylist } from "@/services/api";
import { getAllSongCacheEntries, getPlaylistById } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { subscribeSongCache } from "@/services/songCache";
import { Child, Playlist } from "@/types";

const mockBack = jest.fn();
let mockParams = { id: "playlist-1" };

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
  getPlaylist: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getPlaylistById: jest.fn(),
  getAllSongCacheEntries: jest.fn(() => new Map()),
}));

jest.mock("@/services/songCache", () => ({
  subscribeSongCache: jest.fn(() => () => {}),
}));

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn(),
}));

const mockPlaylist: Playlist = {
  id: "playlist-1",
  name: "my playlist",
  comment: "chill vibes",
  owner: "admin",
  songCount: 2,
  duration: 380,
  coverArt: "pl-cover-1",
};

const mockSongs: Child[] = [
  {
    id: "song-10",
    title: "playlist track 1",
    artist: "various",
    album: "compilation",
    coverArt: "cover-10",
    duration: 180,
    size: 5000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
  {
    id: "song-11",
    title: "playlist track 2",
    artist: "various",
    album: "compilation",
    coverArt: "cover-11",
    duration: 200,
    size: 6000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
];

describe("PlaylistDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
  });

  it("plays from track 1 (index 0) when top play icon is pressed after songs load", async () => {
    (getPlaylistById as jest.Mock).mockReturnValue(mockPlaylist);
    (getPlaylist as jest.Mock).mockResolvedValue({
      ...mockPlaylist,
      entry: mockSongs,
    });

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<PlaylistDetailScreen />);
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

  it("disables top play icon when songs list is empty", async () => {
    (getPlaylistById as jest.Mock).mockReturnValue(mockPlaylist);
    (getPlaylist as jest.Mock).mockResolvedValue({
      ...mockPlaylist,
      entry: [],
    });

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<PlaylistDetailScreen />);
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
