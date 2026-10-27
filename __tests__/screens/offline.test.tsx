import React from "react";
import renderer from "react-test-renderer";

import AvailableOfflineScreen from "@/app/(main)/library/offline";
import { getCoverArtBaseUrl } from "@/services/api";
import { getCachedSongs, searchCachedSongs } from "@/services/db";
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

jest.mock("react-native-paper", () => {
  const actual = jest.requireActual("react-native-paper");
  const React = require("react");
  const { View } = require("react-native");
  const MockMenu = ({ visible, children, anchor }: any) => {
    return React.createElement(View, null, anchor, visible ? children : children);
  };
  MockMenu.Item = ({ title, onPress }: any) => {
    return React.createElement(View, { testID: `menu-item-${title}`, onPress, title }, null);
  };
  return {
    ...actual,
    Menu: MockMenu,
  };
});

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getCachedSongs: jest.fn(),
  searchCachedSongs: jest.fn(),
  getAllSongCacheEntries: jest.fn(() => new Map()),
}));

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn(),
  usePlayerState: jest.fn().mockReturnValue({ currentTrack: null }),
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
    (searchCachedSongs as jest.Mock).mockReturnValue([]);
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

  it("renders searchbar with correct placeholder", () => {
    (getCachedSongs as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<AvailableOfflineScreen />);
    });

    const { Searchbar } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);
    expect(searchbar).toBeDefined();
    expect(searchbar.props.placeholder).toBe("search songs");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("uses searchCachedSongs when search query is entered", () => {
    (getCachedSongs as jest.Mock).mockReturnValue(mockSongs);
    (searchCachedSongs as jest.Mock).mockReturnValue([mockSongs[0]]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<AvailableOfflineScreen />);
    });

    const { Searchbar } = require("react-native-paper");
    const { SongRow } = require("@/components/SongRow");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("track 1");
    });

    expect(searchCachedSongs).toHaveBeenCalledWith("track 1", 1000);

    const listItems = component.root.findAllByType(SongRow);
    expect(listItems.length).toBe(1);
    expect(listItems[0].props.song.title).toBe("offline track 1");

    renderer.act(() => {
      listItems[0].props.onPress();
    });

    expect(playPlaylist).toHaveBeenCalledWith([mockSongs[0]], 0);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders 'no songs found' when search has no matches", () => {
    (getCachedSongs as jest.Mock).mockReturnValue(mockSongs);
    (searchCachedSongs as jest.Mock).mockReturnValue([]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<AvailableOfflineScreen />);
    });

    const { Searchbar } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("nonexistent");
    });

    const texts = component.root
      .findAllByType("Text")
      .map((node: any) => node.props.children)
      .flat();
    expect(texts).toContain("no songs found");

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

    const { SongRow } = require("@/components/SongRow");
    const listItems = component.root.findAllByType(SongRow);
    expect(listItems.length).toBe(2);

    renderer.act(() => {
      listItems[0].props.onPress();
    });

    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("triggers refresh when pulled down", async () => {
    (getCachedSongs as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<AvailableOfflineScreen />);
    });

    const { RefreshControl } = require("react-native");
    const refreshControl = component.root.findByType(RefreshControl);
    expect(refreshControl).toBeDefined();
    expect(refreshControl.props.refreshing).toBe(false);

    await renderer.act(async () => {
      refreshControl.props.onRefresh();
    });

    expect(getCachedSongs).toHaveBeenCalled();

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders sort controls and toggles sort order", () => {
    (getCachedSongs as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<AvailableOfflineScreen />);
    });

    const { Button, IconButton, Menu } = require("react-native-paper");
    const sortButton = component.root
      .findAllByType(Button)
      .find((b: any) => typeof b.props.children === "string" && b.props.children.includes("sort by:"));
    expect(sortButton).toBeDefined();
    expect(sortButton.props.children).toBe("sort by: title");

    // Open sort menu
    renderer.act(() => {
      sortButton.props.onPress();
    });

    // Select artist sort
    const menuItems = component.root.findAllByType(Menu.Item);
    const artistItem = menuItems.find((item: any) => item.props.title === "artist");
    expect(artistItem).toBeDefined();

    renderer.act(() => {
      artistItem.props.onPress();
    });

    const updatedSortButton = component.root
      .findAllByType(Button)
      .find((b: any) => typeof b.props.children === "string" && b.props.children.includes("sort by:"));
    expect(updatedSortButton.props.children).toBe("sort by: artist");

    // Toggle sort order
    const sortOrderButton = component.root
      .findAllByType(IconButton)
      .find((b: any) => b.props.icon === "sort-ascending" || b.props.icon === "sort-descending");
    expect(sortOrderButton).toBeDefined();
    expect(sortOrderButton.props.icon).toBe("sort-ascending");

    renderer.act(() => {
      sortOrderButton.props.onPress();
    });

    const updatedOrderButton = component.root
      .findAllByType(IconButton)
      .find((b: any) => b.props.icon === "sort-ascending" || b.props.icon === "sort-descending");
    expect(updatedOrderButton.props.icon).toBe("sort-descending");

    renderer.act(() => {
      component.unmount();
    });
  });
});
