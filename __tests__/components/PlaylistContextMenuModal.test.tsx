import React from "react";
import renderer from "react-test-renderer";

import { PlaylistContextMenuModal } from "@/components/PlaylistContextMenuModal";
import { getPlaylist } from "@/services/api";
import { addToQueue, playPlaylist } from "@/services/player";
import { showSnackbar } from "@/services/snackbar";
import { Playlist } from "@/types";

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
  getPlaylist: jest.fn(),
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

const mockPlaylist: Playlist = {
  id: "pl-1",
  name: "classic rock",
  coverArt: "art-1",
  songCount: 10,
};

const mockSongs = [
  { id: "s1", title: "stairway to heaven", artist: "led zeppelin" },
  { id: "s2", title: "kashmir", artist: "led zeppelin" },
];

describe("PlaylistContextMenuModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPlaylist as jest.Mock).mockResolvedValue({
      id: "pl-1",
      name: "classic rock",
      entry: mockSongs,
    });
  });

  it("plays playlist songs when play action is pressed", async () => {
    const handleDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlaylistContextMenuModal
          visible={true}
          onDismiss={handleDismiss}
          playlist={mockPlaylist}
        />,
      );
    });

    const playBtn = component.root.findByProps({
      accessibilityLabel: "play playlist",
    });
    await renderer.act(async () => {
      await playBtn.props.onPress();
    });

    expect(handleDismiss).toHaveBeenCalled();
    expect(getPlaylist).toHaveBeenCalledWith("pl-1");
    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);
  });

  it("adds playlist songs to queue when add to queue action is pressed", async () => {
    const handleDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlaylistContextMenuModal
          visible={true}
          onDismiss={handleDismiss}
          playlist={mockPlaylist}
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
    expect(showSnackbar).toHaveBeenCalledWith("added 2 tracks to queue");
  });

  it("navigates to playlist details on go to playlist action", () => {
    const handleDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlaylistContextMenuModal
          visible={true}
          onDismiss={handleDismiss}
          playlist={mockPlaylist}
        />,
      );
    });

    const navBtn = component.root.findByProps({
      accessibilityLabel: "go to playlist",
    });
    renderer.act(() => {
      navBtn.props.onPress();
    });

    expect(handleDismiss).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(main)/library/playlist/[id]",
      params: { id: "pl-1" },
    });
  });
});
