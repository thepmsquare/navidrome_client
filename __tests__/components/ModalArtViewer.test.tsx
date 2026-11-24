import React from "react";
import { BackHandler } from "react-native";
import renderer, { act } from "react-test-renderer";
import { ModalArtViewer } from "@/components/ModalArtViewer";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 32, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("react-native-paper", () => {
  const actual = jest.requireActual("react-native-paper");
  return {
    ...actual,
    Portal: ({ children }: any) => children,
    Modal: ({ children, visible }: any) => (visible ? children : null),
  };
});

describe("ModalArtViewer", () => {
  let backHandlerCallback: (() => boolean) | null = null;
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    backHandlerCallback = null;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event: any, cb: any) => {
      backHandlerCallback = cb;
      return { remove: mockRemove } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should not render when isVisible is false", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ModalArtViewer isVisible={false} artUrl="https://example.com/art.jpg" onClose={jest.fn()} />
      );
    });
    expect(root.toJSON()).toBeNull();
  });

  it("should not render when artUrl is null", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ModalArtViewer isVisible={true} artUrl={null} onClose={jest.fn()} />
      );
    });
    expect(root.toJSON()).toBeNull();
  });

  it("should render image and close button when visible with artUrl", () => {
    const onClose = jest.fn();
    let root: any;
    act(() => {
      root = renderer.create(
        <ModalArtViewer isVisible={true} artUrl="https://example.com/art.jpg" onClose={onClose} />
      );
    });

    const closeBtn = root.root.findByProps({ accessibilityLabel: "close artwork viewer" });
    expect(closeBtn).toBeDefined();

    act(() => {
      closeBtn.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should dismiss on hardware back press", () => {
    const onClose = jest.fn();
    act(() => {
      renderer.create(
        <ModalArtViewer isVisible={true} artUrl="https://example.com/art.jpg" onClose={onClose} />
      );
    });

    expect(typeof backHandlerCallback).toBe("function");
    act(() => {
      backHandlerCallback!();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
