import React from "react";
import { Alert } from "react-native";
import { Button } from "react-native-paper";
import renderer from "react-test-renderer";

import { BulkSongCacheButton } from "@/components/BulkSongCacheButton";
import {
  cancelSongCaching,
  deleteSongFromCache,
  getDownloadQueueState,
  notifyCacheQueueUpdated,
  subscribeCacheQueue,
  tryStartNextDownload,
} from "@/services/songCache";
import {
  addQueueRequester,
  enqueuePendingDownload,
  getQueueRequesterCount,
  getRequestersForSource,
  removeFromDownloadQueue,
  removeQueueRequester,
} from "@/services/db";
import { DownloadQueueState, SongCacheRow, SongCacheType } from "@/types";

let queueCallback: ((state: DownloadQueueState) => void) | null = null;

jest.mock("@/services/songCache", () => ({
  cancelSongCaching: jest.fn(),
  deleteSongFromCache: jest.fn(),
  getDownloadQueueState: jest.fn(() => ({ pending: [], active: null })),
  notifyCacheQueueUpdated: jest.fn(),
  subscribeCacheQueue: jest.fn((fn) => {
    queueCallback = fn;
    return () => {
      queueCallback = null;
    };
  }),
  tryStartNextDownload: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  addQueueRequester: jest.fn(),
  enqueuePendingDownload: jest.fn(),
  getQueueRequesterCount: jest.fn(() => 0),
  getRequestersForSource: jest.fn(() => []),
  removeFromDownloadQueue: jest.fn(),
  removeQueueRequester: jest.fn(),
}));

