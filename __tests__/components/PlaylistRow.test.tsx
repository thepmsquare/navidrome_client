import React from "react";
import renderer from "react-test-renderer";

import { PlaylistContextMenuModal } from "@/components/PlaylistContextMenuModal";
import { PlaylistRow } from "@/components/PlaylistRow";
import { Playlist } from "@/types";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(async () => (id?: string | null) => (id ? `https://art/${id}` : null)),
}));

jest.mock("@/utils/haptics", () => ({
  triggerHapticSelection: jest.fn(),
}));

jest.mock("@/components/PlaylistContextMenuModal", () => ({
  PlaylistContextMenuModal: "PlaylistContextMenuModal",
}));

const mockPlaylist: Playlist = {
  id: "pl-1",
  name: "classic rock",
  coverArt: "pl-art-1",
  songCount: 25,
};

const mockGetArtUrl = (art?: string | null) =>
  art ? `https://art/${art}` : null;

describe("PlaylistRow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders playlist name and track count correctly", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlaylistRow playlist={mockPlaylist} getArtUrl={mockGetArtUrl} />,
      );
    });

    const tree = component.toJSON();
    expect(JSON.stringify(tree)).toContain("classic rock");
    expect(JSON.stringify(tree)).toContain("25 tracks");
  });

  it("formats singular track count correctly", () => {
    const singleTrackPlaylist: Playlist = {
      ...mockPlaylist,
      songCount: 1,
    };
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlaylistRow playlist={singleTrackPlaylist} getArtUrl={mockGetArtUrl} />,
      );
    });

    const tree = component.toJSON();
    expect(JSON.stringify(tree)).toContain("1 track");
  });

  it("navigates to playlist details on press by default", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlaylistRow playlist={mockPlaylist} getArtUrl={mockGetArtUrl} />,
      );
    });

    const root = component.root;
    const touchable = root.findByProps({ testID: "playlist-row-pl-1" });
    renderer.act(() => {
      touchable.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(main)/library/playlist/[id]",
      params: { id: "pl-1" },
    });
  });

  it("calls custom onPress when provided", () => {
    const handlePress = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlaylistRow
          playlist={mockPlaylist}
          onPress={handlePress}
          getArtUrl={mockGetArtUrl}
        />,
      );
    });

    const root = component.root;
    const touchable = root.findByProps({ testID: "playlist-row-pl-1" });
    renderer.act(() => {
      touchable.props.onPress();
    });

    expect(handlePress).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls custom onLongPress when provided", () => {
    const handleLongPress = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlaylistRow
          playlist={mockPlaylist}
          onLongPress={handleLongPress}
          getArtUrl={mockGetArtUrl}
        />,
      );
    });

    const root = component.root;
    const touchable = root.findByProps({ testID: "playlist-row-pl-1" });
    renderer.act(() => {
      touchable.props.onLongPress();
    });

    expect(handleLongPress).toHaveBeenCalled();
  });

  it("opens context menu modal on long press when no custom onLongPress provided", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlaylistRow playlist={mockPlaylist} getArtUrl={mockGetArtUrl} />,
      );
    });

    const root = component.root;
    const touchable = root.findByProps({ testID: "playlist-row-pl-1" });
    renderer.act(() => {
      touchable.props.onLongPress();
    });

    const modal = root.findByType("PlaylistContextMenuModal" as any);
    expect(modal.props.visible).toBe(true);
  });

  it("opens context menu modal when 3-dot options button is pressed", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlaylistRow playlist={mockPlaylist} getArtUrl={mockGetArtUrl} />,
      );
    });

    const root = component.root;
    const moreBtn = root.findByProps({ accessibilityLabel: "playlist options" });
    renderer.act(() => {
      moreBtn.props.onPress();
    });

    const modal = root.findByType("PlaylistContextMenuModal" as any);
    expect(modal.props.visible).toBe(true);
  });
});
