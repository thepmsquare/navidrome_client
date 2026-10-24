import React from "react";
import renderer from "react-test-renderer";

import { SongContextMenuModal } from "@/components/SongContextMenuModal";
import { SongRow } from "@/components/SongRow";
import { Child } from "@/types";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
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

jest.mock("@/components/SongCacheButton", () => ({
  SongCacheButton: "SongCacheButton",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(async () => (id?: string | null) => (id ? `https://art/${id}` : null)),
  star: jest.fn().mockResolvedValue(true),
  unstar: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/services/db", () => ({
  getSongById: jest.fn((id: string) => ({
    id,
    artistId: "artist-1",
    albumId: "album-1",
  })),
  getArtistByName: jest.fn((name: string) => ({ id: "artist-1", name })),
  getAlbumByName: jest.fn((name: string) => ({ id: "album-1", name })),
  updateSongStarred: jest.fn(),
  getHapticsEnabled: jest.fn().mockReturnValue(false),
}));

jest.mock("@/services/player", () => ({
  playSong: jest.fn().mockResolvedValue(undefined),
  playNext: jest.fn().mockResolvedValue(undefined),
  addToQueue: jest.fn().mockResolvedValue(undefined),
  updateTrackStarredState: jest.fn(),
  usePlayerState: jest.fn().mockReturnValue({
    currentTrack: null,
    isPlaying: false,
  }),
}));

jest.mock("@/services/songCache", () => ({
  cacheSongManually: jest.fn(),
  deleteSongFromCache: jest.fn(),
  isSongCaching: jest.fn().mockReturnValue(false),
  subscribeSongCache: jest.fn().mockReturnValue(jest.fn()),
}));

const mockSong: Child = {
  id: "song-1",
  title: "comfortably numb",
  artist: "pink floyd",
  album: "the wall",
  artistId: "artist-1",
  albumId: "album-1",
  coverArt: "art-1",
  track: 6,
  duration: 382,
};

const mockGetArtUrl = (art?: string | null) =>
  art ? `https://art/${art}` : null;

describe("SongRow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders song title, artist, and standard a11y labels in lowercase", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongRow song={mockSong} getArtUrl={mockGetArtUrl} />,
      );
    });

    const root = component.root;
    const touchable = root.findByProps({ accessibilityRole: "button" });
    expect(touchable).toBeDefined();
    expect(touchable.props.accessibilityLabel).toBe(
      "play comfortably numb, by pink floyd",
    );
    expect(touchable.props.accessibilityHint).toBe(
      "tap to play, long-press for options",
    );

    // Checks that title text is rendered
    const texts = root.findAllByType("Text");
    const foundTitle = texts.some((t: any) =>
      t.props.children?.toString().includes("comfortably numb"),
    );
    expect(foundTitle).toBe(true);
  });

  it("triggers custom onPress when row is pressed", () => {
    const handlePress = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongRow
          song={mockSong}
          onPress={handlePress}
          getArtUrl={mockGetArtUrl}
        />,
      );
    });

    const touchable = component.root.findByProps({
      testID: "song-row-song-1",
    });
    renderer.act(() => {
      touchable.props.onPress();
    });

    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it("defaults to playSong when row is pressed without custom onPress", () => {
    const { playSong } = require("@/services/player");
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongRow song={mockSong} getArtUrl={mockGetArtUrl} />,
      );
    });

    const touchable = component.root.findByProps({
      testID: "song-row-song-1",
    });
    renderer.act(() => {
      touchable.props.onPress();
    });

    expect(playSong).toHaveBeenCalledWith(mockSong);
  });

  it("displays track number instead of artwork when showTrackNumber is true", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongRow
          song={mockSong}
          showTrackNumber
          trackNumber={6}
          getArtUrl={mockGetArtUrl}
        />,
      );
    });

    const texts = component.root.findAllByType("Text");
    const trackText = texts.find((t: any) => t.props.children === "6");
    expect(trackText).toBeDefined();
  });

  it("opens context menu modal on more button press", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongRow song={mockSong} getArtUrl={mockGetArtUrl} />,
      );
    });

    const moreButton = component.root.findByProps({
      accessibilityLabel: "song options",
    });
    expect(moreButton).toBeDefined();

    renderer.act(() => {
      moreButton.props.onPress();
    });

    const modal = component.root.findByType(SongContextMenuModal);
    expect(modal).toBeDefined();
    expect(modal.props.visible).toBe(true);
  });

  it("opens context menu modal on row long-press", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongRow song={mockSong} getArtUrl={mockGetArtUrl} />,
      );
    });

    const touchable = component.root.findByProps({
      testID: "song-row-song-1",
    });
    renderer.act(() => {
      touchable.props.onLongPress();
    });

    const modal = component.root.findByType(SongContextMenuModal);
    expect(modal).toBeDefined();
    expect(modal.props.visible).toBe(true);
  });
});

