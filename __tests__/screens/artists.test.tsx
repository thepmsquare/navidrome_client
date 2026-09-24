import React from "react";
import renderer from "react-test-renderer";

import ArtistsScreen from "@/app/(main)/library/artists";
import { getCoverArtBaseUrl } from "@/services/api";
import { getAllArtists, searchArtists } from "@/services/db";
import { ArtistID3 } from "@/types";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
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
  getAllArtists: jest.fn(),
  searchArtists: jest.fn(),
}));

const mockArtists: ArtistID3[] = [
  {
    id: "artist-1",
    name: "pink floyd",
    albumCount: 15,
    starred: "2023-01-01T00:00:00Z",
    userRating: 5,
    sortName: "pink floyd",
    coverArt: "art-1",
  },
  {
    id: "artist-2",
    name: "the beatles",
    albumCount: 22,
    starred: null,
    userRating: 4,
    sortName: "beatles, the",
    coverArt: "art-2",
  },
];

describe("ArtistsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
    (getAllArtists as jest.Mock).mockReturnValue(mockArtists);
    (searchArtists as jest.Mock).mockReturnValue([]);
  });

  it("renders all artists initially sorted by name asc", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<ArtistsScreen />);
    });

    const { List } = require("react-native-paper");
    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBe(2);
    // "pink floyd" before "the beatles" in asc
    expect(listItems[0].props.title).toBe("pink floyd");
    expect(listItems[1].props.title).toBe("the beatles");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("uses searchArtists when search query is entered", async () => {
    (searchArtists as jest.Mock).mockReturnValue([mockArtists[1]]);

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<ArtistsScreen />);
    });

    const { Searchbar, List } = require("react-native-paper");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("beatles");
    });

    expect(searchArtists).toHaveBeenCalledWith("beatles", 1000);

    const listItems = component.root.findAllByType(List.Item);
    expect(listItems.length).toBe(1);
    expect(listItems[0].props.title).toBe("the beatles");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("sorts artists by album count and toggles order", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<ArtistsScreen />);
    });

    const { Menu, IconButton, List } = require("react-native-paper");
    const menuItems = component.root.findAllByType(Menu.Item);
    const albumCountOption = menuItems.find(
      (item: any) => item.props.title === "album count",
    );

    renderer.act(() => {
      albumCountOption.props.onPress();
    });

    let listItems = component.root.findAllByType(List.Item);
    // 15 ("pink floyd") before 22 ("the beatles") in asc
    expect(listItems[0].props.title).toBe("pink floyd");
    expect(listItems[1].props.title).toBe("the beatles");

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
    // 22 ("the beatles") before 15 ("pink floyd") in desc
    expect(listItems[0].props.title).toBe("the beatles");
    expect(listItems[1].props.title).toBe("pink floyd");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders empty state when no artists are found", async () => {
    (getAllArtists as jest.Mock).mockReturnValue([]);

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<ArtistsScreen />);
    });

    const { Text } = require("react-native-paper");
    const texts = component.root.findAllByType(Text);
    const emptyText = texts.find(
      (t: any) => t.props.children === "no artists found",
    );
    expect(emptyText).toBeDefined();

    renderer.act(() => {
      component.unmount();
    });
  });
});