describe("BulkSongCacheButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queueCallback = null;
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      pending: [],
      active: null,
    });
    (getQueueRequesterCount as jest.Mock).mockReturnValue(0);
    (getRequestersForSource as jest.Mock).mockReturnValue([]);
  });

  it("returns null when songIds is empty", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton
          sourceKey="album:123"
          songIds={[]}
          cacheEntries={new Map()}
        />,
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
        <BulkSongCacheButton
          sourceKey="album:123"
          songIds={songIds}
          cacheEntries={cacheEntries}
        />,
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
        <BulkSongCacheButton
          sourceKey="album:123"
          songIds={songIds}
          cacheEntries={cacheEntries}
        />,
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
        <BulkSongCacheButton
          sourceKey="album:123"
          songIds={songIds}
          cacheEntries={cacheEntries}
        />,
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
        <BulkSongCacheButton
          sourceKey="album:123"
          songIds={songIds}
          cacheEntries={cacheEntries}
        />,
      );
    });

    const button = component.root.findByType(Button);
    renderer.act(() => {
      button.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "remove offline songs",
      "are you sure you want to remove these 2 offline songs?",
      expect.any(Array),
    );

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

  it("enqueues uncached and auto-cached songs and calls tryStartNextDownload on press", async () => {
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
        <BulkSongCacheButton
          sourceKey="album:123"
          songIds={songIds}
          cacheEntries={cacheEntries}
        />,
      );
    });

    const button = component.root.findByType(Button);
    renderer.act(() => {
      button.props.onPress();
    });

    // song-1 was already manual so not enqueued
    expect(addQueueRequester).not.toHaveBeenCalledWith("song-1", "album:123");
    expect(enqueuePendingDownload).not.toHaveBeenCalledWith("song-1");

    // song-2 and song-3 should have requesters and queue items enqueued
    expect(addQueueRequester).toHaveBeenCalledWith("song-2", "album:123");
    expect(enqueuePendingDownload).toHaveBeenCalledWith("song-2");
    expect(addQueueRequester).toHaveBeenCalledWith("song-3", "album:123");
    expect(enqueuePendingDownload).toHaveBeenCalledWith("song-3");

    // notifyCacheQueueUpdated and tryStartNextDownload called once
    expect(notifyCacheQueueUpdated).toHaveBeenCalledTimes(1);
    expect(tryStartNextDownload).toHaveBeenCalledTimes(1);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders downloading state when active or pending matches songIds and source requested them", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: "song-2",
      pending: ["song-3"],
    });
    (getRequestersForSource as jest.Mock).mockReturnValue(["song-2", "song-3"]);

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
        <BulkSongCacheButton
          sourceKey="album:123"
          songIds={songIds}
          cacheEntries={cacheEntries}
        />,
      );
    });

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain("downloading... (1/3)");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("stops downloading and cleans up requesters when user confirms stop prompt while running", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: "song-1",
      pending: ["song-2", "song-3"],
    });
    (getRequestersForSource as jest.Mock).mockReturnValue([
      "song-1",
      "song-2",
      "song-3",
    ]);

    const songIds = ["song-1", "song-2", "song-3"];
    const cacheEntries = new Map<string, SongCacheRow>();

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton
          sourceKey="album:123"
          songIds={songIds}
          cacheEntries={cacheEntries}
        />,
      );
    });

    const button = component.root.findByType(Button);

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

    // Unfinished songs (song-1, song-2, song-3) should have requesters removed
    expect(removeQueueRequester).toHaveBeenCalledWith("song-1", "album:123");
    expect(removeQueueRequester).toHaveBeenCalledWith("song-2", "album:123");
    expect(removeQueueRequester).toHaveBeenCalledWith("song-3", "album:123");

    // Since requester count is 0, removeFromDownloadQueue should be called for each
    expect(removeFromDownloadQueue).toHaveBeenCalledWith("song-1");
    expect(removeFromDownloadQueue).toHaveBeenCalledWith("song-2");
    expect(removeFromDownloadQueue).toHaveBeenCalledWith("song-3");

    // Active song is cancelled
    expect(cancelSongCaching).toHaveBeenCalledWith("song-1");
    expect(notifyCacheQueueUpdated).toHaveBeenCalled();

    renderer.act(() => {
      component.unmount();
    });
  });

  it("leaves queue row alone when stopped if song has remaining requesters", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: "song-1",
      pending: ["song-2"],
    });
    (getRequestersForSource as jest.Mock).mockReturnValue(["song-1", "song-2"]);

    const songIds = ["song-1", "song-2"];
    const cacheEntries = new Map<string, SongCacheRow>();

    // song-1 count is 1 (has another requester), song-2 count is 0
    (getQueueRequesterCount as jest.Mock).mockImplementation((songId: string) => {
      return songId === "song-1" ? 1 : 0;
    });

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton
          sourceKey="album:123"
          songIds={songIds}
          cacheEntries={cacheEntries}
        />,
      );
    });

    const button = component.root.findByType(Button);
    renderer.act(() => {
      button.props.onPress();
    });

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const confirmStop = alertCalls[0][2].find((b: any) => b.text === "yes");
    renderer.act(() => {
      confirmStop.onPress();
    });

    expect(removeQueueRequester).toHaveBeenCalledWith("song-1", "album:123");
    expect(removeQueueRequester).toHaveBeenCalledWith("song-2", "album:123");

    // song-1 still had count 1, so removeFromDownloadQueue not called on stop
    expect(removeFromDownloadQueue).not.toHaveBeenCalledWith("song-1");
    // song-2 had count 0, so removeFromDownloadQueue called on stop
    expect(removeFromDownloadQueue).toHaveBeenCalledWith("song-2");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders idle state for source B when shared song is downloading for source A", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: "song-shared",
      pending: ["song-other"],
    });

    (getRequestersForSource as jest.Mock).mockImplementation((key: string) => {
      if (key === "album:a") return ["song-shared"];
      return [];
    });

    const cacheEntries = new Map<string, SongCacheRow>();

    let componentA: any;
    let componentB: any;
    renderer.act(() => {
      componentA = renderer.create(
        <BulkSongCacheButton
          sourceKey="album:a"
          songIds={["song-shared"]}
          cacheEntries={cacheEntries}
        />,
      );
      componentB = renderer.create(
        <BulkSongCacheButton
          sourceKey="playlist:b"
          songIds={["song-shared", "song-b"]}
          cacheEntries={cacheEntries}
        />,
      );
    });

    const jsonA = JSON.stringify(componentA.toJSON());
    const jsonB = JSON.stringify(componentB.toJSON());

    // Source A is downloading
    expect(jsonA).toContain("downloading... (0/1)");

    // Source B must render idle label, NOT downloading
    expect(jsonB).not.toContain("downloading");
    expect(jsonB).toContain("make available offline");

    renderer.act(() => {
      componentA.unmount();
      componentB.unmount();
    });
  });

  it("handles tap when getRequestersForSource is empty by starting run rather than stopping", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: "song-1",
      pending: [],
    });
    // sourceKey has no active requesters
    (getRequestersForSource as jest.Mock).mockReturnValue([]);

    const songIds = ["song-1", "song-2"];
    const cacheEntries = new Map<string, SongCacheRow>();

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <BulkSongCacheButton
          sourceKey="playlist:unrelated"
          songIds={songIds}
          cacheEntries={cacheEntries}
        />,
      );
    });

    const button = component.root.findByType(Button);
    renderer.act(() => {
      button.props.onPress();
    });

    // Alert.alert (confirm stop) should NOT be called because it is not considered running for this source
    expect(Alert.alert).not.toHaveBeenCalled();
    // Instead it enqueues its songs and calls tryStartNextDownload
    expect(addQueueRequester).toHaveBeenCalledWith("song-1", "playlist:unrelated");
    expect(addQueueRequester).toHaveBeenCalledWith("song-2", "playlist:unrelated");
    expect(tryStartNextDownload).toHaveBeenCalled();

    renderer.act(() => {
      component.unmount();
    });
  });

  it("adds requester row for source B when tapping make available offline for shared song already active for source A", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: "song-shared",
      pending: [],
    });
    // Source A already has requested song-shared; source B hasn't yet
    (getRequestersForSource as jest.Mock).mockImplementation((key: string) => {
      if (key === "album:a") return ["song-shared"];
      return [];
    });

    const cacheEntries = new Map<string, SongCacheRow>();

    let componentB: any;
    renderer.act(() => {
      componentB = renderer.create(
        <BulkSongCacheButton
          sourceKey="playlist:b"
          songIds={["song-shared"]}
          cacheEntries={cacheEntries}
        />,
      );
    });

    const buttonB = componentB.root.findByType(Button);
    renderer.act(() => {
      buttonB.props.onPress();
    });

    // source B adds itself as requester
    expect(addQueueRequester).toHaveBeenCalledWith("song-shared", "playlist:b");
    // enqueuePendingDownload uses INSERT OR IGNORE, called with song-shared
    expect(enqueuePendingDownload).toHaveBeenCalledWith("song-shared");
    // tryStartNextDownload triggered
    expect(tryStartNextDownload).toHaveBeenCalled();

    renderer.act(() => {
      componentB.unmount();
    });
  });

  it("keeps shared song downloading and in queue when source A stops but source B still wants it", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: "song-shared",
      pending: [],
    });
    // Both A and B hold requester rows on song-shared
    (getRequestersForSource as jest.Mock).mockImplementation((key: string) => {
      if (key === "album:a" || key === "playlist:b") return ["song-shared"];
      return [];
    });
    // Before stopping A, count is 2; after A removes, count is 1 (> 0)
    (getQueueRequesterCount as jest.Mock).mockReturnValue(1);

    const cacheEntries = new Map<string, SongCacheRow>();

    let componentA: any;
    let componentB: any;
    renderer.act(() => {
      componentA = renderer.create(
        <BulkSongCacheButton
          sourceKey="album:a"
          songIds={["song-shared"]}
          cacheEntries={cacheEntries}
        />,
      );
      componentB = renderer.create(
        <BulkSongCacheButton
          sourceKey="playlist:b"
          songIds={["song-shared"]}
          cacheEntries={cacheEntries}
        />,
      );
    });

    // Both show downloading initially
    expect(JSON.stringify(componentA.toJSON())).toContain("downloading... (0/1)");
    expect(JSON.stringify(componentB.toJSON())).toContain("downloading... (0/1)");

    // Tap stop on A
    const buttonA = componentA.root.findByType(Button);
    renderer.act(() => {
      buttonA.props.onPress();
    });

    // Confirm stop on A
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const confirmStop = alertCalls[0][2].find((b: any) => b.text === "yes");
    renderer.act(() => {
      confirmStop.onPress();
    });

    // A's requester row is removed
    expect(removeQueueRequester).toHaveBeenCalledWith("song-shared", "album:a");
    // Requester count was 1, so removeFromDownloadQueue and cancelSongCaching NOT called
    expect(removeFromDownloadQueue).not.toHaveBeenCalledWith("song-shared");
    expect(cancelSongCaching).not.toHaveBeenCalledWith("song-shared");

    // B still holds requester row and its button still displays downloading
    expect(JSON.stringify(componentB.toJSON())).toContain("downloading... (0/1)");

    renderer.act(() => {
      componentA.unmount();
      componentB.unmount();
    });
  });
});

