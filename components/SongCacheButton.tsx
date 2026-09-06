import { useEffect, useState } from "react";
import {
  GestureResponderEvent,
  Insets,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from "react-native";
import { Button, IconButton, useTheme } from "react-native-paper";

import { getSongCacheEntry } from "@/services/db";
import {
  cacheSongManually,
  subscribeSongCache,
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
}: SongCacheButtonProps) {
  const theme = useTheme();

  const [prevSongId, setPrevSongId] = useState<string | undefined | null>(undefined);
  const [cacheEntry, setCacheEntry] = useState<SongCacheRow | null>(
    initialEntry ?? null,
  );
  const [isCaching, setIsCaching] = useState(false);

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
  }

  // Subscribe to cache updates broadcast across the app so all instances sync
  useEffect(() => {
    if (!songId) return;
    const unsubscribe = subscribeSongCache(({ songId: updatedId, entry }) => {
      if (updatedId === songId) {
        setCacheEntry(entry);
      }
    });
    return unsubscribe;
  }, [songId]);

  if (!songId) {
    return null;
  }

  const isManual = cacheEntry?.cacheType === SongCacheType.Manual;
  const isAuto = cacheEntry?.cacheType === SongCacheType.Auto;

  const handlePress = async (e?: GestureResponderEvent) => {
    // Stop propagation so parent List.Item / row press handlers aren't triggered
    e?.stopPropagation?.();

    if (!songId || isManual || isCaching) return;

    try {
      setIsCaching(true);
      await cacheSongManually(songId);
      const updated = getSongCacheEntry(songId);
      setCacheEntry(updated);
      if (updated) {
        onCacheSuccess?.(updated);
      }
    } catch (err) {
      console.error("failed to cache song manually:", err);
      onCacheError?.(err);
    } finally {
      setIsCaching(false);
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

  const cacheText = isManual
    ? "available offline"
    : isAuto
      ? "temporarily available offline"
      : "make available offline";

  const isIconOnly = mini || variant === "icon" || showText === false;

  if (isIconOnly) {
    return (
      <IconButton
        icon={cacheIcon}
        iconColor={cacheColor}
        size={iconSize}
        style={style}
        hitSlop={hitSlop}
        disabled={isCaching}
        accessibilityLabel={cacheText}
        onPress={isManual ? undefined : handlePress}
      />
    );
  }

  return (
    <Button
      mode={mode}
      compact={compact}
      icon={cacheIcon}
      textColor={cacheColor}
      loading={isCaching}
      disabled={isCaching}
      onPress={isManual ? undefined : handlePress}
      style={[styles.button, style]}
      contentStyle={[styles.content, contentStyle]}
      labelStyle={[styles.label, { color: cacheColor }, labelStyle]}
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
});

export default SongCacheButton;
