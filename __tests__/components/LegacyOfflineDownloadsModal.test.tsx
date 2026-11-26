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

    expect(text).toContain("your offline music was removed");
    expect(text).toContain("offline music from the previous version cannot be used");
    expect(text).toContain("1048576 b");
    expect(text).toContain("automatically removed to free up storage");
    expect(text).toContain("apologies for the disruption");
    expect(text).toContain("confirm");
  });

  it("calls onDismiss when confirm is pressed", () => {
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
