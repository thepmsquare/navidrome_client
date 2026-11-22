import React from "react";
import renderer from "react-test-renderer";

import ArtistsScreen from "@/app/(main)/library/artists";
import { client_app_sync, getCoverArtBaseUrl } from "@/services/api";
import { getAllArtists, searchArtists } from "@/services/db";
import { ArtistID3 } from "@/types";

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
  const MockMenu = ({ visible, children, anchor }: any) => {
    return React.createElement(View, null, anchor, visible ? children : children);
  };
  MockMenu.Item = ({ title, onPress }: any) => {
    return React.createElement(View, { testID: `menu-item-${title}`, onPress, title }, null);
  };
  return {
    ...actual,
    Portal: ({ children }: any) => children,
    Modal: ({ visible, children }: any) => (visible ? children : null),
    Menu: MockMenu,
  };
});

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/services/api", () => ({
  client_app_sync: jest.fn().mockResolvedValue({}),
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
  {
    id: "artist-3",
    name: "empty artist",
    albumCount: 0,
    starred: null,
    userRating: null,
    sortName: "empty artist",
    coverArt: null,
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

  it("renders all artists initially sorted by name asc, hiding artists with 0 albums by default", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<ArtistsScreen />);
    });

    const { ArtistRow } = require("@/components/ArtistRow");
    const artistRows = component.root.findAllByType(ArtistRow);
    // Only pink floyd and the beatles should be rendered; empty artist is hidden by default
    expect(artistRows.length).toBe(2);
    expect(artistRows[0].props.artist.name).toBe("pink floyd");
    expect(artistRows[1].props.artist.name).toBe("the beatles");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("opens filter modal from searchbar and toggles 0-album artists visibility", async () => {
    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<ArtistsScreen />);
    });

    const { ArtistsFilterModal } = require("@/components/ArtistsFilterModal");
    const { ArtistRow } = require("@/components/ArtistRow");
    const { IconButton } = require("react-native-paper");

    let filterModal = component.root.findByType(ArtistsFilterModal);
    expect(filterModal.props.visible).toBe(false);
    expect(filterModal.props.hideEmptyArtists).toBe(true);

    // Find and press the filter icon in the searchbar
    const iconButtons = component.root.findAllByType(IconButton);
    const filterBtn = iconButtons.find(
      (btn: any) => btn.props.accessibilityLabel === "filter artists",
    );
    expect(filterBtn).toBeDefined();

    renderer.act(() => {
      filterBtn.props.onPress();
    });

    filterModal = component.root.findByType(ArtistsFilterModal);
    expect(filterModal.props.visible).toBe(true);

    // Toggle filter to show artists with 0 albums
    renderer.act(() => {
      filterModal.props.onToggleHideEmptyArtists(false);
    });

    let artistRows = component.root.findAllByType(ArtistRow);
    expect(artistRows.length).toBe(3);
    const titles = artistRows.map((item: any) => item.props.artist.name);
    expect(titles).toContain("empty artist");

    // Toggle filter back to hide 0-album artists
    renderer.act(() => {
      filterModal.props.onToggleHideEmptyArtists(true);
    });

    artistRows = component.root.findAllByType(ArtistRow);
    expect(artistRows.length).toBe(2);
    expect(artistRows.map((item: any) => item.props.artist.name)).not.toContain("empty artist");

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

    const { Searchbar } = require("react-native-paper");
    const { ArtistRow } = require("@/components/ArtistRow");
    const searchbar = component.root.findByType(Searchbar);

    renderer.act(() => {
      searchbar.props.onChangeText("beatles");
    });

    expect(searchArtists).toHaveBeenCalledWith("beatles", 1000);

    const artistRows = component.root.findAllByType(ArtistRow);
    expect(artistRows.length).toBe(1);
    expect(artistRows[0].props.artist.name).toBe("the beatles");

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

    const { ArtistRow } = require("@/components/ArtistRow");
    let artistRows = component.root.findAllByType(ArtistRow);
    // 15 ("pink floyd") before 22 ("the beatles") in asc
    expect(artistRows[0].props.artist.name).toBe("pink floyd");
    expect(artistRows[1].props.artist.name).toBe("the beatles");

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

    artistRows = component.root.findAllByType(ArtistRow);
    // 22 ("the beatles") before 15 ("pink floyd") in desc
    expect(artistRows[0].props.artist.name).toBe("the beatles");
    expect(artistRows[1].props.artist.name).toBe("pink floyd");

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

  it("triggers refresh when pulled down", async () => {
    (getAllArtists as jest.Mock).mockReturnValue(mockArtists);

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<ArtistsScreen />);
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
});
