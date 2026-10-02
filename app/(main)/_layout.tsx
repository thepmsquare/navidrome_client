import { Tabs } from "expo-router";
import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Icon } from "react-native-paper";

import { AppBottomBar } from "@/components/AppBottomBar";
import { getStoredCredentials, refreshPlayStats } from "@/services/api";

let lastAutoRefreshTime = 0;
let isAutoRefreshInFlight = false;
export const AUTO_REFRESH_COOLDOWN_MS = 60000;

export function _resetAutoRefreshStateForTesting(): void {
  lastAutoRefreshTime = 0;
  isAutoRefreshInFlight = false;
}

export async function triggerAutoPlayStatsRefresh(): Promise<void> {
  const now = Date.now();
  if (isAutoRefreshInFlight) {
    return;
  }
  if (now - lastAutoRefreshTime < AUTO_REFRESH_COOLDOWN_MS) {
    return;
  }

  isAutoRefreshInFlight = true;
  try {
    let creds;
    try {
      creds = await getStoredCredentials();
    } catch {
      return;
    }
    if (!creds?.serverUrl || !creds?.username || !creds?.password) {
      return;
    }

    await refreshPlayStats();
    lastAutoRefreshTime = Date.now();
  } catch (error) {
    // Failures are silent
    console.error("failed to auto refresh play stats:", error);
  } finally {
    isAutoRefreshInFlight = false;
  }
}

export default function MainLayout() {
  useEffect(() => {
    triggerAutoPlayStatsRefresh();

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          triggerAutoPlayStatsRefresh();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <AppBottomBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "home",
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              source={focused ? "home" : "home-outline"}
              size={size}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "library",
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              source={
                focused ? "music-box-multiple" : "music-box-multiple-outline"
              }
              size={size}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "search",
          tabBarIcon: ({ color, size }) => (
            <Icon
              source="magnify"
              size={size}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: "sync",
          tabBarIcon: ({ color, size }) => (
            <Icon
              source="sync"
              size={size}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "settings",
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              source={focused ? "cog" : "cog-outline"}
              size={size}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
    </Tabs>
  );
}
