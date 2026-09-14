import React from "react";
import renderer from "react-test-renderer";

import { SongCacheButton } from "@/components/SongCacheButton";
import { getSongCacheEntry } from "@/services/db";
import { SongCacheRow, SongCacheType } from "@/types";

let cacheListener:
  | ((data: { songId: string; entry: SongCacheRow | null }) => void)
  | null = null;
let progressListener:
  | ((data: { songId: string; progress: number }) => void)
  | null = null;

jest.mock("@/services/db", () => ({
  getSongCacheEntry: jest.fn(),
}));

jest.mock("@/services/songCache", () => ({
  cacheSongManually: jest.fn(),
  cancelSongCaching: jest.fn(),
  deleteSongFromCache: jest.fn(),
  isSongCaching: jest.fn(() => false),
  subscribeSongCache: jest.fn((fn) => {
    cacheListener = fn;
    return () => {
      cacheListener = null;
    };
  }),
  subscribeSongCacheProgress: jest.fn((fn) => {
    progressListener = fn;
    return () => {
      progressListener = null;
    };
  }),
}));

describe("SongCacheButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheListener = null;
    progressListener = null;
    (getSongCacheEntry as jest.Mock).mockReturnValue(null);
  });

  it("returns null when mini=true, hideIfUncached=true and song is uncached", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongCacheButton
          songId="song-1"
          mini
          hideIfUncached
          initialEntry={null}
        />,
      );
    });

    expect(component.toJSON()).toBeNull();
    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders IconButton when mini=true, hideIfUncached=false (default) and song is uncached", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongCacheButton
          songId="song-1"
          mini
          initialEntry={null}
        />,
      );
    });

    expect(component.toJSON()).not.toBeNull();
    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders IconButton when mini=true, hideIfUncached=true and song is cached", () => {
    const cachedEntry: SongCacheRow = {
      songId: "song-1",
      cacheType: SongCacheType.Manual,
      filePath: "file:///path/to/song.mp3",
      fileSizeBytes: 123456,
      addedAt: "2026-09-01T00:00:00.000Z",
      lastAccessedAt: null,
    };

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongCacheButton
          songId="song-1"
          mini
          hideIfUncached
          initialEntry={cachedEntry}
        />,
      );
    });

    expect(component.toJSON()).not.toBeNull();
    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders progress ring when hideIfUncached=true and song starts caching", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongCacheButton
          songId="song-1"
          mini
          hideIfUncached
          initialEntry={null}
        />,
      );
    });

    expect(component.toJSON()).toBeNull();

    // Trigger download progress
    renderer.act(() => {
      progressListener?.({ songId: "song-1", progress: 0.45 });
    });

    const jsonStr = JSON.stringify(component.toJSON());
    expect(jsonStr).toContain("cancel download");

    // When cache completes
    const completedEntry: SongCacheRow = {
      songId: "song-1",
      cacheType: SongCacheType.Manual,
      filePath: "file:///path/to/song.mp3",
      fileSizeBytes: 123456,
      addedAt: "2026-09-01T00:00:00.000Z",
      lastAccessedAt: null,
    };

    renderer.act(() => {
      cacheListener?.({ songId: "song-1", entry: completedEntry });
    });

    // Still rendered (now cached icon)
    expect(component.toJSON()).not.toBeNull();

    // When cache entry removed
    renderer.act(() => {
      cacheListener?.({ songId: "song-1", entry: null });
    });

    // Back to null
    expect(component.toJSON()).toBeNull();
    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders full button when variant='button' even if uncached and hideIfUncached=true", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongCacheButton
          songId="song-1"
          variant="button"
          hideIfUncached
          initialEntry={null}
        />,
      );
    });

    expect(component.toJSON()).not.toBeNull();
    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders clock-outline icon when song is auto-cached", () => {
    const { IconButton } = require("react-native-paper");
    const autoEntry: SongCacheRow = {
      songId: "song-auto-1",
      cacheType: SongCacheType.Auto,
      filePath: "file:///path/to/auto.mp3",
      fileSizeBytes: 123456,
      addedAt: "2026-09-01T00:00:00.000Z",
      lastAccessedAt: null,
    };

    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongCacheButton
          songId="song-auto-1"
          mini
          hideIfUncached
          initialEntry={autoEntry}
        />,
      );
    });

    const iconButton = component.root.findByType(IconButton);
    expect(iconButton.props.icon).toBe("clock-outline");
    expect(iconButton.props.accessibilityLabel).toBe(
      "temporarily available offline",
    );

    renderer.act(() => {
      component.unmount();
    });
  });
});
