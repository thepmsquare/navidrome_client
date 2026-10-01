import { useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import { BottomNavigation, Icon } from "react-native-paper";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";

import { MiniPlayer } from "@/components/MiniPlayer";
import { useAppTheme } from "@/types";

export type TabKey = "home" | "library" | "search" | "sync" | "settings";

export interface TabRoute {
  key: TabKey;
  title: string;
  focusedIcon: string;
  unfocusedIcon: string;
  path: string;
}

export const APP_TAB_ROUTES: TabRoute[] = [
  {
    key: "home",
    title: "home",
    focusedIcon: "home",
    unfocusedIcon: "home-outline",
    path: "/(main)",
  },
  {
    key: "library",
    title: "library",
    focusedIcon: "music-box-multiple",
    unfocusedIcon: "music-box-multiple-outline",
    path: "/(main)/library",
  },
  {
    key: "search",
    title: "search",
    focusedIcon: "magnify",
    unfocusedIcon: "magnify",
    path: "/(main)/search",
  },
  {
    key: "sync",
    title: "sync",
    focusedIcon: "sync",
    unfocusedIcon: "sync",
    path: "/(main)/sync",
  },
  {
    key: "settings",
    title: "settings",
    focusedIcon: "cog",
    unfocusedIcon: "cog-outline",
    path: "/(main)/settings",
  },
];

export interface AppBottomBarProps {
  activeTab?: TabKey;
  showMiniPlayer?: boolean;
  navigation?: any;
  state?: any;
  descriptors?: any;
  insets?: EdgeInsets;
}

export function AppBottomBar({
  activeTab = "library",
  showMiniPlayer = true,
  navigation,
  state,
  descriptors,
  insets,
}: AppBottomBarProps) {
  const router = useRouter();
  const hookInsets = useSafeAreaInsets();
  const theme = useAppTheme();

  const isTabsControlled = Boolean(state && navigation && descriptors);

  const activeIndex = useMemo(() => {
    const idx = APP_TAB_ROUTES.findIndex((r) => r.key === activeTab);
    return idx >= 0 ? idx : 1;
  }, [activeTab]);

  const standaloneNavState = useMemo(
    () => ({
      index: activeIndex,
      routes: APP_TAB_ROUTES.map((r) => ({ key: r.key })),
    }),
    [activeIndex],
  );

  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      {showMiniPlayer && <MiniPlayer />}
      <BottomNavigation.Bar
        navigationState={isTabsControlled ? state : standaloneNavState}
        safeAreaInsets={insets ?? hookInsets}
        onTabPress={({ route, preventDefault }) => {
          if (isTabsControlled) {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!event.defaultPrevented) {
              const r = route as any;
              navigation.navigate(r.name, r.params);
            }
          } else {
            const target = APP_TAB_ROUTES.find((r) => r.key === route.key);
            if (target) {
              router.replace(target.path as any);
            }
          }
        }}
        renderIcon={({ route, focused, color }) => {
          if (isTabsControlled) {
            const { options } = descriptors[route.key];
            if (options?.tabBarIcon) {
              return options.tabBarIcon({ focused, color, size: 24 });
            }
            return null;
          }

          const tab = APP_TAB_ROUTES.find((r) => r.key === route.key);
          if (!tab) return null;
          return (
            <Icon
              source={focused ? tab.focusedIcon : tab.unfocusedIcon}
              size={24}
              color={typeof color === "string" ? color : undefined}
            />
          );
        }}
        getLabelText={({ route }) => {
          if (isTabsControlled) {
            const { options } = descriptors[route.key];
            const r = route as any;
            return (
              options?.title ??
              (typeof options?.tabBarLabel === "string"
                ? options.tabBarLabel
                : r.name)
            );
          }

          const tab = APP_TAB_ROUTES.find((r) => r.key === route.key);
          return tab ? tab.title : route.key;
        }}
      />
    </View>
  );
}
