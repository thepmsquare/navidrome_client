import React from "react";
import renderer, { act } from "react-test-renderer";
import { IconButton, Modal, Switch, Text, TouchableRipple } from "react-native-paper";

import { ArtistsFilterModal } from "@/components/ArtistsFilterModal";

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

describe("ArtistsFilterModal", () => {
  const mockOnDismiss = jest.fn();
  const mockOnToggle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly when visible with default hidden state", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(
        <ArtistsFilterModal
          visible={true}
          onDismiss={mockOnDismiss}
          hideEmptyArtists={true}
          onToggleHideEmptyArtists={mockOnToggle}
        />,
      );
    });

    const str = JSON.stringify(tree.toJSON());
    expect(str).toContain("filter artists");
    expect(str).toContain("hide artists with 0 albums");
    expect(str).toContain("only show artists with at least one album");

    const switchComponent = tree.root.findByType(Switch);
    expect(switchComponent.props.value).toBe(true);
  });

  it("does not render contents when visible is false", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(
        <ArtistsFilterModal
          visible={false}
          onDismiss={mockOnDismiss}
          hideEmptyArtists={true}
          onToggleHideEmptyArtists={mockOnToggle}
        />,
      );
    });

    const str = JSON.stringify(tree.toJSON());
    expect(str).not.toContain("filter artists");
  });

  it("calls onDismiss when close icon button is pressed", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(
        <ArtistsFilterModal
          visible={true}
          onDismiss={mockOnDismiss}
          hideEmptyArtists={true}
          onToggleHideEmptyArtists={mockOnToggle}
        />,
      );
    });

    const closeBtn = tree.root.findByProps({ accessibilityLabel: "close filters" });
    act(() => {
      closeBtn.props.onPress();
    });

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleHideEmptyArtists when switch is toggled", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(
        <ArtistsFilterModal
          visible={true}
          onDismiss={mockOnDismiss}
          hideEmptyArtists={true}
          onToggleHideEmptyArtists={mockOnToggle}
        />,
      );
    });

    const switchComponent = tree.root.findByType(Switch);
    act(() => {
      switchComponent.props.onValueChange(false);
    });

    expect(mockOnToggle).toHaveBeenCalledWith(false);
  });

  it("calls onToggleHideEmptyArtists when row is pressed", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(
        <ArtistsFilterModal
          visible={true}
          onDismiss={mockOnDismiss}
          hideEmptyArtists={true}
          onToggleHideEmptyArtists={mockOnToggle}
        />,
      );
    });

    const touchableRow = tree.root.findByProps({
      accessibilityRole: "switch",
    });
    act(() => {
      touchableRow.props.onPress();
    });

    expect(mockOnToggle).toHaveBeenCalledWith(false);
  });
});
