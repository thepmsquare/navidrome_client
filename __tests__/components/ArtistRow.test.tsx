import React from "react";
import renderer from "react-test-renderer";

import { ArtistContextMenuModal } from "@/components/ArtistContextMenuModal";
import { ArtistRow } from "@/components/ArtistRow";
import { ArtistID3 } from "@/types";

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

jest.mock("@/components/ArtistContextMenuModal", () => ({
  ArtistContextMenuModal: "ArtistContextMenuModal",
}));

const mockArtist: ArtistID3 = {
  id: "artist-1",
  name: "pink floyd",
  coverArt: "art-1",
  albumCount: 15,
};

const mockGetArtUrl = (art?: string | null) =>
  art ? `https://art/${art}` : null;

describe("ArtistRow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders artist name and album count correctly", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ArtistRow artist={mockArtist} getArtUrl={mockGetArtUrl} />,
      );
    });

    const tree = component.toJSON();
    expect(JSON.stringify(tree)).toContain("pink floyd");
    expect(JSON.stringify(tree)).toContain("15 albums");
  });

  it("formats singular album count correctly", () => {
    const singleAlbumArtist: ArtistID3 = {
      ...mockArtist,
      albumCount: 1,
    };
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ArtistRow artist={singleAlbumArtist} getArtUrl={mockGetArtUrl} />,
      );
    });

    const tree = component.toJSON();
    expect(JSON.stringify(tree)).toContain("1 album");
  });

  it("navigates to artist details on press by default", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ArtistRow artist={mockArtist} getArtUrl={mockGetArtUrl} />,
      );
    });

    const root = component.root;
    const touchable = root.findByProps({ testID: "artist-row-artist-1" });
    renderer.act(() => {
      touchable.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/artist/[id]",
      params: { id: "artist-1" },
    });
  });

  it("calls custom onPress when provided", () => {
    const handlePress = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ArtistRow
          artist={mockArtist}
          onPress={handlePress}
          getArtUrl={mockGetArtUrl}
        />,
      );
    });

    const root = component.root;
    const touchable = root.findByProps({ testID: "artist-row-artist-1" });
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
        <ArtistRow
          artist={mockArtist}
          onLongPress={handleLongPress}
          getArtUrl={mockGetArtUrl}
        />,
      );
    });

    const root = component.root;
    const touchable = root.findByProps({ testID: "artist-row-artist-1" });
    renderer.act(() => {
      touchable.props.onLongPress();
    });

    expect(handleLongPress).toHaveBeenCalled();
  });

  it("opens context menu modal on long press when no custom onLongPress provided", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ArtistRow artist={mockArtist} getArtUrl={mockGetArtUrl} />,
      );
    });

    const root = component.root;
    const touchable = root.findByProps({ testID: "artist-row-artist-1" });
    renderer.act(() => {
      touchable.props.onLongPress();
    });

    const modal = root.findByType("ArtistContextMenuModal" as any);
    expect(modal.props.visible).toBe(true);
  });

  it("opens context menu modal when 3-dot options button is pressed", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ArtistRow artist={mockArtist} getArtUrl={mockGetArtUrl} />,
      );
    });

    const root = component.root;
    const moreBtn = root.findByProps({ accessibilityLabel: "artist options" });
    renderer.act(() => {
      moreBtn.props.onPress();
    });

    const modal = root.findByType("ArtistContextMenuModal" as any);
    expect(modal.props.visible).toBe(true);
  });
});
