import * as WebBrowser from "expo-web-browser";
import React from "react";
import renderer from "react-test-renderer";

import { RichHtmlText } from "@/components/RichHtmlText";

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(),
}));

describe("RichHtmlText", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("decodes html entities properly", () => {
    let tree: renderer.ReactTestRenderer | null = null;
    renderer.act(() => {
      tree = renderer.create(
        <RichHtmlText html="rock &amp; roll &quot;legends&#39; band" />,
      );
    });

    const root = tree!.root;
    expect(root).toBeTruthy();
    const textNode = root.findByProps({ variant: "bodyMedium" });
    expect(textNode.props.children).toEqual(
      expect.arrayContaining(["rock & roll \"legends' band"]),
    );
  });

  it("renders clickable link and opens browser on press", async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    renderer.act(() => {
      tree = renderer.create(
        <RichHtmlText html='formed in london. <a href="https://www.last.fm/music/Pink+Floyd" target="_blank">read more on last.fm</a>' />,
      );
    });

    const root = tree!.root;
    const linkNodes = root.findAll(
      (node) => node.props?.onPress !== undefined && node.props?.children === "read more on last.fm",
    );
    expect(linkNodes.length).toBeGreaterThan(0);

    await renderer.act(async () => {
      linkNodes[0].props.onPress();
    });

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://www.last.fm/music/Pink+Floyd",
    );
  });

  it("handles empty or null html gracefully", () => {
    let tree: renderer.ReactTestRenderer | null = null;
    renderer.act(() => {
      tree = renderer.create(<RichHtmlText html="" />);
    });
    expect(tree).toBeTruthy();
  });
});
