import React from "react";
import renderer from "react-test-renderer";

import PlaylistsScreen from "@/app/(main)/library/playlists";
import { getCoverArtBaseUrl } from "@/services/api";
import { getAllPlaylists, searchPlaylists } from "@/services/db";
import { Playlist } from "@/types";

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
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
  getAllPlaylists: jest.fn(),
  searchPlaylists: jest.fn(),
}));

const mockPlaylists: Playlist[] = [
  {
    id: "pl-1",
    name: "rock hits",
    comment: "classic rock favorites",
    owner: "alice",
    public: true,
    songCount: 25,
    duration: 5400,
    created: "2023-01-01T00:00:00Z",
    changed: "2023-03-01T00:00:00Z",
    coverArt: "cover-1",
  },
  {
    id: "pl-2",
    name: "ambient relax",
    comment: "chill ambient sounds",
    owner: "bob",
    public: false,
    songCount: 10,
    duration: 2100,
    created: "2023-02-01T00:00:00Z",
    changed: "2023-04-01T00:00:00Z",
    coverArt: "cover-2",
  },
];

describe("PlaylistsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
    (getAllPlaylists as jest.Mock).mockReturnValue(mockPlaylists);
    (searchPlaylists as jest.Mock).mockReturnValue([]);
  });

  it("renders all playlists initially sorted by title asc", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<PlaylistsScreen />);
    });

    const { List } = require("react-native-paper");
    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBe(2);
    // "ambient relax" before "rock hits"
    expect(listItems[0].props.title).toBe("ambient relax");
    expect(listItems[1].props.title).toBe("rock hits");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("navigates to playlist detail when playlist is pressed", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<PlaylistsScreen />);
    });

    const { List } = require("react-native-paper");
    const listItems = component.root.findAllByType(List.Item);
    const rockHitsItem = listItems.find(
      (item: any) => item.props.title === "rock hits",
    );

    renderer.act(() => {
      rockHitsItem.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(main)/library/playlist/[id]",
      params: { id: mockPlaylists[0].id },
    });

    renderer.act(() => {
      component.unmount();
    });
  });

  it("uses searchPlaylists when search query is entered", async () => {
    (searchPlaylists as jest.Mock).mockReturnValue([mockPlaylists[0]]);

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<PlaylistsScreen />);
    });

    const { Searchbar, List } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("rock");
    });

    expect(searchPlaylists).toHaveBeenCalledWith("rock", 1000);

    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBe(1);
    expect(listItems[0].props.title).toBe("rock hits");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("sorts playlists by song count and toggles order", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<PlaylistsScreen />);
    });

    const { Menu, IconButton, List } = require("react-native-paper");
    const menuItems = component.root.findAllByType(Menu.Item);
    const songCountOption = menuItems.find(
      (item: any) => item.props.title === "song count",
    );

    renderer.act(() => {
      songCountOption.props.onPress();
    });

    let listItems = component.root.findAllByType(List.Item);
    // 10 ("ambient relax") before 25 ("rock hits") in asc
    expect(listItems[0].props.title).toBe("ambient relax");
    expect(listItems[1].props.title).toBe("rock hits");

    // Toggle to desc
    const iconButtons = component.root.findAllByType(IconButton);
    const orderButton = iconButtons.find(
      (btn: any) =>
        btn.props.icon === "sort-ascending" ||
        btn.props.icon === "sort-descending",
    );

    renderer.act(() => {
      orderButton.props.onPress();
    });

    listItems = component.root.findAllByType(List.Item);
    // 25 ("rock hits") before 10 ("ambient relax") in desc
    expect(listItems[0].props.title).toBe("rock hits");
    expect(listItems[1].props.title).toBe("ambient relax");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders empty state when no playlists are found", async () => {
    (getAllPlaylists as jest.Mock).mockReturnValue([]);

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<PlaylistsScreen />);
    });

    const { Text } = require("react-native-paper");
    const texts = component.root.findAllByType(Text);
    const emptyText = texts.find(
      (t: any) => t.props.children === "no playlists found",
    );
    expect(emptyText).toBeDefined();

    renderer.act(() => {
      component.unmount();
    });
  });
});
