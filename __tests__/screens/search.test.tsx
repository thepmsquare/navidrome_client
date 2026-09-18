import React from "react";
import renderer from "react-test-renderer";

import SearchScreen from "@/app/(main)/search";
import { getCoverArtBaseUrl } from "@/services/api";
import {
  getAllSongCacheEntries,
  searchAlbums,
  searchArtists,
  searchPlaylists,
  searchSongs,
} from "@/services/db";
import { playPlaylist } from "@/services/player";
import { AlbumID3, ArtistID3, Child, Playlist } from "@/types";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
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
  searchSongs: jest.fn(),
  searchAlbums: jest.fn(),
  searchArtists: jest.fn(),
  searchPlaylists: jest.fn(),
  getAllSongCacheEntries: jest.fn(() => new Map()),
}));

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn(),
}));

const mockSongs: Child[] = [
  {
    id: "s1",
    title: "comfortably numb",
    artist: "pink floyd",
    album: "the wall",
    duration: 382,
    size: 5000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
];

const mockAlbums: AlbumID3[] = [
  {
    id: "a1",
    name: "the wall",
    artist: "pink floyd",
    songCount: 26,
    year: 1979,
  },
];

const mockArtists: ArtistID3[] = [
  {
    id: "ar1",
    name: "pink floyd",
    albumCount: 15,
  },
];

const mockPlaylists: Playlist[] = [
  {
    id: "p1",
    name: "classic rock",
    songCount: 50,
  },
];

describe("SearchScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
    (searchSongs as jest.Mock).mockReturnValue([]);
    (searchAlbums as jest.Mock).mockReturnValue([]);
    (searchArtists as jest.Mock).mockReturnValue([]);
    (searchPlaylists as jest.Mock).mockReturnValue([]);
  });

  it("renders searchbar and initial empty prompt", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Searchbar, Text } = require("react-native-paper");
    const searchbars = component.root.findAllByType(Searchbar);
    expect(searchbars.length).toBe(1);
    expect(searchbars[0].props.placeholder).toBe("search songs, albums, artists...");

    const texts = component.root.findAllByType(Text);
    const hasInitialPrompt = texts.some((t: any) =>
      typeof t.props.children === "string" &&
      t.props.children.includes("type to search your library"),
    );
    expect(hasInitialPrompt).toBe(true);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("updates results across all categories when search query is entered", () => {
    (searchSongs as jest.Mock).mockReturnValue(mockSongs);
    (searchAlbums as jest.Mock).mockReturnValue(mockAlbums);
    (searchArtists as jest.Mock).mockReturnValue(mockArtists);
    (searchPlaylists as jest.Mock).mockReturnValue(mockPlaylists);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Searchbar, List } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("pink");
    });

    expect(searchSongs).toHaveBeenCalledWith("pink", expect.any(Number));
    expect(searchAlbums).toHaveBeenCalledWith("pink", expect.any(Number));
    expect(searchArtists).toHaveBeenCalledWith("pink", expect.any(Number));
    expect(searchPlaylists).toHaveBeenCalledWith("pink", expect.any(Number));

    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBeGreaterThanOrEqual(4);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("plays song when song item is pressed", () => {
    (searchSongs as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Searchbar, List } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("numb");
    });

    const listItems = component.root.findAllByType(List.Item);
    const songItem = listItems.find(
      (item: any) => item.props.title === "comfortably numb",
    );
    expect(songItem).toBeDefined();

    renderer.act(() => {
      songItem.props.onPress();
    });

    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("navigates to album when album item is pressed", () => {
    (searchAlbums as jest.Mock).mockReturnValue(mockAlbums);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Searchbar, List } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("wall");
    });

    const listItems = component.root.findAllByType(List.Item);
    const albumItem = listItems.find(
      (item: any) => item.props.title === "the wall",
    );
    expect(albumItem).toBeDefined();

    renderer.act(() => {
      albumItem.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(main)/library/album/[id]",
      params: { id: "a1" },
    });

    renderer.act(() => {
      component.unmount();
    });
  });

  it("filters to category when chip is pressed", () => {
    (searchSongs as jest.Mock).mockReturnValue(mockSongs);
    (searchAlbums as jest.Mock).mockReturnValue(mockAlbums);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Searchbar, Chip, List } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("test");
    });

    const chips = component.root.findAllByType(Chip);
    const albumsChip = chips.find((c: any) => {
      const label = typeof c.props.children === "string" ? c.props.children : "";
      return label === "albums";
    });
    expect(albumsChip).toBeDefined();

    renderer.act(() => {
      albumsChip.props.onPress();
    });

    const listItems = component.root.findAllByType(List.Item);
    // Should now only show album items
    const hasSong = listItems.some(
      (item: any) => item.props.title === "comfortably numb",
    );
    const hasAlbum = listItems.some(
      (item: any) => item.props.title === "the wall",
    );
    expect(hasSong).toBe(false);
    expect(hasAlbum).toBe(true);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("shows no results found when search yields no matches", () => {
    (searchSongs as jest.Mock).mockReturnValue([]);
    (searchAlbums as jest.Mock).mockReturnValue([]);
    (searchArtists as jest.Mock).mockReturnValue([]);
    (searchPlaylists as jest.Mock).mockReturnValue([]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Searchbar, Text } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("nonexistent12345");
    });

    const texts = component.root.findAllByType(Text);
    const hasNoResults = texts.some((t: any) =>
      typeof t.props.children === "string" &&
      t.props.children.includes("no results found"),
    );
    expect(hasNoResults).toBe(true);

    renderer.act(() => {
      component.unmount();
    });
  });
});
