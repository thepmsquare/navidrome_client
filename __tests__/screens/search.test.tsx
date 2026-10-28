import React from "react";
import renderer from "react-test-renderer";

import SearchScreen from "@/app/(main)/search";
import { getCoverArtBaseUrl } from "@/services/api";
import {
  addRecentSearch,
  clearRecentSearches,
  getAllSongCacheEntries,
  getRecentSearches,
  removeRecentSearch,
  searchAlbums,
  searchArtists,
  searchCachedAlbums,
  searchCachedArtists,
  searchCachedSongs,
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
  searchCachedSongs: jest.fn(),
  searchCachedAlbums: jest.fn(),
  searchCachedArtists: jest.fn(),
  getAllSongCacheEntries: jest.fn(() => new Map()),
  getRecentSearches: jest.fn(() => []),
  addRecentSearch: jest.fn(),
  removeRecentSearch: jest.fn(),
  clearRecentSearches: jest.fn(),
}));

jest.mock("@/services/songCache", () => ({
  subscribeSongCache: jest.fn(() => () => {}),
}));

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn(),
  usePlayerState: jest.fn().mockReturnValue({ currentTrack: null }),
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
    (searchCachedSongs as jest.Mock).mockReturnValue([]);
    (searchCachedAlbums as jest.Mock).mockReturnValue([]);
    (searchCachedArtists as jest.Mock).mockReturnValue([]);
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

    const { SongRow } = require("@/components/SongRow");
    const listItems = component.root.findAllByType(List.Item);
    const songRows = component.root.findAllByType(SongRow);
    expect(listItems.length + songRows.length).toBeGreaterThanOrEqual(4);

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

    const { Searchbar } = require("react-native-paper");
    const { SongRow } = require("@/components/SongRow");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("numb");
    });

    const songRows = component.root.findAllByType(SongRow);
    const songItem = songRows.find(
      (item: any) => item.props.song.title === "comfortably numb",
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
      pathname: "/album/[id]",
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

  it("toggles available offline filter chip and queries cached search helpers", () => {
    (searchCachedSongs as jest.Mock).mockReturnValue(mockSongs);
    (searchCachedAlbums as jest.Mock).mockReturnValue(mockAlbums);
    (searchCachedArtists as jest.Mock).mockReturnValue(mockArtists);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Searchbar, Chip } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("pink");
    });

    expect(searchSongs).toHaveBeenCalledWith("pink", expect.any(Number));
    expect(searchCachedSongs).not.toHaveBeenCalled();

    const chips = component.root.findAllByType(Chip);
    const offlineChip = chips.find(
      (c: any) => c.props.children === "available offline",
    );
    expect(offlineChip).toBeDefined();

    renderer.act(() => {
      offlineChip.props.onPress();
    });

    expect(searchCachedSongs).toHaveBeenCalledWith("pink", expect.any(Number));
    expect(searchCachedAlbums).toHaveBeenCalledWith("pink", expect.any(Number));
    expect(searchCachedArtists).toHaveBeenCalledWith("pink", expect.any(Number));

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

  it("renders recent search chips and clear button when recent searches exist", () => {
    (getRecentSearches as jest.Mock).mockReturnValue(["pink floyd", "the wall"]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Chip, Button, Text } = require("react-native-paper");
    const texts = component.root.findAllByType(Text);
    const hasRecentTitle = texts.some(
      (t: any) => t.props.children === "recent searches",
    );
    expect(hasRecentTitle).toBe(true);

    const buttons = component.root.findAllByType(Button);
    const clearButton = buttons.find((b: any) => {
      const label = typeof b.props.children === "string" ? b.props.children : "";
      return label.includes("clear");
    });
    expect(clearButton).toBeDefined();

    const chips = component.root.findAllByType(Chip);
    const pinkChip = chips.find((c: any) => c.props.children === "pink floyd");
    const wallChip = chips.find((c: any) => c.props.children === "the wall");
    expect(pinkChip).toBeDefined();
    expect(wallChip).toBeDefined();

    renderer.act(() => {
      component.unmount();
    });
  });

  it("populates search query and refreshes recent searches when a chip is pressed", () => {
    (getRecentSearches as jest.Mock).mockReturnValue(["pink floyd"]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Chip, Searchbar } = require("react-native-paper");
    const chip = component.root
      .findAllByType(Chip)
      .find((c: any) => c.props.children === "pink floyd");
    expect(chip).toBeDefined();

    renderer.act(() => {
      chip.props.onPress();
    });

    expect(addRecentSearch).toHaveBeenCalledWith("pink floyd");
    const searchbar = component.root.findByType(Searchbar);
    expect(searchbar.props.value).toBe("pink floyd");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("removes recent search when chip close icon is pressed", () => {
    (getRecentSearches as jest.Mock).mockReturnValue(["pink floyd"]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Chip } = require("react-native-paper");
    const chip = component.root
      .findAllByType(Chip)
      .find((c: any) => c.props.children === "pink floyd");

    renderer.act(() => {
      chip.props.onClose();
    });

    expect(removeRecentSearch).toHaveBeenCalledWith("pink floyd");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("clears all recent searches and returns to empty view when clear button is pressed", () => {
    (getRecentSearches as jest.Mock).mockReturnValue(["pink floyd"]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Button, Text } = require("react-native-paper");
    const buttons = component.root.findAllByType(Button);
    const clearButton = buttons.find((b: any) => {
      const label = typeof b.props.children === "string" ? b.props.children : "";
      return label.includes("clear");
    });
    expect(clearButton).toBeDefined();

    renderer.act(() => {
      clearButton.props.onPress();
    });

    expect(clearRecentSearches).toHaveBeenCalled();
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

  it("saves search to recent searches on submitEditing", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<SearchScreen />);
    });

    const { Searchbar } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("queen");
    });

    renderer.act(() => {
      searchbar.props.onSubmitEditing();
    });

    expect(addRecentSearch).toHaveBeenCalledWith("queen");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("saves search to recent searches on song item press", () => {
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

    const { SongRow } = require("@/components/SongRow");
    const songRows = component.root.findAllByType(SongRow);
    const songItem = songRows.find(
      (item: any) => item.props.song.title === "comfortably numb",
    );
    expect(songItem).toBeDefined();

    renderer.act(() => {
      songItem.props.onPress();
    });

    expect(addRecentSearch).toHaveBeenCalledWith("numb");
    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);

    renderer.act(() => {
      component.unmount();
    });
  });
});

