import React from "react";
import renderer from "react-test-renderer";

import FavoritesScreen from "@/app/(main)/library/favorites";
import { client_app_sync, getCoverArtBaseUrl } from "@/services/api";
import {
  getAllSongCacheEntries,
  getStarredAlbums,
  getStarredArtists,
  getStarredSongs,
  searchStarredAlbums,
  searchStarredArtists,
  searchStarredSongs,
} from "@/services/db";
import { playPlaylist } from "@/services/player";
import { AlbumID3, ArtistID3, Child } from "@/types";

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("react-native-paper", () => {
  const actual = jest.requireActual("react-native-paper");
  const React = require("react");
  const { View } = require("react-native");
  const MockMenu = ({ children, anchor }: any) => {
    return React.createElement(
      View,
      null,
      anchor,
      children,
    );
  };
  MockMenu.Item = ({ title, onPress }: any) => {
    return React.createElement(
      View,
      { testID: `menu-item-${title}`, onPress, title },
      null,
    );
  };
  return {
    ...actual,
    Menu: MockMenu,
  };
});

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/components/SongCacheButton", () => ({
  SongCacheButton: "SongCacheButton",
}));

jest.mock("@/services/api", () => ({
  client_app_sync: jest.fn().mockResolvedValue({}),
  getCoverArtBaseUrl: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getStarredSongs: jest.fn(),
  getStarredAlbums: jest.fn(),
  getStarredArtists: jest.fn(),
  searchStarredSongs: jest.fn(),
  searchStarredAlbums: jest.fn(),
  searchStarredArtists: jest.fn(),
  getAllSongCacheEntries: jest.fn(() => new Map()),
}));

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn(),
  usePlayerState: jest.fn().mockReturnValue({ currentTrack: null }),
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
    starred: "2026-01-01T00:00:00Z",
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
    starred: "2026-01-02T00:00:00Z",
  },
];

const mockAlbums: AlbumID3[] = [
  {
    id: "album-1",
    name: "dark side of the moon",
    artist: "pink floyd",
    year: 1973,
    songCount: 10,
    starred: "2026-01-01T00:00:00Z",
  },
  {
    id: "album-2",
    name: "the wall",
    artist: "pink floyd",
    year: 1979,
    songCount: 26,
    starred: "2026-01-02T00:00:00Z",
  },
];

const mockArtists: ArtistID3[] = [
  {
    id: "artist-1",
    name: "pink floyd",
    albumCount: 15,
    starred: "2026-01-01T00:00:00Z",
  },
  {
    id: "artist-2",
    name: "led zeppelin",
    albumCount: 9,
    starred: "2026-01-02T00:00:00Z",
  },
];

