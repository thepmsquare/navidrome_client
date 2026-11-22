import React from "react";
import renderer from "react-test-renderer";

import { ArtistContextMenuModal } from "@/components/ArtistContextMenuModal";
import { star, unstar } from "@/services/api";
import { getSongsByArtistId, updateArtistStarred } from "@/services/db";
import { addToQueue, playPlaylist } from "@/services/player";
import { showSnackbar } from "@/services/snackbar";
import { ArtistID3 } from "@/types";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("react-native-paper", () => {
  const actual = jest.requireActual("react-native-paper");
  return {
    ...actual,
    Portal: ({ children }: any) => children,
    Modal: ({ visible, children }: any) => (visible ? children : null),
  };
});

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/services/api", () => ({
  star: jest.fn().mockResolvedValue(true),
  unstar: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/services/db", () => ({
  getSongsByArtistId: jest.fn(),
  updateArtistStarred: jest.fn(),
}));

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn().mockResolvedValue(undefined),
  addToQueue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/snackbar", () => ({
  showSnackbar: jest.fn(),
}));

jest.mock("@/utils/haptics", () => ({
  triggerHapticSelection: jest.fn(),
}));

const mockArtist: ArtistID3 = {
  id: "artist-1",
  name: "pink floyd",
  coverArt: "art-1",
  albumCount: 15,
};

const mockSongs = [
  { id: "s1", title: "time", artist: "pink floyd", album: "dark side" },
  { id: "s2", title: "money", artist: "pink floyd", album: "dark side" },
];

describe("ArtistContextMenuModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSongsByArtistId as jest.Mock).mockReturnValue(mockSongs);
  });

  it("plays artist songs when play action is pressed", async () => {
    const handleDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ArtistContextMenuModal
          visible={true}
          onDismiss={handleDismiss}
          artist={mockArtist}
        />,
      );
    });

    const playBtn = component.root.findByProps({
      accessibilityLabel: "play artist",
    });
    await renderer.act(async () => {
      await playBtn.props.onPress();
    });

    expect(handleDismiss).toHaveBeenCalled();
    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);
  });

  it("adds songs to queue when add to queue action is pressed", async () => {
    const handleDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ArtistContextMenuModal
          visible={true}
          onDismiss={handleDismiss}
          artist={mockArtist}
        />,
      );
    });

    const addBtn = component.root.findByProps({
      accessibilityLabel: "add to queue",
    });
    await renderer.act(async () => {
      await addBtn.props.onPress();
    });

    expect(handleDismiss).toHaveBeenCalled();
    expect(addToQueue).toHaveBeenCalledWith(mockSongs);
    expect(showSnackbar).toHaveBeenCalledWith("added 2 songs to queue");
  });

  it("toggles starred state correctly", async () => {
    const handleDismiss = jest.fn();
    const handleStarredChange = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ArtistContextMenuModal
          visible={true}
          onDismiss={handleDismiss}
          artist={mockArtist}
          onStarredChange={handleStarredChange}
        />,
      );
    });

    const starBtn = component.root.findByProps({
      accessibilityLabel: "add to favorites",
    });
    await renderer.act(async () => {
      await starBtn.props.onPress();
    });

    expect(star).toHaveBeenCalledWith({ artistId: "artist-1" });
    expect(updateArtistStarred).toHaveBeenCalledWith("artist-1", expect.any(String));
    expect(handleStarredChange).toHaveBeenCalledWith(true);
  });

  it("navigates to artist details on go to artist action", () => {
    const handleDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ArtistContextMenuModal
          visible={true}
          onDismiss={handleDismiss}
          artist={mockArtist}
        />,
      );
    });

    const navBtn = component.root.findByProps({
      accessibilityLabel: "go to artist",
    });
    renderer.act(() => {
      navBtn.props.onPress();
    });

    expect(handleDismiss).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/artist/[id]",
      params: { id: "artist-1" },
    });
  });
});
