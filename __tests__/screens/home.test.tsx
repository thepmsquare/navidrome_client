import React from "react";
import renderer from "react-test-renderer";
import { Text } from "react-native-paper";

import HomeScreen from "@/app/(main)/index";

describe("HomeScreen", () => {
  it("renders home title", () => {
    let tree: any;
    renderer.act(() => {
      tree = renderer.create(<HomeScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("home");
  });
});