describe("FavoritesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
    (getStarredSongs as jest.Mock).mockReturnValue(mockSongs);
    (getStarredAlbums as jest.Mock).mockReturnValue(mockAlbums);
    (getStarredArtists as jest.Mock).mockReturnValue(mockArtists);
    (searchStarredSongs as jest.Mock).mockReturnValue([]);
    (searchStarredAlbums as jest.Mock).mockReturnValue([]);
    (searchStarredArtists as jest.Mock).mockReturnValue([]);
  });

  it("renders tracks tab by default with chip selected", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { Chip } = require("react-native-paper");
    const chips = component.root.findAllByType(Chip);
    expect(chips.length).toBe(3);

    const tracksChip = chips.find((c: any) => c.props.children === "tracks");
    expect(tracksChip.props.selected).toBe(true);

    const { SongRow } = require("@/components/SongRow");
    const listItems = component.root.findAllByType(SongRow);
    expect(listItems.length).toBe(2);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("switches to albums tab when albums chip is pressed", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { Chip, Searchbar } = require("react-native-paper");
    const { AlbumRow } = require("@/components/AlbumRow");
    const chips = component.root.findAllByType(Chip);
    const albumsChip = chips.find((c: any) => c.props.children === "albums");

    renderer.act(() => {
      albumsChip.props.onPress();
    });

    const searchbar = component.root.findByType(Searchbar);
    expect(searchbar.props.placeholder).toBe("search albums");

    const albumRows = component.root.findAllByType(AlbumRow);
    expect(albumRows.length).toBe(2);
    expect(albumRows[0].props.album.name).toBe("dark side of the moon");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("switches to artists tab when artists chip is pressed", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { Chip, Searchbar, List } = require("react-native-paper");
    const chips = component.root.findAllByType(Chip);
    const artistsChip = chips.find((c: any) => c.props.children === "artists");

    renderer.act(() => {
      artistsChip.props.onPress();
    });

    const searchbar = component.root.findByType(Searchbar);
    expect(searchbar.props.placeholder).toBe("search artists");

    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBe(2);
    expect(listItems[0].props.title).toBe("led zeppelin");
    expect(listItems[1].props.title).toBe("pink floyd");

    // Press artist navigates to /artist/[id]
    renderer.act(() => {
      listItems[1].props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/artist/[id]",
      params: { id: "artist-1" },
    });

    renderer.act(() => {
      component.unmount();
    });
  });

  it("navigates back when back button pressed", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { Appbar } = require("react-native-paper");
    const backAction = component.root.findByType(Appbar.BackAction);
    renderer.act(() => {
      backAction.props.onPress();
    });

    expect(mockBack).toHaveBeenCalled();

    renderer.act(() => {
      component.unmount();
    });
  });

  it("uses searchStarredSongs when searching on tracks tab", () => {
    (searchStarredSongs as jest.Mock).mockReturnValue([mockSongs[0]]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { Searchbar } = require("react-native-paper");
    const { SongRow } = require("@/components/SongRow");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("numb");
    });

    expect(searchStarredSongs).toHaveBeenCalledWith("numb", 1000);

    const listItems = component.root.findAllByType(SongRow);
    expect(listItems.length).toBe(1);
    expect(listItems[0].props.song.title).toBe("comfortably numb");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("uses searchStarredAlbums when searching on albums tab", () => {
    (searchStarredAlbums as jest.Mock).mockReturnValue([mockAlbums[1]]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { Chip, Searchbar } = require("react-native-paper");
    const { AlbumRow } = require("@/components/AlbumRow");
    const albumsChip = component.root
      .findAllByType(Chip)
      .find((c: any) => c.props.children === "albums");

    renderer.act(() => {
      albumsChip.props.onPress();
    });

    const searchbar = component.root.findByType(Searchbar);
    renderer.act(() => {
      searchbar.props.onChangeText("wall");
    });

    expect(searchStarredAlbums).toHaveBeenCalledWith("wall", 1000);

    const albumRows = component.root.findAllByType(AlbumRow);
    expect(albumRows.length).toBe(1);
    expect(albumRows[0].props.album.name).toBe("the wall");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders empty state when there are no favorites on each tab", () => {
    (getStarredSongs as jest.Mock).mockReturnValue([]);
    (getStarredAlbums as jest.Mock).mockReturnValue([]);
    (getStarredArtists as jest.Mock).mockReturnValue([]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { Text, Chip } = require("react-native-paper");

    // Tracks empty
    let texts = component.root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("no favorite tracks found");

    // Albums empty
    const albumsChip = component.root.findAllByType(Chip).find((c: any) => c.props.children === "albums");
    renderer.act(() => {
      albumsChip.props.onPress();
    });
    texts = component.root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("no favorite albums found");

    // Artists empty
    const artistsChip = component.root.findAllByType(Chip).find((c: any) => c.props.children === "artists");
    renderer.act(() => {
      artistsChip.props.onPress();
    });
    texts = component.root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("no favorite artists found");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("plays track on press", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { SongRow } = require("@/components/SongRow");
    const listItems = component.root.findAllByType(SongRow);

    renderer.act(() => {
      listItems[0].props.onPress();
    });

    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("triggers refresh when pulled down", async () => {
    (getStarredSongs as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { RefreshControl } = require("react-native");
    const refreshControl = component.root.findByType(RefreshControl);
    expect(refreshControl).toBeDefined();
    expect(refreshControl.props.refreshing).toBe(false);

    await renderer.act(async () => {
      refreshControl.props.onRefresh();
    });

    expect(client_app_sync).toHaveBeenCalledWith(false);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("sorts tracks by duration and toggles order", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { Menu, IconButton } = require("react-native-paper");
    const { SongRow } = require("@/components/SongRow");

    // Default title asc: "comfortably numb" then "time"
    let listItems = component.root.findAllByType(SongRow);
    expect(listItems[0].props.song.title).toBe("comfortably numb");

    // Toggle to desc
    const iconButtons = component.root.findAllByType(IconButton);
    const orderBtn = iconButtons.find(
      (btn: any) => btn.props.icon === "sort-ascending",
    );
    expect(orderBtn).toBeDefined();

    renderer.act(() => {
      orderBtn.props.onPress();
    });

    listItems = component.root.findAllByType(SongRow);
    expect(listItems[0].props.song.title).toBe("time");

    // Change sort key to duration
    const menuItems = component.root.findAllByType(Menu.Item);
    const durationOpt = menuItems.find(
      (item: any) => item.props.title === "duration",
    );
    expect(durationOpt).toBeDefined();

    renderer.act(() => {
      durationOpt.props.onPress();
    });

    // In desc, 413s ("time") before 382s ("comfortably numb")
    listItems = component.root.findAllByType(SongRow);
    expect(listItems[0].props.song.title).toBe("time");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("removes unstarred song on onStarredChange", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<FavoritesScreen />);
    });

    const { SongRow } = require("@/components/SongRow");
    let listItems = component.root.findAllByType(SongRow);
    expect(listItems.length).toBe(2);

    renderer.act(() => {
      listItems[0].props.onStarredChange(false);
    });

    listItems = component.root.findAllByType(SongRow);
    expect(listItems.length).toBe(1);
    expect(listItems[0].props.song.id).toBe("song-2");

    renderer.act(() => {
      component.unmount();
    });
  });
});
