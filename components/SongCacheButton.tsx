import { useEffect, useState } from "react";
import {
  Alert,
  GestureResponderEvent,
  Insets,
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from "react-native";
import { Button, IconButton, useTheme } from "react-native-paper";

import { CircularProgressRing } from "@/components/CircularProgressRing";
import { getSongCacheEntry } from "@/services/db";
import {
  cacheSongManually,
  cancelSongCaching,
  deleteSongFromCache,
  subscribeSongCache,
  subscribeSongCacheProgress,
} from "@/services/songCache";
import { SongCacheRow, SongCacheType } from "@/types";

export interface SongCacheButtonProps {
  songId?: string | null;
  /**
   * Mini mode toggle: if true, displays icon only.
   */
  mini?: boolean;
  /**
   * Display style: "button" shows icon + text, "icon" shows compact icon only.
   * Defaults to "button" unless mini is true or showText is explicitly set to false.
   */
  variant?: "button" | "icon";
  /**
   * Toggle: if false, displays icon only.
   */
  showText?: boolean;
  /**
   * Icon size when in mini/icon variant (defaults to 24).
   */
  iconSize?: number;
  /**
   * Button mode when in button variant (defaults to "text").
   */
  mode?: "text" | "outlined" | "contained" | "elevated" | "contained-tonal";
  compact?: boolean;
  /**
   * Optional preloaded cache entry (e.g. from batch queries in flat lists).
   */
  initialEntry?: SongCacheRow | null;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  hitSlop?: Insets | number;
  onCacheSuccess?: (entry: SongCacheRow) => void;
  onCacheError?: (error: unknown) => void;
  onCacheCancelled?: () => void;
  onCacheRemoved?: () => void;
}

export function SongCacheButton({
  songId,
  mini = false,
  variant = "button",
  showText = true,
  iconSize = 24,
  mode = "text",
  compact = true,
  initialEntry,
  style,
  contentStyle,
  labelStyle,
  hitSlop,
  onCacheSuccess,
  onCacheError,
  onCacheCancelled,
  onCacheRemoved,
}: SongCacheButtonProps) {
  const theme = useTheme();

  const [prevSongId, setPrevSongId] = useState<string | undefined | null>(undefined);
  const [cacheEntry, setCacheEntry] = useState<SongCacheRow | null>(
    initialEntry ?? null,
  );
  const [isCaching, setIsCaching] = useState(false);
  const [cachingProgress, setCachingProgress] = useState(0);

  // Sync cache state when songId changes or on initial load
  if (songId !== prevSongId) {
    setPrevSongId(songId);
    setCacheEntry(
      initialEntry !== undefined
        ? initialEntry
        : songId
          ? getSongCacheEntry(songId)
          : null,
    );
    setIsCaching(false);
    setCachingProgress(0);
  }

  // Subscribe to cache updates and progress broadcast across the app
  useEffect(() => {
    if (!songId) return;

    const unsubscribeCache = subscribeSongCache(({ songId: updatedId, entry }) => {
      if (updatedId === songId) {
        setCacheEntry(entry);
        setIsCaching(false);
        setCachingProgress(0);
      }
    });

    const unsubscribeProgress = subscribeSongCacheProgress(
      ({ songId: progressId, progress }) => {
        if (progressId === songId) {
          setIsCaching(true);
          setCachingProgress(progress);
        }
      },
    );

    return () => {
      unsubscribeCache();
      unsubscribeProgress();
    };
  }, [songId]);

  if (!songId) {
    return null;
  }

  const isManual = cacheEntry?.cacheType === SongCacheType.Manual;
  const isAuto = cacheEntry?.cacheType === SongCacheType.Auto;

  const confirmCancelDownload = () => {
    Alert.alert(
      "cancel download",
      "are you sure you want to cancel caching this song?",
      [
        {
          text: "no",
          style: "cancel",
        },
        {
          text: "yes",
          style: "destructive",
          onPress: () => {
            cancelSongCaching(songId);
            setIsCaching(false);
            setCachingProgress(0);
            onCacheCancelled?.();
          },
        },
      ],
    );
  };

  const confirmRemoveFromCache = () => {
    Alert.alert(
      "remove offline song",
      "are you sure you want to remove this song from offline cache?",
      [
        {
          text: "no",
          style: "cancel",
        },
        {
          text: "yes",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSongFromCache(songId);
              setCacheEntry(null);
              onCacheRemoved?.();
            } catch (err) {
              console.error("failed to remove song from cache:", err);
            }
          },
        },
      ],
    );
  };

  const handlePress = async (e?: GestureResponderEvent) => {
    // Stop propagation so parent List.Item / row press handlers aren't triggered
    e?.stopPropagation?.();

    if (!songId) return;

    if (isManual) {
      confirmRemoveFromCache();
      return;
    }

    if (isCaching) {
      confirmCancelDownload();
      return;
    }

    try {
      setIsCaching(true);
      setCachingProgress(0);
      await cacheSongManually(songId, (p) => {
        setCachingProgress(p);
      });
      const updated = getSongCacheEntry(songId);
      setCacheEntry(updated);
      if (updated) {
        onCacheSuccess?.(updated);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        // User cancelled, ignore logging error
        return;
      }
      console.error("failed to cache song manually:", err);
      onCacheError?.(err);
    } finally {
      setIsCaching(false);
      setCachingProgress(0);
    }
  };

  const cacheIcon = isManual
    ? "check-circle"
    : isAuto
      ? "cached"
      : "download-outline";

  const cacheColor = isManual
    ? theme.colors.primary
    : isAuto
      ? theme.colors.tertiary
      : theme.colors.outline;

  const progressPercent = Math.round(
    cachingProgress < 0 ? 0 : Math.min(1, Math.max(0, cachingProgress)) * 100,
  );

  const cacheText = isCaching
    ? cachingProgress < 0
      ? "downloading..."
      : `downloading... ${progressPercent}%`
    : isManual
      ? "available offline"
      : isAuto
        ? "temporarily available offline"
        : "make available offline";

  const isIconOnly = mini || variant === "icon" || showText === false;

  const progressRingSize = Math.max(22, iconSize + 2);

  if (isIconOnly) {
    if (isCaching) {
      return (
        <Pressable
          style={[
            styles.iconProgressContainer,
            { width: progressRingSize + 12, height: progressRingSize + 12 },
            style,
          ]}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="cancel download"
          onPress={handlePress}
        >
          <CircularProgressRing
            progress={cachingProgress}
            size={progressRingSize}
            strokeWidth={2.5}
            color={theme.colors.primary}
            trackColor={theme.colors.surfaceVariant ?? "rgba(128, 128, 128, 0.25)"}
            showPercentage
          />
        </Pressable>
      );
    }

    return (
      <IconButton
        icon={cacheIcon}
        iconColor={cacheColor}
        size={iconSize}
        style={style}
        hitSlop={hitSlop}
        accessibilityLabel={cacheText}
        onPress={handlePress}
      />
    );
  }

  return (
    <Button
      mode={mode}
      compact={compact}
      icon={
        isCaching
          ? () => (
              <CircularProgressRing
                progress={cachingProgress}
                size={20}
                strokeWidth={2}
                color={theme.colors.primary}
                trackColor={
                  theme.colors.surfaceVariant ?? "rgba(128, 128, 128, 0.25)"
                }
                showPercentage={false}
              />
            )
          : cacheIcon
      }
      textColor={isCaching ? theme.colors.primary : cacheColor}
      onPress={handlePress}
      style={[styles.button, style]}
      contentStyle={[styles.content, contentStyle]}
      labelStyle={[
        styles.label,
        { color: isCaching ? theme.colors.primary : cacheColor },
        labelStyle,
      ]}
      accessibilityLabel={cacheText}
      hitSlop={hitSlop}
    >
      {cacheText}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: -8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    textTransform: "lowercase",
    fontSize: 13,
  },
  iconProgressContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SongCacheButton;
