import React from "react";
import { Alert } from "react-native";
import { Button } from "react-native-paper";
import renderer from "react-test-renderer";

import { BulkSongCacheButton } from "@/components/BulkSongCacheButton";

let queueCallback: ((state: any) => void) | null = null;
let mockQueueState: { pending: string[]; active: string | null } = {
  pending: [],
  active: null,
};

jest.mock("@/services/songCache", () => ({
  cancelSongCaching: jest.fn(),
  deleteSongFromCache: jest.fn(),
  dequeuePendingSong: jest.fn(),
  enqueueSongsForManualCache: jest.fn(),
  getDownloadQueueState: jest.fn(() => mockQueueState),
  subscribeCacheQueue: jest.fn((fn) => {
    queueCallback = fn;
    return () => {
      queueCallback = null;
    };
  }),
}));

import {
  cancelSongCaching,
  deleteSongFromCache,
  dequeuePendingSong,
  enqueueSongsForManualCache,
  getDownloadQueueState,
  subscribeCacheQueue,
} from "@/services/songCache";
import { SongCacheRow, SongCacheType } from "@/types";

describe("BulkSongCacheButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queueCallback = null;
    mockQueueState = { pending: [], active: null };
    (getDownloadQueueState as jest.Mock).mockImplementation(() => mockQueueState);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("returns null when songIds is empty", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton songIds={[]} cacheEntries={new Map()} />,
      );
    });

    expect(component.toJSON()).toBeNull();
    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders 'make available offline' when all songs are uncached and idle", () => {
    const songIds = ["song-1", "song-2", "song-3"];
    const cacheEntries = new Map<string, SongCacheRow>();

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton songIds={songIds} cacheEntries={cacheEntries} />,
      );
    });

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain("make available offline");
    expect(json).not.toContain("make available offline (");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders 'make available offline (X/Y)' when partially cached and idle", () => {
    const songIds = ["song-1", "song-2", "song-3"];
    const cacheEntries = new Map<string, SongCacheRow>();
    cacheEntries.set("song-1", {
      songId: "song-1",
      cacheType: SongCacheType.Manual,
      filePath: "/path/1",
      fileSizeBytes: 100,
      addedAt: "2026-01-01",
      lastAccessedAt: null,
    });

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton songIds={songIds} cacheEntries={cacheEntries} />,
      );
    });

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain("make available offline (2/3)");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders 'available offline' when fully manually cached", () => {
    const songIds = ["song-1", "song-2"];
    const cacheEntries = new Map<string, SongCacheRow>();
    cacheEntries.set("song-1", {
      songId: "song-1",
      cacheType: SongCacheType.Manual,
      filePath: "/path/1",
      fileSizeBytes: 100,
      addedAt: "2026-01-01",
      lastAccessedAt: null,
    });
    cacheEntries.set("song-2", {
      songId: "song-2",
      cacheType: SongCacheType.Manual,
      filePath: "/path/2",
      fileSizeBytes: 200,
      addedAt: "2026-01-01",
      lastAccessedAt: null,
    });

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton songIds={songIds} cacheEntries={cacheEntries} />,
      );
    });

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain("available offline");
    expect(json).not.toContain("make available offline");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("prompts confirmation to remove offline songs when fully manual", async () => {
    const songIds = ["song-1", "song-2"];
    const cacheEntries = new Map<string, SongCacheRow>();
    cacheEntries.set("song-1", {
      songId: "song-1",
      cacheType: SongCacheType.Manual,
      filePath: "/path/1",
      fileSizeBytes: 100,
      addedAt: "2026-01-01",
      lastAccessedAt: null,
    });
    cacheEntries.set("song-2", {
      songId: "song-2",
      cacheType: SongCacheType.Manual,
      filePath: "/path/2",
      fileSizeBytes: 200,
      addedAt: "2026-01-01",
      lastAccessedAt: null,
    });

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton songIds={songIds} cacheEntries={cacheEntries} />,
      );
    });

    // Press button
    const button = component.root.findByType(Button);
    renderer.act(() => {
      button.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "remove offline songs",
      "are you sure you want to remove these 2 songs from offline cache?",
      expect.any(Array),
    );

    // Confirm remove
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const confirmButton = alertCalls[0][2].find(
      (b: any) => b.text === "yes",
    );
    await renderer.act(async () => {
      await confirmButton.onPress();
    });

    expect(deleteSongFromCache).toHaveBeenCalledWith("song-1");
    expect(deleteSongFromCache).toHaveBeenCalledWith("song-2");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("calls enqueueSongsForManualCache when tapped while idle", async () => {
    const songIds = ["song-1", "song-2", "song-3"];
    const cacheEntries = new Map<string, SongCacheRow>();

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton songIds={songIds} cacheEntries={cacheEntries} />,
      );
    });

    const button = component.root.findByType(Button);
    renderer.act(() => {
      button.props.onPress();
    });

    expect(enqueueSongsForManualCache).toHaveBeenCalledWith(songIds);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("displays downloading state and prompts stop confirmation when active", async () => {
    const songIds = ["song-1", "song-2", "song-3"];
    const cacheEntries = new Map<string, SongCacheRow>();
    mockQueueState = {
      active: "song-1",
      pending: ["song-2", "song-3"],
    };

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton songIds={songIds} cacheEntries={cacheEntries} />,
      );
    });

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain("downloading... (0/3)");

    const button = component.root.findByType(Button);
    renderer.act(() => {
      button.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "stop downloading offline songs",
      "already downloaded songs will stay available offline. are you sure you want to stop?",
      expect.any(Array),
    );

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const confirmStop = alertCalls[0][2].find((b: any) => b.text === "yes");
    renderer.act(() => {
      confirmStop.onPress();
    });

    expect(cancelSongCaching).toHaveBeenCalledWith("song-1");
    expect(dequeuePendingSong).toHaveBeenCalledWith("song-2");
    expect(dequeuePendingSong).toHaveBeenCalledWith("song-3");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("displays 'queued' when songs are pending and none active for this button", () => {
    const songIds = ["song-1", "song-2"];
    const cacheEntries = new Map<string, SongCacheRow>();
    mockQueueState = {
      active: "other-song",
      pending: ["song-1", "song-2"],
    };

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton songIds={songIds} cacheEntries={cacheEntries} />,
      );
    });

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain("queued");

    renderer.act(() => {
      component.unmount();
    });
  });
});
