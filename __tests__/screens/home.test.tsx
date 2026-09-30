import React from "react";
import { TouchableOpacity } from "react-native";
import { Text } from "react-native-paper";
import renderer from "react-test-renderer";

import HomeScreen from "@/app/(main)/index";
import * as db from "@/services/db";

const mockPush = jest.fn();
const mockPlayPlaylist = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn().mockResolvedValue((id?: string) => `https://art/${id}`),
}));

jest.mock("@/components/SongCacheButton", () => ({
  SongCacheButton: "SongCacheButton",
}));

jest.mock("@/services/player", () => ({
  playPlaylist: (...args: any[]) => mockPlayPlaylist(...args),
}));

jest.mock("@/services/songCache", () => ({
  subscribeSongCache: jest.fn().mockReturnValue(() => {}),
}));

jest.mock("@/services/db", () => ({
  getMostPlayedAlbums: jest.fn(),
  getRecentlyPlayedAlbums: jest.fn(),
  getRandomSongs: jest.fn(),
  getAllSongCacheEntries: jest.fn().mockReturnValue(new Map()),
}));

const mockAlbums = [
  {
    id: "alb-1",
    name: "Abbey Road",
    artist: "The Beatles",
    coverArt: "art-1",
    playCount: 15,
  },
  {
    id: "alb-2",
    name: "Random Access Memories",
    artist: "Daft Punk",
    coverArt: "art-2",
    playCount: 10,
  },
];

const mockRecentAlbums = [
  {
    id: "alb-3",
    name: "Dark Side of the Moon",
    artist: "Pink Floyd",
    coverArt: "art-3",
    played: "2023-10-01T12:00:00Z",
  },
];

const mockRandomTracks = [
  {
    id: "song-1",
    title: "Time",
    artist: "Pink Floyd",
    album: "Dark Side of the Moon",
    coverArt: "art-3",
  },
  {
    id: "song-2",
    title: "Money",
    artist: "Pink Floyd",
    album: "Dark Side of the Moon",
    coverArt: "art-3",
  },
];

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.getMostPlayedAlbums as jest.Mock).mockReturnValue(mockAlbums);
    (db.getRecentlyPlayedAlbums as jest.Mock).mockReturnValue(mockRecentAlbums);
    (db.getRandomSongs as jest.Mock).mockReturnValue(mockRandomTracks);
  });

  it("renders home header and section titles", async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("home");
    expect(texts).toContain("most played");
    expect(texts).toContain("recently played");
    expect(texts).toContain("random tracks");
  });

  it("renders album titles and artists in most played section", async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("Abbey Road");
    expect(texts).toContain("The Beatles");
    expect(texts).toContain("Random Access Memories");
    expect(texts).toContain("Daft Punk");
  });

  it("navigates to album detail screen when an album tile is pressed", async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const touchables = root.findAllByType(TouchableOpacity);
    // 2 from most played + 1 from recently played = 3 touchable tiles
    expect(touchables.length).toBe(3);

    await renderer.act(async () => {
      touchables[0].props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/album/[id]",
      params: { id: "alb-1" },
    });
  });

  it("renders recently played album and navigates when pressed", async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("Dark Side of the Moon");
    expect(texts).toContain("Pink Floyd");

    const touchables = root.findAllByType(TouchableOpacity);
    await renderer.act(async () => {
      touchables[2].props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/album/[id]",
      params: { id: "alb-3" },
    });
  });

  it("renders empty message when no played albums or recently played albums are available", async () => {
    (db.getMostPlayedAlbums as jest.Mock).mockReturnValue([]);
    (db.getRecentlyPlayedAlbums as jest.Mock).mockReturnValue([]);

    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("no played albums yet");
    expect(texts).toContain("no recently played albums");
  });

  it("renders random tracks and plays playlist when track is pressed", async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const { List } = require("react-native-paper");
    const listItems = root.findAllByType(List.Item);
    expect(listItems.length).toBe(2);
    expect(listItems[0].props.title).toBe("Time");
    expect(listItems[1].props.title).toBe("Money");

    await renderer.act(async () => {
      listItems[0].props.onPress();
    });

    expect(mockPlayPlaylist).toHaveBeenCalledWith(mockRandomTracks, 0);
  });

  it("refreshes random tracks when refresh button is pressed", async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const { IconButton } = require("react-native-paper");
    const refreshBtn = root.findByProps({ icon: "refresh" });
    expect(refreshBtn).toBeDefined();

    const refreshedTracks = [
      {
        id: "song-3",
        title: "Us and Them",
        artist: "Pink Floyd",
        album: "Dark Side of the Moon",
      },
    ];
    (db.getRandomSongs as jest.Mock).mockReturnValue(refreshedTracks);

    await renderer.act(async () => {
      refreshBtn.props.onPress();
    });

    expect(db.getRandomSongs).toHaveBeenCalledWith(10);
    const { List } = require("react-native-paper");
    const listItems = root.findAllByType(List.Item);
    expect(listItems.length).toBe(1);
    expect(listItems[0].props.title).toBe("Us and Them");
  });

  it("renders empty message when no random tracks are available", async () => {
    (db.getRandomSongs as jest.Mock).mockReturnValue([]);

    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("no tracks found");
  });
});