describe("SongContextMenuModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders menu options in lowercase", () => {
    const onDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongContextMenuModal
          visible={true}
          onDismiss={onDismiss}
          song={mockSong}
        />,
      );
    });

    const root = component.root;
    const playNextBtn = root.findByProps({ accessibilityLabel: "play next" });
    const addToQueueBtn = root.findByProps({
      accessibilityLabel: "add to queue",
    });
    const goToArtistBtn = root.findByProps({
      accessibilityLabel: "go to artist",
    });
    const goToAlbumBtn = root.findByProps({ accessibilityLabel: "go to album" });

    expect(playNextBtn).toBeDefined();
    expect(addToQueueBtn).toBeDefined();
    expect(goToArtistBtn).toBeDefined();
    expect(goToAlbumBtn).toBeDefined();
  });

  it("triggers playNext and closes modal when play next is clicked", () => {
    const { playNext } = require("@/services/player");
    const onDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongContextMenuModal
          visible={true}
          onDismiss={onDismiss}
          song={mockSong}
        />,
      );
    });

    const playNextBtn = component.root.findByProps({
      accessibilityLabel: "play next",
    });
    renderer.act(() => {
      playNextBtn.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(playNext).toHaveBeenCalledWith(mockSong);
  });

  it("triggers addToQueue and closes modal when add to queue is clicked", () => {
    const { addToQueue } = require("@/services/player");
    const onDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongContextMenuModal
          visible={true}
          onDismiss={onDismiss}
          song={mockSong}
        />,
      );
    });

    const addToQueueBtn = component.root.findByProps({
      accessibilityLabel: "add to queue",
    });
    renderer.act(() => {
      addToQueueBtn.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(addToQueueBtn).toBeDefined();
    expect(addToQueue).toHaveBeenCalledWith(mockSong);
  });

  it("navigates to artist when go to artist is clicked", () => {
    const onDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongContextMenuModal
          visible={true}
          onDismiss={onDismiss}
          song={mockSong}
        />,
      );
    });

    const goToArtistBtn = component.root.findByProps({
      accessibilityLabel: "go to artist",
    });
    renderer.act(() => {
      goToArtistBtn.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/artist/[id]",
      params: { id: "artist-1" },
    });
  });

  it("navigates to album when go to album is clicked", () => {
    const onDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongContextMenuModal
          visible={true}
          onDismiss={onDismiss}
          song={mockSong}
        />,
      );
    });

    const goToAlbumBtn = component.root.findByProps({
      accessibilityLabel: "go to album",
    });
    renderer.act(() => {
      goToAlbumBtn.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/album/[id]",
      params: { id: "album-1" },
    });
  });

  it("renders heart icon for favorite and toggles star state", () => {
    const onDismiss = jest.fn();
    const onStarredChange = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongContextMenuModal
          visible={true}
          onDismiss={onDismiss}
          song={mockSong}
          onStarredChange={onStarredChange}
        />,
      );
    });

    // Unstarred track should show heart-outline
    const favBtn = component.root.findByProps({
      accessibilityLabel: "favorite",
    });
    expect(favBtn).toBeDefined();

    const heartIcon = favBtn.findByProps({ icon: "heart-outline" });
    expect(heartIcon).toBeDefined();

    renderer.act(() => {
      favBtn.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onStarredChange).toHaveBeenCalledWith(true);
  });

  it("renders SongCacheButton with menu-item variant in SongContextMenuModal", () => {
    const { SongCacheButton } = require("@/components/SongCacheButton");
    const onDismiss = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongContextMenuModal
          visible={true}
          onDismiss={onDismiss}
          song={mockSong}
        />,
      );
    });

    const cacheBtn = component.root.findByType(SongCacheButton);
    expect(cacheBtn).toBeDefined();
    expect(cacheBtn.props.songId).toBe(mockSong.id);
    expect(cacheBtn.props.variant).toBe("menu-item");

    renderer.act(() => {
      cacheBtn.props.onAction();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
