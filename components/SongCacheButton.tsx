import { useEffect, useState } from "react";
import {
  Alert,
  GestureResponderEvent,
  Insets,
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import {
  Button,
  Chip,
  IconButton,
  Text,
  TouchableRipple,
} from "react-native-paper";

import { CircularProgressRing } from "@/components/CircularProgressRing";
import {
  clearAllRequestersForSong,
  getSongCacheEntry,
  removeFromDownloadQueue,
} from "@/services/db";
import { requestDownloadNotificationPermission } from "@/services/permissions";
import {
  cacheSongManually,
  cancelSongCaching,
  deleteSongFromCache,
  isSongCaching,
  notifyCacheQueueUpdated,
  subscribeSongCache,
  subscribeSongCacheProgress,
} from "@/services/songCache";
import { SongCacheRow, SongCacheType, useAppTheme } from "@/types";
import { spacing } from "@/utils/spacing";

export interface SongCacheButtonProps {
  songId?: string | null;
  /**
   * Mini mode toggle: if true, displays icon only.
   */
  mini?: boolean;
  /**
   * Display style: "button" shows icon + text, "icon" shows compact icon only, "chip" renders a Material Chip, "menu-item" renders a context menu row.
   * Defaults to "button" unless mini is true or showText is explicitly set to false.
   */
  variant?: "button" | "icon" | "chip" | "menu-item";
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
  /**
   * If true and in icon-only mode, hides the button when uncached (and not caching).
   */
  hideIfUncached?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  hitSlop?: Insets | number;
  onCacheSuccess?: (entry: SongCacheRow) => void;
  onCacheError?: (error: unknown) => void;
  onCacheCancelled?: () => void;
  onCacheRemoved?: () => void;
  /**
   * Optional callback invoked immediately when pressed (e.g. to dismiss a parent modal/menu).
   */
  onAction?: () => void;
}

export function SongCacheButton({
  songId,
  mini = false,
  variant = "button",
  showText = true,
  iconSize = 24,
  mode = "text",
  compact = true,
  hideIfUncached = false,
  initialEntry,
  style,
  contentStyle,
  labelStyle,
  hitSlop,
  onCacheSuccess,
  onCacheError,
  onCacheCancelled,
  onCacheRemoved,
  onAction,
}: SongCacheButtonProps) {
  const theme = useAppTheme();

  const [prevProps, setPrevProps] = useState({ songId, initialEntry });
  const [cacheEntry, setCacheEntry] = useState<SongCacheRow | null>(() =>
    initialEntry !== undefined
      ? initialEntry
      : songId
        ? getSongCacheEntry(songId)
        : null,
  );
  const [isCaching, setIsCaching] = useState(() =>
    songId ? (isSongCaching?.(songId) ?? false) : false,
  );
  const [cachingProgress, setCachingProgress] = useState(0);

  // Sync cache state when songId or initialEntry changes
  if (prevProps.songId !== songId || prevProps.initialEntry !== initialEntry) {
    setPrevProps({ songId, initialEntry });
    setCacheEntry(
      initialEntry !== undefined
        ? initialEntry
        : songId
          ? getSongCacheEntry(songId)
          : null,
    );
    setIsCaching(songId ? (isSongCaching?.(songId) ?? false) : false);
    setCachingProgress(0);
  }

  // Subscribe to cache updates and download progress
  useEffect(() => {
    if (!songId) return;

    const unsubscribeCache = subscribeSongCache(
      ({ songId: updatedId, entry }) => {
        if (updatedId === songId) {
          setCacheEntry(entry);
          setIsCaching(false);
          setCachingProgress(0);
        }
      },
    );

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
      "are you sure you want to cancel downloading this song?",
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
            removeFromDownloadQueue(songId);
            clearAllRequestersForSong(songId);
            notifyCacheQueueUpdated();
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
      "are you sure you want to remove this offline song?",
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

    onAction?.();

    if (isManual) {
      confirmRemoveFromCache();
      return;
    }

    if (isCaching) {
      confirmCancelDownload();
      return;
    }

    void requestDownloadNotificationPermission();

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
      ? "clock-outline"
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
    if (hideIfUncached && !isCaching && !cacheEntry) {
      return null;
    }

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
            color={theme.colors.tertiary}
            trackColor={theme.colors.surfaceContainerHighest}
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

  if (variant === "chip") {
    const isCached = isManual || isAuto;
    const chipText = isCaching
      ? cachingProgress < 0
        ? "downloading..."
        : `downloading... ${progressPercent}%`
      : isManual
        ? "available offline"
        : isAuto
          ? "temporarily available offline"
          : "make available offline";

    return (
      <Chip
        mode="flat"
        icon={
          isCaching
            ? () => (
                <CircularProgressRing
                  progress={cachingProgress}
                  size={16}
                  strokeWidth={2}
                  color={theme.colors.tertiary}
                  trackColor={theme.colors.surfaceContainerHighest}
                  showPercentage={false}
                />
              )
            : cacheIcon
        }
        selected={isCached}
        showSelectedOverlay={false}
        onPress={handlePress}
        style={[
          styles.chip,
          {
            backgroundColor: isCached
              ? theme.colors.secondaryContainer
              : theme.colors.surfaceContainerHighest,
          },
          style,
        ]}
        textStyle={[
          styles.label,
          {
            color: isCached
              ? theme.colors.onSecondaryContainer
              : theme.colors.onSurfaceVariant,
          },
          labelStyle,
        ]}
        accessibilityLabel={cacheText}
        hitSlop={hitSlop}
      >
        {chipText}
      </Chip>
    );
  }

  if (variant === "menu-item") {
    const isCached = isManual;
    const label = isCaching
      ? cachingProgress < 0
        ? "downloading..."
        : `downloading... ${progressPercent}%`
      : isCached
        ? "remove download"
        : isAuto
          ? "make available offline"
          : "download";

    const icon = isCaching
      ? "progress-download"
      : isCached
        ? "check-circle"
        : isAuto
          ? "clock-outline"
          : "download-outline";

    const iconColor = isCached
      ? theme.colors.primary
      : isCaching
        ? theme.colors.tertiary
        : theme.colors.onSurface;

    const textColor = isCached
      ? theme.colors.primary
      : isCaching
        ? theme.colors.tertiary
        : theme.colors.onSurface;

    return (
      <TouchableRipple
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.menuItem, style]}
      >
        <View style={styles.menuItemRow}>
          {isCaching ? (
            <View style={styles.menuProgressContainer}>
              <CircularProgressRing
                progress={cachingProgress}
                size={22}
                strokeWidth={2.5}
                color={theme.colors.tertiary}
                trackColor={theme.colors.surfaceContainerHighest}
                showPercentage={false}
              />
            </View>
          ) : (
            <IconButton
              icon={icon}
              size={iconSize}
              iconColor={iconColor}
              style={styles.menuIcon}
            />
          )}
          <Text
            variant="bodyLarge"
            style={[styles.menuLabel, { color: textColor }, labelStyle]}
          >
            {label}
          </Text>
        </View>
      </TouchableRipple>
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
                color={theme.colors.tertiary}
                trackColor={theme.colors.surfaceContainerHighest}
                showPercentage={false}
              />
            )
          : cacheIcon
      }
      textColor={isCaching ? theme.colors.tertiary : cacheColor}
      onPress={handlePress}
      style={[styles.button, style]}
      contentStyle={[styles.content, contentStyle]}
      labelStyle={[
        styles.label,
        { color: isCaching ? theme.colors.tertiary : cacheColor },
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
  chip: {
    height: 32,
    borderRadius: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    textTransform: "lowercase",
  },
  iconProgressContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  menuItem: {
    paddingVertical: 4,
    // paddingHorizontal: spacing.lg,
  },
  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    margin: 0,
    marginRight: spacing.md,
  },
  menuLabel: {
    fontWeight: "500",
  },
  menuProgressContainer: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
});

export default SongCacheButton;
