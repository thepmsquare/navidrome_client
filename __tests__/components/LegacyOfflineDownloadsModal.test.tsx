import React from "react";
import { MD3LightTheme, Provider as PaperProvider } from "react-native-paper";
import renderer, { act } from "react-test-renderer";

import { LegacyOfflineDownloadsModal } from "@/components/LegacyOfflineDownloadsModal";

jest.mock("@/services/legacyCache", () => ({
  formatBytes: (bytes: number) => `${bytes} b`,
}));

function renderModal(
  props: Partial<React.ComponentProps<typeof LegacyOfflineDownloadsModal>> = {},
) {
  const defaultProps = {
    visible: true,
    sizeBytes: 52428800,
    onDismiss: jest.fn(),
    ...props,
  };

  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={MD3LightTheme}>
        <LegacyOfflineDownloadsModal {...defaultProps} />
      </PaperProvider>,
    );
  });

  return { tree: tree!, props: defaultProps };
}

function collectText(node: renderer.ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return node.children.map((child) => collectText(child as any)).join("");
}

describe("LegacyOfflineDownloadsModal", () => {
  it("renders nothing when not visible", () => {
    const { tree } = renderModal({ visible: false });
    expect(collectText(tree.root)).toBe("");
  });

  it("renders lowercase auto-cleared notice and formatted size", () => {
    const { tree } = renderModal({ sizeBytes: 1048576 });
    const text = collectText(tree.root);

    expect(text).toContain("important update about offline downloads");
    expect(text).toContain("complete app rewrite");
    expect(text).toContain(
      "previously downloaded songs are not compatible with this version",
    );
    expect(text).toContain("1048576 b");
    expect(text).toContain("legacy offline cache was automatically cleared");
    expect(text).toContain("sorry for the inconvenience");
    expect(text).toContain("got it");
  });

  it("calls onDismiss when got it is pressed", () => {
    const onDismiss = jest.fn();
    const { tree } = renderModal({ onDismiss });

    const dismissBtn = tree.root.findByProps({
      testID: "legacy-offline-dismiss-button",
    });

    act(() => {
      dismissBtn.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
