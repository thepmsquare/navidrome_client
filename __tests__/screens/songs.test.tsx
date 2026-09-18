import React from "react";
import renderer from "react-test-renderer";

import SongsScreen from "@/app/(main)/library/songs";
import { getCoverArtBaseUrl } from "@/services/api";
import {
  getAllSongCacheEntries,
  getAllSongs,
  searchSongs,
} from "@/services/db";
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

jest.mock("@/components/SongCacheButton", () => ({
  SongCacheButton: "SongCacheButton",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getAllSongs: jest.fn(),
  searchSongs: jest.fn(),
  getAllSongCacheEntries: jest.fn(() => new Map()),
}));

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn(),
}));

const mockSongs: Child[] = [
  {
    id: "song-1",
    title: "comfortably numb",
    artist: "pink floyd",
    album: "the wall",
    duration: 382,
    size: 5000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
  {
    id: "song-2",
    title: "time",
    artist: "pink floyd",
    album: "dark side of the moon",
    duration: 413,
    size: 6000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
];

describe("SongsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
    (getAllSongs as jest.Mock).mockReturnValue(mockSongs);
    (searchSongs as jest.Mock).mockReturnValue([]);
  });

  it("renders all songs initially", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<SongsScreen />);
    });

    const { List } = require("react-native-paper");
    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBe(2);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("uses searchSongs when search query is entered", () => {
    (searchSongs as jest.Mock).mockReturnValue([mockSongs[0]]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SongsScreen />);
    });

    const { Searchbar, List } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("numb");
    });

    expect(searchSongs).toHaveBeenCalledWith("numb", 1000);

    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBe(1);
    expect(listItems[0].props.title).toBe("comfortably numb");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("plays song on press", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<SongsScreen />);
    });

    const { List } = require("react-native-paper");
    const listItems = component.root.findAllByType(List.Item);

    renderer.act(() => {
      listItems[0].props.onPress();
    });

    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);

    renderer.act(() => {
      component.unmount();
    });
  });
});
