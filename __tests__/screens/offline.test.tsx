import React from "react";
import renderer from "react-test-renderer";

import AvailableOfflineScreen from "@/app/(main)/library/offline";
import { getCoverArtBaseUrl } from "@/services/api";
import { getCachedSongs } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { Child } from "@/types";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getCachedSongs: jest.fn(),
}));

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn(),
}));

const mockSongs: Child[] = [
  {
    id: "song-1",
    title: "offline track 1",
    artist: "artist 1",
    album: "album 1",
    coverArt: "cover-1",
    duration: 180,
    size: 5000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
  {
    id: "song-2",
    title: "offline track 2",
    artist: "artist 2",
    album: "album 2",
    coverArt: "cover-2",
    duration: 200,
    size: 6000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
];

describe("AvailableOfflineScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
  });

  it("renders empty state when no songs are cached", () => {
    (getCachedSongs as jest.Mock).mockReturnValue([]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<AvailableOfflineScreen />);
    });

    const texts = component.root
      .findAllByType("Text")
      .map((node: any) => node.props.children)
      .flat();
    expect(texts).toContain("available offline");
    expect(texts).toContain("no songs available offline");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders list of cached songs when songs are present", () => {
    (getCachedSongs as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<AvailableOfflineScreen />);
    });

    const texts = component.root
      .findAllByType("Text")
      .map((node: any) => node.props.children)
      .flat();
    expect(texts).toContain("offline track 1");
    expect(texts).toContain("offline track 2");
    expect(texts).toContain("artist 1 • album 1");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("plays track when item is pressed", () => {
    (getCachedSongs as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<AvailableOfflineScreen />);
    });

    const { List } = require("react-native-paper");
    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBe(2);

    renderer.act(() => {
      listItems[0].props.onPress();
    });

    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);

    renderer.act(() => {
      component.unmount();
    });
  });
});
