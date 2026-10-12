import React from "react";
import renderer, { act } from "react-test-renderer";
import { ChangelogModal } from "@/components/ChangelogModal";

jest.mock("@/assets/changelog.json", () => [
  {
    heading: "unreleased",
    version: "unreleased",
    versionCode: null,
    notes: [
      { text: "mock unreleased feature note", level: 0 },
    ],
  },
  {
    heading: "2.23.0+58",
    version: "2.23.0",
    versionCode: 58,
    notes: [
      { text: "mock release 58 note", level: 0 },
    ],
  },
  {
    heading: "2.22.0+55",
    version: "2.22.0",
    versionCode: 55,
    notes: [
      { text: "mock release 55 note", level: 0 },
    ],
  },
]);

jest.mock("react-native-paper", () => {
  const actual = jest.requireActual("react-native-paper");
  return {
    ...actual,
    Portal: ({ children }: any) => children,
    Modal: ({ children, visible }: any) => (visible ? children : null),
    IconButton: ({ onPress, testID, accessibilityLabel }: any) => {
      const { Pressable } = require("react-native");
      return (
        <Pressable
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
        />
      );
    },
  };
});

describe("ChangelogModal", () => {
  it("renders null when visible is false", () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ChangelogModal visible={false} onDismiss={jest.fn()} />,
      );
    });

    expect(tree?.toJSON()).toBeNull();
  });

  it("renders unreleased notes open and previous versions in closed accordions", () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ChangelogModal visible={true} onDismiss={jest.fn()} />,
      );
    });

    const root = tree!.root;

    const texts = root.findAllByType("Text" as any).map((t) => t.props.children);
    const joinedTexts = texts.flat(Infinity).join(" ");

    expect(joinedTexts).toContain("changelog");
    expect(joinedTexts).toContain("current version (in development)");
    expect(joinedTexts).toContain("unreleased");
    expect(joinedTexts).toContain("previous versions");

    // Top active unreleased notes are open immediately
    expect(joinedTexts).toContain("mock unreleased feature note");

    // Previous version notes are not shown while closed
    expect(joinedTexts).not.toContain("mock release 58 note");
    expect(joinedTexts).not.toContain("mock release 55 note");
  });

  it("expands a previous version accordion on press and reveals its notes", () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ChangelogModal visible={true} onDismiss={jest.fn()} />,
      );
    });

    const root = tree!.root;

    const targetAccordion = root.findByProps({
      testID: "changelog-accordion-2.23.0+58",
    });

    expect(targetAccordion).toBeDefined();

    // Tap to expand
    act(() => {
      targetAccordion.props.onPress();
    });

    const textsAfterExpand = root
      .findAllByType("Text" as any)
      .map((t) => t.props.children)
      .flat(Infinity)
      .join(" ");

    expect(textsAfterExpand).toContain("mock release 58 note");

    // Tap again to collapse
    act(() => {
      targetAccordion.props.onPress();
    });

    const textsAfterCollapse = root
      .findAllByType("Text" as any)
      .map((t) => t.props.children)
      .flat(Infinity)
      .join(" ");

    expect(textsAfterCollapse).not.toContain("mock release 58 note");
  });

  it("calls onDismiss when close button is pressed", () => {
    const onDismiss = jest.fn();
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ChangelogModal visible={true} onDismiss={onDismiss} />,
      );
    });

    const root = tree!.root;
    const closeButton = root.findByProps({
      testID: "changelog-close-button",
    });

    expect(closeButton).toBeDefined();
    act(() => {
      closeButton.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders with custom title when provided", () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ChangelogModal
          visible={true}
          onDismiss={jest.fn()}
          title="what's new"
        />,
      );
    });

    const root = tree!.root;
    const texts = root
      .findAllByType("Text" as any)
      .map((t) => t.props.children)
      .flat(Infinity)
      .join(" ");

    expect(texts).toContain("what's new");
  });
});
