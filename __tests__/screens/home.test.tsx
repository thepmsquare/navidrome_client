import React from "react";
import { TouchableOpacity } from "react-native";
import { Text } from "react-native-paper";
import renderer from "react-test-renderer";

import HomeScreen from "@/app/(main)/index";
import * as db from "@/services/db";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn().mockResolvedValue((id?: string) => `https://art/${id}`),
}));

jest.mock("@/services/db", () => ({
  getMostPlayedAlbums: jest.fn(),
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

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders home header and most played section title", async () => {
    (db.getMostPlayedAlbums as jest.Mock).mockReturnValue(mockAlbums);

    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("home");
    expect(texts).toContain("most played");
  });

  it("renders album titles and artists in most played section", async () => {
    (db.getMostPlayedAlbums as jest.Mock).mockReturnValue(mockAlbums);

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
    (db.getMostPlayedAlbums as jest.Mock).mockReturnValue(mockAlbums);

    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const touchables = root.findAllByType(TouchableOpacity);
    expect(touchables.length).toBe(2);

    await renderer.act(async () => {
      touchables[0].props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/album/[id]",
      params: { id: "alb-1" },
    });
  });

  it("renders empty message when no played albums are available", async () => {
    (db.getMostPlayedAlbums as jest.Mock).mockReturnValue([]);

    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("most played");
    expect(texts).toContain("no played albums yet");
  });
});
