import React from "react";
import renderer from "react-test-renderer";
import { Button } from "react-native-paper";

import { DetailActionsRow } from "@/components/DetailActionsRow";
import { playPlaylist } from "@/services/player";
import { Child } from "@/types";

jest.mock("@/services/player", () => ({
  playPlaylist: jest.fn(),
}));

jest.mock("@/components/BulkSongCacheButton", () => ({
  BulkSongCacheButton: "BulkSongCacheButton",
}));

const mockSongs: Child[] = [
  {
    id: "song-1",
    title: "track 1",
    artist: "test artist",
    album: "test album",
    coverArt: "cover-1",
    duration: 180,
    size: 5000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
  {
    id: "song-2",
    title: "track 2",
    artist: "test artist",
    album: "test album",
    coverArt: "cover-1",
    duration: 200,
    size: 6000000,
    contentType: "audio/mp3",
    suffix: "mp3",
  },
];

describe("DetailActionsRow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders play all, shuffle play, and compact BulkSongCacheButton", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <DetailActionsRow
          songs={mockSongs}
          sourceKey="album:album-1"
          cacheEntries={new Map()}
        />,
      );
    });

    const buttons = component.root.findAllByType(Button);
    expect(buttons).toHaveLength(2);

    const playBtn = buttons.find((b: any) => b.props.accessibilityLabel === "play all");
    const shuffleBtn = buttons.find((b: any) => b.props.accessibilityLabel === "shuffle play");
    const cacheBtn = component.root.findByType("BulkSongCacheButton");

    expect(playBtn).toBeDefined();
    expect(playBtn.props.disabled).toBe(false);
    expect(shuffleBtn).toBeDefined();
    expect(shuffleBtn.props.disabled).toBe(false);

    expect(cacheBtn).toBeDefined();
    expect(cacheBtn.props.compact).toBe(true);
    expect(cacheBtn.props.sourceKey).toBe("album:album-1");
    expect(cacheBtn.props.songIds).toEqual(["song-1", "song-2"]);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("calls playPlaylist with songs starting at 0 on play all", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <DetailActionsRow
          songs={mockSongs}
          sourceKey="playlist:pl-1"
          cacheEntries={new Map()}
        />,
      );
    });

    const buttons = component.root.findAllByType(Button);
    const playBtn = buttons.find((b: any) => b.props.accessibilityLabel === "play all");

    renderer.act(() => {
      playBtn.props.onPress();
    });

    expect(playPlaylist).toHaveBeenCalledWith(mockSongs, 0);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("shuffles and calls playPlaylist on shuffle play", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <DetailActionsRow
          songs={mockSongs}
          sourceKey="artist:ar-1"
          cacheEntries={new Map()}
        />,
      );
    });

    const buttons = component.root.findAllByType(Button);
    const shuffleBtn = buttons.find((b: any) => b.props.accessibilityLabel === "shuffle play");

    renderer.act(() => {
      shuffleBtn.props.onPress();
    });

    expect(playPlaylist).toHaveBeenCalledTimes(1);
    const calledSongs = (playPlaylist as jest.Mock).mock.calls[0][0];
    expect(calledSongs).toHaveLength(2);
    expect((playPlaylist as jest.Mock).mock.calls[0][1]).toBe(0);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("disables play all and shuffle play when songs array is empty", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <DetailActionsRow
          songs={[]}
          sourceKey="album:empty"
          cacheEntries={new Map()}
        />,
      );
    });

    const buttons = component.root.findAllByType(Button);
    const playBtn = buttons.find((b: any) => b.props.accessibilityLabel === "play all");
    const shuffleBtn = buttons.find((b: any) => b.props.accessibilityLabel === "shuffle play");

    expect(playBtn.props.disabled).toBe(true);
    expect(shuffleBtn.props.disabled).toBe(true);

    renderer.act(() => {
      playBtn.props.onPress();
      shuffleBtn.props.onPress();
    });

    expect(playPlaylist).not.toHaveBeenCalled();

    renderer.act(() => {
      component.unmount();
    });
  });
});

