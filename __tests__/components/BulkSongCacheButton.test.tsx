import React from "react";
import { Alert } from "react-native";
import { Button } from "react-native-paper";
import renderer from "react-test-renderer";

import { BulkSongCacheButton } from "@/components/BulkSongCacheButton";
import {
  cacheSongManually,
  cancelSongCaching,
  deleteSongFromCache,
} from "@/services/songCache";
import { SongCacheRow, SongCacheType } from "@/types";

jest.mock("@/services/songCache", () => ({
  cacheSongManually: jest.fn(),
  cancelSongCaching: jest.fn(),
  deleteSongFromCache: jest.fn(),
}));

describe("BulkSongCacheButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it("renders 'make available offline' when all songs are uncached", () => {
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

  it("renders 'make available offline (X/Y)' when partially cached", () => {
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

  it("sequentially caches uncached and auto-cached songs on press", async () => {
    const songIds = ["song-1", "song-2", "song-3"];
    const cacheEntries = new Map<string, SongCacheRow>();
    // song-1 is already manual, song-2 is auto, song-3 is uncached
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
      cacheType: SongCacheType.Auto,
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

    const button = component.root.findByType(Button);
    await renderer.act(async () => {
      await button.props.onPress();
    });

    // song-1 was already manual so not called; song-2 and song-3 should be cached
    expect(cacheSongManually).not.toHaveBeenCalledWith("song-1");
    expect(cacheSongManually).toHaveBeenCalledWith("song-2");
    expect(cacheSongManually).toHaveBeenCalledWith("song-3");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("stops downloading when user confirms stop prompt while running", async () => {
    const songIds = ["song-1", "song-2", "song-3"];
    const cacheEntries = new Map<string, SongCacheRow>();

    let resolveSong1: () => void;
    (cacheSongManually as jest.Mock).mockImplementation((id: string) => {
      if (id === "song-1") {
        return new Promise<void>((resolve) => {
          resolveSong1 = resolve;
        });
      }
      return Promise.resolve();
    });

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton songIds={songIds} cacheEntries={cacheEntries} />,
      );
    });

    const button = component.root.findByType(Button);

    // Start download (song-1 will hang until resolveSong1)
    let runPromise: Promise<void>;
    renderer.act(() => {
      runPromise = button.props.onPress();
    });

    // Button should now be in downloading state
    const jsonWhileRunning = JSON.stringify(component.toJSON());
    expect(jsonWhileRunning).toContain("downloading... (0/3)");

    // Press while running -> triggers stop confirmation alert
    renderer.act(() => {
      button.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "stop downloading offline songs",
      "already downloaded songs will stay available offline. are you sure you want to stop?",
      expect.any(Array),
    );

    // Confirm stop
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const confirmStop = alertCalls[0][2].find((b: any) => b.text === "yes");
    renderer.act(() => {
      confirmStop.onPress();
    });

    expect(cancelSongCaching).toHaveBeenCalledWith("song-1");

    // Resolve song-1 so the loop can finish
    await renderer.act(async () => {
      resolveSong1();
      await runPromise;
    });

    // song-2 and song-3 should never be called because stop was requested
    expect(cacheSongManually).not.toHaveBeenCalledWith("song-2");
    expect(cacheSongManually).not.toHaveBeenCalledWith("song-3");

    renderer.act(() => {
      component.unmount();
    });
  });
});
