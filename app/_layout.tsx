import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, useColorScheme } from "react-native";
import {
  ActivityIndicator,
  MD3DarkTheme,
  MD3LightTheme,
  Provider as PaperProvider,
} from "react-native-paper";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ChangelogModal } from "@/components/ChangelogModal";
import { subscribeAuthState } from "@/services/api";
import {
  checkLegacyOfflineCache,
  deleteLegacyOfflineCache,
  formatBytes,
} from "@/services/legacyCache";
import { runLegacyMigration } from "@/services/migration";
import { resumePendingDownloadsAfterRestart } from "@/services/songCache";
import { layoutStyles } from "@/stylesheets";
import { APP_VERSION_CODE } from "@/utils/constants";
import { useMaterial3Theme } from "@pchmn/expo-material3-theme";

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const needsInitialSyncRef = useRef(false);

  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const { theme } = useMaterial3Theme();

  useEffect(() => {
    async function checkToken() {
      try {
        const serverUrl = await SecureStore.getItemAsync("serverUrl");
        const subsonicVersion = await SecureStore.getItemAsync("subsonicVersion");
        const username = await SecureStore.getItemAsync("username");
        const password = await SecureStore.getItemAsync("password");

        const loggedIn =
          !!serverUrl && !!subsonicVersion && !!username && !!password;
        setIsLoggedIn(loggedIn);

        if (loggedIn && serverUrl) {
          const serverUrls = await SecureStore.getItemAsync("serverUrls");
          if (!serverUrls) {
            await SecureStore.setItemAsync(
              "serverUrls",
              JSON.stringify([{ url: serverUrl, label: "server url" }]),
            );
            await SecureStore.setItemAsync("serverUrlLabel", "server url");
          }
        }
      } catch (e) {
        console.error("failed to check token:", e);
      } finally {
        setIsLoading(false);
      }
    }

    async function checkVersionCodeUpdate() {
      try {
        const lastSeen = await SecureStore.getItemAsync("last_seen_version_code");
        const serverUrl = await SecureStore.getItemAsync("serverUrl");
        if (lastSeen !== null) {
          const prevCode = parseInt(lastSeen, 10);
          if (!isNaN(prevCode) && APP_VERSION_CODE > prevCode) {
            setShowWhatsNew(true);
          }
        } else if (serverUrl) {
          // Existing logged-in user updating to a newer build
          setShowWhatsNew(true);
        }
        await SecureStore.setItemAsync(
          "last_seen_version_code",
          String(APP_VERSION_CODE),
        );
      } catch (e) {
        console.error("failed to check version code update:", e);
      }
    }

    async function initialize() {
      // one-time import of legacy data (credentials + settings), guarded by
      // the `migration.complete` flag. must finish before session restore reads
      // secure store so a migrated session is treated as logged in.
      try {
        const migrationResult = await runLegacyMigration();
        if (
          migrationResult.status === "migrated" &&
          migrationResult.credentials.status === "migrated"
        ) {
          needsInitialSyncRef.current = true;
        }
      } catch (e) {
        console.error("failed to run legacy migration:", e);
      }

      await Promise.all([checkToken(), checkVersionCodeUpdate()]);
    }

    initialize();

    try {
      resumePendingDownloadsAfterRestart();
    } catch (e) {
      console.error("failed to resume pending downloads after restart:", e);
    }

    const unsubscribe = subscribeAuthState((loggedIn) => {
      setIsLoggedIn(loggedIn);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const isAuthRoute =
      (segments as string[]).includes("(auth)") ||
      (segments as string[]).includes("connect");

    if (!isLoggedIn && !isAuthRoute) {
      router.replace("/connect");
    } else if (isLoggedIn && (isAuthRoute || needsInitialSyncRef.current)) {
      needsInitialSyncRef.current = false;
      router.replace({ pathname: "/sync", params: { initial: "true" } });
    }
  }, [isLoggedIn, isLoading, segments, router]);

  useEffect(() => {
    if (isLoading) return;

    checkLegacyOfflineCache()
      .then((info) => {
        if (info.exists && info.sizeBytes > 0) {
          Alert.alert(
            "legacy offline downloads detected",
            `we found ${formatBytes(info.sizeBytes)} of downloaded music from the previous version of the app. this version cannot use these downloads. delete them now to reclaim storage?`,
            [
              { text: "not now", style: "cancel" },
              {
                text: "delete and reclaim space",
                style: "destructive",
                onPress: async () => {
                  const res = await deleteLegacyOfflineCache();
                  if (!res.success) {
                    Alert.alert(
                      "error",
                      "failed to delete legacy offline downloads",
                    );
                  }
                },
              },
            ],
          );
        }
      })
      .catch((e) => {
        console.error("failed to check legacy offline cache on launch:", e);
      });
  }, [isLoading]);

  const paperTheme = useMemo(
    () =>
      colorScheme === "dark"
        ? { ...MD3DarkTheme, colors: theme.dark }
        : { ...MD3LightTheme, colors: theme.light },
    [colorScheme, theme],
  );

  const isAuthRoute =
    (segments as string[]).includes("(auth)") ||
    (segments as string[]).includes("connect");
  const routeMatchesAuth =
    (!isLoggedIn && isAuthRoute) || (isLoggedIn && !isAuthRoute);
  const showSpinner = isLoading || !routeMatchesAuth;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PaperProvider theme={paperTheme}>
          <SafeAreaView style={layoutStyles.safeArea}>
            {showSpinner ? (
              <SafeAreaView style={layoutStyles.container}>
                <ActivityIndicator size="large" />
              </SafeAreaView>
            ) : (
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(main)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="album/[id]" />
                <Stack.Screen name="artist/[id]" />
                <Stack.Screen
                  name="player"
                  options={{
                    presentation: "modal",
                    animation: "slide_from_bottom",
                  }}
                />
                <Stack.Screen
                  name="queue"
                  options={{
                    presentation: "modal",
                    animation: "slide_from_bottom",
                  }}
                />
              </Stack>
            )}
            <ChangelogModal
              visible={showWhatsNew}
              onDismiss={() => setShowWhatsNew(false)}
              title="what's new"
            />
          </SafeAreaView>
        </PaperProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

