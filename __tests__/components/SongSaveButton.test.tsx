import React from "react";
import { Button, IconButton } from "react-native-paper";
import renderer from "react-test-renderer";

import { SongSaveButton } from "@/components/SongSaveButton";
import {
  cancelSongExport,
  isSongExporting,
  saveSongToFiles,
  subscribeSongExportProgress,
} from "@/services/songExport";

let exportProgressListener:
  | ((data: { songId: string; progress: number }) => void)
  | null = null;

jest.mock("@/services/songExport", () => ({
  saveSongToFiles: jest.fn(),
  cancelSongExport: jest.fn(),
  isSongExporting: jest.fn(() => false),
  subscribeSongExportProgress: jest.fn((fn) => {
    exportProgressListener = fn;
    return () => {
      exportProgressListener = null;
    };
  }),
}));

describe("SongSaveButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    exportProgressListener = null;
    (isSongExporting as jest.Mock).mockReturnValue(false);
    (saveSongToFiles as jest.Mock).mockResolvedValue({
      success: true,
      fileName: "Test Song.mp3",
    });
  });

  it("returns null when songId is null or undefined", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<SongSaveButton songId={null} />);
    });
    expect(component.toJSON()).toBeNull();
  });

  it("renders button with 'save to files' text and icon by default", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<SongSaveButton songId="song-1" />);
    });
    const button = component.root.findByType(Button);
    expect(button.props.icon).toBe("folder-download-outline");
    expect(button.props.accessibilityLabel).toBe("save to files");
    const tree = JSON.stringify(component.toJSON());
    expect(tree).toContain("save to files");
  });

  it("renders in icon-only mode when mini=true", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<SongSaveButton songId="song-1" mini />);
    });
    const iconBtn = component.root.findByType(IconButton);
    expect(iconBtn.props.icon).toBe("folder-download-outline");
    expect(iconBtn.props.accessibilityLabel).toBe("save to files");
  });

  it("triggers saveSongToFiles on press", async () => {
    const onSaveSuccess = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongSaveButton songId="song-1" onSaveSuccess={onSaveSuccess} />,
      );
    });

    const button = component.root.findByType(Button);
    await renderer.act(async () => {
      button.props.onPress();
    });

    expect(saveSongToFiles).toHaveBeenCalledWith("song-1", expect.any(Function));
    expect(onSaveSuccess).toHaveBeenCalledWith("Test Song.mp3");
  });

  it("calls onSaveCancelled when save is cancelled", async () => {
    (saveSongToFiles as jest.Mock).mockResolvedValue({
      success: false,
      cancelled: true,
    });
    const onSaveCancelled = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongSaveButton songId="song-1" onSaveCancelled={onSaveCancelled} />,
      );
    });

    const button = component.root.findByType(Button);
    await renderer.act(async () => {
      button.props.onPress();
    });

    expect(onSaveCancelled).toHaveBeenCalled();
  });

  it("calls onSaveError when save fails", async () => {
    (saveSongToFiles as jest.Mock).mockResolvedValue({
      success: false,
      error: "disk error",
    });
    const onSaveError = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <SongSaveButton songId="song-1" onSaveError={onSaveError} />,
      );
    });

    const button = component.root.findByType(Button);
    await renderer.act(async () => {
      button.props.onPress();
    });

    expect(onSaveError).toHaveBeenCalledWith("disk error");
  });

  it("displays saving state when progress updates are received", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<SongSaveButton songId="song-1" />);
    });

    renderer.act(() => {
      exportProgressListener?.({ songId: "song-1", progress: 0.45 });
    });

    const tree = JSON.stringify(component.toJSON());
    expect(tree).toContain("saving... 45%");
  });
});
