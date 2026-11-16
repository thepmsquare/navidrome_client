import React from "react";
import renderer from "react-test-renderer";

import LibraryHomeScreen from "@/app/(main)/library/index";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useFocusEffect: jest.fn(),
}));

describe("LibraryHomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders browse buttons including tracks and favorites", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<LibraryHomeScreen />);
    });

    const { Button } = require("react-native-paper");
    const buttons = component.root.findAllByType(Button);
    const labels = buttons.map((b: any) =>
      typeof b.props.children === "string" ? b.props.children : "",
    );

    expect(labels).toContain("tracks");
    expect(labels).toContain("favorites");
    expect(labels).toContain("albums");
    expect(labels).toContain("playlists");
    expect(labels).toContain("artists");
    expect(labels).toContain("available offline");
    expect(labels).toContain("download queue");
    expect(labels).toContain("pending scrobbles");
  });

  it("navigates to /library/favorites when favorites button is pressed", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<LibraryHomeScreen />);
    });

    const { Button } = require("react-native-paper");
    const favoritesBtn = component.root
      .findAllByType(Button)
      .find((b: any) => b.props.children === "favorites");

    expect(favoritesBtn).toBeDefined();

    renderer.act(() => {
      favoritesBtn.props.onPress();
    });

    renderer.act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockPush).toHaveBeenCalledWith("/library/favorites");
  });
});
