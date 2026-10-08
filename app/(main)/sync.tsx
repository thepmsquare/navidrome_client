import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, View } from "react-native";
import { Button, Icon, ProgressBar, Surface, Text } from "react-native-paper";

import {
  client_app_sync,
  isSyncInProgress,
  subscribeSyncState,
} from "@/services/api";
import { getLocalCounts, getSyncMeta } from "@/services/db";
import { useAppTheme } from "@/types";
import { spacing } from "@/utils/spacing";

type SyncPhase = "idle" | "syncing" | "done" | "error";

export default function SyncScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ initial?: string }>();
  const theme = useAppTheme();

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => getSyncMeta("lastSyncedAt") ?? null,
  );
  const [counts, setCounts] = useState(() => getLocalCounts());

  const [isFirstSync] = useState(
    () => params.initial === "true" || !getSyncMeta("lastSyncedAt"),
  );
  const [hasSyncedOnce, setHasSyncedOnce] = useState(
    () => !!getSyncMeta("lastSyncedAt"),
  );

  const [phase, setPhase] = useState<SyncPhase>(() =>
    isSyncInProgress() ? "syncing" : isFirstSync && !hasSyncedOnce ? "syncing" : "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // spinning icon animation
  const [spinAnim] = useState(() => new Animated.Value(0));
  const spinAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const startSpinning = useCallback(() => {
    spinAnim.setValue(0);
    spinAnimation.current = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinAnimation.current.start();
  }, [spinAnim]);

  const stopSpinning = useCallback(() => {
    spinAnimation.current?.stop();
    spinAnim.setValue(0);
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // subscribe to external sync state
  useEffect(() => {
    const unsubscribe = subscribeSyncState((isSyncing) => {
      if (isSyncing) {
        setPhase("syncing");
      } else {
        setCounts(getLocalCounts());
        setLastSyncedAt(getSyncMeta("lastSyncedAt") ?? null);
        setHasSyncedOnce(true);
        setPhase((prev) => (prev === "syncing" ? "done" : prev));
      }
    });
    return unsubscribe;
  }, []);

  // spin when syncing
  useEffect(() => {
    if (phase === "syncing") {
      startSpinning();
    } else {
      stopSpinning();
    }
  }, [phase, startSpinning, stopSpinning]);

  const runSync = useCallback(async (force: boolean = false) => {
    setPhase("syncing");
    setErrorMessage(null);
    try {
      const result = await client_app_sync(force);
      setCounts({
        artistCount: result.artistCount ?? 0,
        albumCount: result.albumCount ?? 0,
        songCount: result.songCount ?? 0,
        playlistCount: result.playlistCount ?? 0,
      });
      setLastSyncedAt(result.lastSyncedAt ?? null);
      setHasSyncedOnce(true);
      setPhase("done");
    } catch (e: any) {
      setErrorMessage(e?.message || "sync failed");
      setPhase("error");
    }
  }, []);

  // auto start sync only on first sync / initial setup after login
  useEffect(() => {
    if (!isFirstSync || hasSyncedOnce) return;

    let isMounted = true;
    client_app_sync(false)
      .then((result) => {
        if (!isMounted) return;
        setCounts({
          artistCount: result.artistCount ?? 0,
          albumCount: result.albumCount ?? 0,
          songCount: result.songCount ?? 0,
          playlistCount: result.playlistCount ?? 0,
        });
        setLastSyncedAt(result.lastSyncedAt ?? null);
        setHasSyncedOnce(true);
        setPhase("done");
      })
      .catch((e: any) => {
        if (!isMounted) return;
        setErrorMessage(e?.message || "sync failed");
        setPhase("error");
      });

    return () => {
      isMounted = false;
    };
  }, [isFirstSync, hasSyncedOnce]);

  function formatDate(iso: string | null): string {
    if (!iso) return "never";
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  const isSyncing = phase === "syncing";
  const canGoHome = hasSyncedOnce || phase === "done";

  let headingText = "library sync";
  if (phase === "syncing") {
    headingText = "syncing library...";
  } else if (phase === "done") {
    headingText = "sync complete";
  } else if (phase === "error") {
    headingText = "sync failed";
  }

  let subTitleText = lastSyncedAt
    ? `last synced: ${formatDate(lastSyncedAt)}`
    : "your library has not been synced yet.";
  if (isFirstSync && !hasSyncedOnce) {
    if (phase === "syncing" || phase === "idle") {
      subTitleText = "we are getting details for initial setup of the app.";
    } else if (phase === "error") {
      subTitleText = errorMessage ?? "something went wrong.";
    } else if (phase === "done") {
      subTitleText = `last synced: ${formatDate(lastSyncedAt)}`;
    }
  } else {
    if (phase === "syncing") {
      subTitleText =
        "fetching artists, albums, songs and playlists from your server.";
    } else if (phase === "done") {
      subTitleText = `last synced: ${formatDate(lastSyncedAt)}`;
    } else if (phase === "error") {
      subTitleText = errorMessage ?? "something went wrong.";
    }
  }

  return (
    <Surface style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.xl,
          gap: spacing.xl,
        }}
      >
        {/* icon */}
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Icon
            source={
              phase === "error"
                ? "alert-circle-outline"
                : phase === "done"
                  ? "check-circle-outline"
                  : "sync"
            }
            size={56}
            color={
              phase === "error"
                ? theme.colors.error
                : theme.colors.primary
            }
          />
        </Animated.View>

        {/* heading */}
        <View style={{ alignItems: "center", gap: spacing.xs }}>
          <Text variant="headlineSmall">{headingText}</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
          >
            {subTitleText}
          </Text>
        </View>

        {/* progress bar while syncing */}
        {isSyncing && (
          <View style={{ width: "100%" }}>
            <ProgressBar indeterminate color={theme.colors.primary} />
          </View>
        )}

        {/* counts surface */}
        <Surface
          elevation={1}
          style={{
            width: "100%",
            borderRadius: 16,
            padding: spacing.md,
            gap: spacing.sm,
            backgroundColor: theme.colors.surfaceContainerHighest,
          }}
        >
          <CountRow
            icon="account-music"
            label="artists"
            value={counts.artistCount}
          />
          <CountRow
            icon="album"
            label="albums"
            value={counts.albumCount}
          />
          <CountRow
            icon="music-note"
            label="songs"
            value={counts.songCount}
          />
          <CountRow
            icon="playlist-music"
            label="playlists"
            value={counts.playlistCount ?? 0}
          />
        </Surface>

        {/* action buttons */}
        <View style={{ width: "100%", gap: spacing.sm }}>
          <Button
            mode={canGoHome ? "contained" : "outlined"}
            icon="home"
            onPress={() => router.replace("/")}
            disabled={!canGoHome}
          >
            go to home
          </Button>

          <Button
            mode="outlined"
            icon="sync"
            onPress={() => runSync(false)}
            disabled={isSyncing}
            loading={isSyncing && hasSyncedOnce}
          >
            sync
          </Button>

          <Button
            mode="outlined"
            icon="refresh"
            onPress={() => runSync(true)}
            disabled={isSyncing}
          >
            force sync
          </Button>
        </View>
      </ScrollView>
    </Surface>
  );
}

function CountRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Icon source={icon} size={18} color={theme.colors.onSurfaceVariant} />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {label}
        </Text>
      </View>
      <Text variant="bodyMedium" style={{ fontWeight: "600" }}>
        {value.toLocaleString()}
      </Text>
    </View>
  );
}
