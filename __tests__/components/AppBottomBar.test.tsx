import React from "react";
import renderer from "react-test-renderer";

import { AppBottomBar } from "@/components/AppBottomBar";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/components/MiniPlayer", () => ({
  MiniPlayer: "MiniPlayer",
}));

describe("AppBottomBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with 5 tabs and mini player by default", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<AppBottomBar />);
    });

    const { BottomNavigation } = require("react-native-paper");
    const navBar = component.root.findByType(BottomNavigation.Bar);
    expect(navBar).toBeDefined();
    expect(navBar.props.navigationState.routes).toHaveLength(5);
    // Default active tab is library (index 1)
    expect(navBar.props.navigationState.index).toBe(1);

    const miniPlayer = component.root.findByProps({ children: undefined });
    expect(miniPlayer).toBeDefined();
  });

  it("respects activeTab prop", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<AppBottomBar activeTab="home" />);
    });

    const { BottomNavigation } = require("react-native-paper");
    const navBar = component.root.findByType(BottomNavigation.Bar);
    expect(navBar.props.navigationState.index).toBe(0);

    let searchComponent: any;
    renderer.act(() => {
      searchComponent = renderer.create(<AppBottomBar activeTab="search" />);
    });
    const searchNavBar = searchComponent.root.findByType(BottomNavigation.Bar);
    expect(searchNavBar.props.navigationState.index).toBe(2);
  });

  it("navigates to appropriate path using router.replace on tab press", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<AppBottomBar />);
    });

    const { BottomNavigation } = require("react-native-paper");
    const navBar = component.root.findByType(BottomNavigation.Bar);

    renderer.act(() => {
      navBar.props.onTabPress({ route: { key: "home" } });
    });
    expect(mockReplace).toHaveBeenCalledWith("/(main)");

    renderer.act(() => {
      navBar.props.onTabPress({ route: { key: "library" } });
    });
    expect(mockReplace).toHaveBeenCalledWith("/(main)/library");

    renderer.act(() => {
      navBar.props.onTabPress({ route: { key: "search" } });
    });
    expect(mockReplace).toHaveBeenCalledWith("/(main)/search");

    renderer.act(() => {
      navBar.props.onTabPress({ route: { key: "sync" } });
    });
    expect(mockReplace).toHaveBeenCalledWith("/(main)/sync");

    renderer.act(() => {
      navBar.props.onTabPress({ route: { key: "settings" } });
    });
    expect(mockReplace).toHaveBeenCalledWith("/(main)/settings");
  });
});
