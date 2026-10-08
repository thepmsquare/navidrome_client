import { Tabs } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, AppState, type AppStateStatus } from "react-native";
import { Icon } from "react-native-paper";

import { AppBottomBar } from "@/components/AppBottomBar";
import {
  client_app_sync,
  getStoredCredentials,
  isSyncInProgress,
  refreshPlayStats,
  subscribeSyncState,
} from "@/services/api";

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

let lastAutoSyncTime = 0;
let isAutoSyncInFlight = false;
export const AUTO_SYNC_COOLDOWN_MS = 300000; // 5 minutes

export function _resetAutoSyncStateForTesting(): void {
  lastAutoSyncTime = 0;
  isAutoSyncInFlight = false;
}

export async function triggerAutoSync(): Promise<void> {
  const now = Date.now();
  if (isAutoSyncInFlight || isSyncInProgress()) return;
  if (now - lastAutoSyncTime < AUTO_SYNC_COOLDOWN_MS) return;

  isAutoSyncInFlight = true;
  try {
    let creds;
    try {
      creds = await getStoredCredentials();
    } catch {
      return;
    }
    if (!creds?.serverUrl || !creds?.username || !creds?.password) return;

    await client_app_sync(false);
    lastAutoSyncTime = Date.now();
  } catch (error) {
    console.error("failed to auto sync:", error);
  } finally {
    isAutoSyncInFlight = false;
  }
}

function SyncTabIcon({
  color,
  size,
}: {
  color: string | undefined;
  size: number;
}) {
  const [syncing, setSyncing] = useState(() => isSyncInProgress());
  const [spinAnim] = useState(() => new Animated.Value(0));
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSyncState((isSyncing) => {
      setSyncing(isSyncing);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (syncing) {
      spinAnim.setValue(0);
      animRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      spinAnim.setValue(0);
    }
  }, [syncing, spinAnim]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Icon source="sync" size={size} color={color} />
    </Animated.View>
  );
}

export default function MainLayout() {
  useEffect(() => {
    triggerAutoPlayStatsRefresh();
    triggerAutoSync();

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          triggerAutoPlayStatsRefresh();
          triggerAutoSync();
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
            <SyncTabIcon
              color={typeof color === "string" ? color : undefined}
              size={size}
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
