import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  ActivityIndicator,
  MD3DarkTheme,
  MD3LightTheme,
  Provider as PaperProvider,
  Portal,
  Snackbar,
} from "react-native-paper";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ChangelogModal } from "@/components/ChangelogModal";
import { ExpandablePlayer } from "@/components/ExpandablePlayer";
import { LegacyOfflineDownloadsModal } from "@/components/LegacyOfflineDownloadsModal";
import { PlayerOverlayProvider } from "@/contexts/PlayerOverlayContext";
import { subscribeAuthState } from "@/services/api";
import {
  buildPaperFonts,
  FONT_ASSETS,
  getFontFamily,
  subscribeFontFamily,
} from "@/services/fontFamily";
import {
  checkLegacyOfflineCache,
  deleteLegacyOfflineCache,
} from "@/services/legacyCache";
import { runLegacyMigration } from "@/services/migration";
import { SnackbarPayload, subscribeSnackbar } from "@/services/snackbar";
import { resumePendingDownloadsAfterRestart } from "@/services/songCache";
import { layoutStyles } from "@/stylesheets";
import { APP_VERSION_CODE } from "@/utils/constants";
import { useMaterial3Theme } from "@pchmn/expo-material3-theme";

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [pendingLegacyCacheBytes, setPendingLegacyCacheBytes] = useState(0);
  const [showLegacyCacheModal, setShowLegacyCacheModal] = useState(false);
  const [snackbarPayload, setSnackbarPayload] =
    useState<SnackbarPayload | null>(null);
  const [fontFamily, setFontFamilyState] = useState(() => getFontFamily());
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  const needsInitialSyncRef = useRef(false);
  const legacyPromptShownRef = useRef(false);

  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const { theme } = useMaterial3Theme();

  useEffect(() => {
    return subscribeSnackbar((payload) => {
      setSnackbarPayload(payload);
    });
  }, []);

  useEffect(() => {
    return subscribeFontFamily((font) => {
      setFontFamilyState(font);
    });
  }, []);

  useEffect(() => {
    async function checkToken() {
      try {
        const serverUrl = await SecureStore.getItemAsync("serverUrl");
        const subsonicVersion =
          await SecureStore.getItemAsync("subsonicVersion");
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
        const lastSeen = await SecureStore.getItemAsync(
          "last_seen_version_code",
        );
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

  const isSyncRoute = (segments as string[]).includes("sync");

  useEffect(() => {
    if (isLoading) return;

    async function cleanupLegacyCache() {
      try {
        const [dismissed, savedClearedBytes, info] = await Promise.all([
          SecureStore.getItemAsync("legacy_cache_prompt_dismissed"),
          SecureStore.getItemAsync("legacy_cache_cleared_bytes"),
          checkLegacyOfflineCache(),
        ]);

        if (info.exists && info.sizeBytes > 0) {
          const res = await deleteLegacyOfflineCache();
          if (res.success) {
            await SecureStore.setItemAsync(
              "legacy_cache_cleared_bytes",
              String(info.sizeBytes),
            );
            if (dismissed !== "true") {
              setPendingLegacyCacheBytes(info.sizeBytes);
            }
          }
          return;
        }

        if (dismissed !== "true" && savedClearedBytes) {
          const parsedBytes = parseInt(savedClearedBytes, 10);
          if (!isNaN(parsedBytes) && parsedBytes > 0) {
            setPendingLegacyCacheBytes(parsedBytes);
          }
        }
      } catch (e) {
        console.error("failed to clean up legacy offline cache on launch:", e);
      }
    }

    cleanupLegacyCache();
  }, [isLoading]);

  useEffect(() => {
    if (
      isLoading ||
      isSyncRoute ||
      showWhatsNew ||
      pendingLegacyCacheBytes <= 0 ||
      legacyPromptShownRef.current
    ) {
      return;
    }

    legacyPromptShownRef.current = true;
    setShowLegacyCacheModal(true);
  }, [isLoading, isSyncRoute, showWhatsNew, pendingLegacyCacheBytes]);

  const handleDismissLegacyCacheModal = () => {
    setShowLegacyCacheModal(false);
    setPendingLegacyCacheBytes(0);
    SecureStore.setItemAsync("legacy_cache_prompt_dismissed", "true").catch(
      (e) => {
        console.error("failed to persist legacy cache dismissal:", e);
      },
    );
  };

  const paperTheme = useMemo(() => {
    const base =
      colorScheme === "dark"
        ? { ...MD3DarkTheme, colors: theme.dark }
        : { ...MD3LightTheme, colors: theme.light };
    return {
      ...base,
      fonts: buildPaperFonts(fontFamily, fontsLoaded),
    };
  }, [colorScheme, theme, fontFamily, fontsLoaded]);

  const isAuthRoute =
    (segments as string[]).includes("(auth)") ||
    (segments as string[]).includes("connect");
  const isQueueRoute = (segments as string[]).includes("queue");
  const routeMatchesAuth =
    (!isLoggedIn && isAuthRoute) || (isLoggedIn && !isAuthRoute);
  const showSpinner = isLoading || !routeMatchesAuth;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PaperProvider theme={paperTheme}>
          <PlayerOverlayProvider>
            <SafeAreaView
              style={layoutStyles.safeArea}
              edges={["top", "left", "right"]}
            >
              {showSpinner ? (
                <SafeAreaView
                  style={layoutStyles.container}
                  edges={["top", "left", "right"]}
                >
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
              <ExpandablePlayer
                visible={!showSpinner && !isAuthRoute && !isQueueRoute}
              />
              <ChangelogModal
                visible={showWhatsNew && !isSyncRoute}
                onDismiss={() => setShowWhatsNew(false)}
                title="what's new"
              />
              <LegacyOfflineDownloadsModal
                visible={showLegacyCacheModal && !isSyncRoute}
                sizeBytes={pendingLegacyCacheBytes}
                onDismiss={handleDismissLegacyCacheModal}
              />
              <Portal>
                <Snackbar
                  visible={!!snackbarPayload}
                  onDismiss={() => setSnackbarPayload(null)}
                  duration={snackbarPayload?.duration ?? 3000}
                  action={{
                    label: snackbarPayload?.actionLabel ?? "dismiss",
                    onPress: () => {
                      snackbarPayload?.onAction?.();
                      setSnackbarPayload(null);
                    },
                  }}
                >
                  {snackbarPayload?.message ?? ""}
                </Snackbar>
              </Portal>
            </SafeAreaView>
          </PlayerOverlayProvider>
        </PaperProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
