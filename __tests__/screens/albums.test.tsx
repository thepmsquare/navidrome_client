import React from "react";
import renderer from "react-test-renderer";

import AlbumsScreen from "@/app/(main)/library/albums";
import { getCoverArtBaseUrl } from "@/services/api";
import { getAllAlbums, searchAlbums } from "@/services/db";
import { AlbumID3 } from "@/types";

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
  getAllAlbums: jest.fn(),
  searchAlbums: jest.fn(),
}));

const mockAlbums: AlbumID3[] = [
  {
    id: "album-1",
    name: "the dark side of the moon",
    artist: "pink floyd",
    year: 1973,
    duration: 2580,
    songCount: 10,
    created: "2023-01-01T00:00:00Z",
    played: "2023-05-01T00:00:00Z",
    playCount: 15,
    userRating: 5,
    genre: "rock",
    starred: "2023-02-01T00:00:00Z",
  },
  {
    id: "album-2",
    name: "abbey road",
    artist: "the beatles",
    year: 1969,
    duration: 2823,
    songCount: 17,
    created: "2023-01-02T00:00:00Z",
    played: "2023-04-01T00:00:00Z",
    playCount: 25,
    userRating: 4,
    genre: "classic rock",
    starred: null,
  },
];

describe("AlbumsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
    (getAllAlbums as jest.Mock).mockReturnValue(mockAlbums);
    (searchAlbums as jest.Mock).mockReturnValue([]);
  });

  it("renders all albums initially", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<AlbumsScreen />);
    });

    const { List } = require("react-native-paper");
    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBe(2);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("navigates to album detail when album is pressed", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<AlbumsScreen />);
    });

    const { List } = require("react-native-paper");
    const listItems = component.root.findAllByType(List.Item);
    const darkSideItem = listItems.find(
      (item: any) => item.props.title === "the dark side of the moon",
    );

    renderer.act(() => {
      darkSideItem.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(main)/library/album/[id]",
      params: { id: mockAlbums[0].id },
    });

    renderer.act(() => {
      component.unmount();
    });
  });

  it("uses searchAlbums when search query is entered", async () => {
    (searchAlbums as jest.Mock).mockReturnValue([mockAlbums[1]]);

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<AlbumsScreen />);
    });

    const { Searchbar, List } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("beatles");
    });

    expect(searchAlbums).toHaveBeenCalledWith("beatles", 1000);

    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBe(1);
    expect(listItems[0].props.title).toBe("abbey road");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("sorts albums by year and toggles order", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<AlbumsScreen />);
    });

    const { Menu, IconButton, List } = require("react-native-paper");
    const menuItems = component.root.findAllByType(Menu.Item);
    const yearOption = menuItems.find(
      (item: any) => item.props.title === "year",
    );

    renderer.act(() => {
      yearOption.props.onPress();
    });

    let listItems = component.root.findAllByType(List.Item);
    // 1969 ("abbey road") before 1973 ("the dark side of the moon") in asc
    expect(listItems[0].props.title).toBe("abbey road");
    expect(listItems[1].props.title).toBe("the dark side of the moon");

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
    // 1973 before 1969 in desc
    expect(listItems[0].props.title).toBe("the dark side of the moon");
    expect(listItems[1].props.title).toBe("abbey road");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders empty state when no albums are returned", async () => {
    (getAllAlbums as jest.Mock).mockReturnValue([]);

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<AlbumsScreen />);
    });

    const { Text } = require("react-native-paper");
    const texts = component.root.findAllByType(Text);
    const emptyText = texts.find(
      (t: any) => t.props.children === "no albums found",
    );
    expect(emptyText).toBeDefined();

    renderer.act(() => {
      component.unmount();
    });
  });
});
