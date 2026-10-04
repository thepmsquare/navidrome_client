import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Modal,
  Portal,
  Text,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getCurrentLyricsLineIndex } from "@/services/lyrics";
import { seekToPosition } from "@/services/player";
import {
  AppTheme,
  NormalizedLyrics,
  NormalizedLyricsLine,
  useAppTheme,
} from "@/types";
import { spacing } from "@/utils/spacing";

interface LyricsSheetModalProps {
  visible: boolean;
  onDismiss: () => void;
  lyrics: NormalizedLyrics | null;
  isLoading?: boolean;
  positionSeconds?: number;
  songId?: string;
}

interface LyricLineRowProps {
  line: NormalizedLyricsLine;
  isActive: boolean;
  isSynced: boolean;
  onPress: (line: NormalizedLyricsLine) => void;
  theme: AppTheme;
}

const LyricLineRow = React.memo(function LyricLineRow({
  line,
  isActive,
  isSynced,
  onPress,
  theme,
}: LyricLineRowProps) {
  const isBlank = line.text.trim() === "";

  const [anim] = useState(() => new Animated.Value(isActive ? 1 : 0));

  useEffect(() => {
    if (!isSynced) return;
    Animated.timing(anim, {
      toValue: isActive ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isActive, isSynced, anim]);

  const opacity = useMemo(
    () =>
      anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.4, 1.0],
      }),
    [anim],
  );

  const scale = useMemo(
    () =>
      anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.96, 1.04],
      }),
    [anim],
  );

  if (isBlank) {
    return <View style={styles.blankLineSpacer} />;
  }

  if (!isSynced) {
    return (
      <View style={styles.linePadding}>
        <Text
          variant="bodyLarge"
          style={[styles.unsyncedLineText, { color: theme.colors.onSurface }]}
        >
          {line.text}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(line)}
      style={styles.linePressable}
      accessibilityRole="button"
      accessibilityLabel={`lyrics line: ${line.text}`}
    >
      <Animated.View
        style={[
          styles.syncedLineContainer,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <Text
          variant={isActive ? "titleMedium" : "bodyLarge"}
          style={[
            styles.syncedLineText,
            {
              color: isActive
                ? theme.colors.onSurface
                : theme.colors.onSurfaceVariant,
              fontWeight: isActive ? "700" : "500",
            },
          ]}
        >
          {line.text}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

export function LyricsSheetModal({
  visible,
  onDismiss,
  lyrics,
  isLoading = false,
  positionSeconds = 0,
  songId,
}: LyricsSheetModalProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<NormalizedLyricsLine>>(null);

  const [isAutoFollowPaused, setIsAutoFollowPaused] = useState<boolean>(false);

  // Resume auto-follow when song changes or sheet re-opens
  useEffect(() => {
    setIsAutoFollowPaused(false);
  }, [songId, visible]);

  // Purely derive active line index during render without cascading setState in effects
  const activeLineIndex = useMemo(() => {
    if (!lyrics?.synced || !lyrics.lines.length) {
      return -1;
    }
    return getCurrentLyricsLineIndex(
      lyrics.lines,
      positionSeconds * 1000,
      lyrics.offsetMs,
    );
  }, [lyrics, positionSeconds]);

  // On sheet open: jump (no animation) to current line
  useEffect(() => {
    if (visible && lyrics?.synced && activeLineIndex >= 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: activeLineIndex,
          viewPosition: 0.5,
          animated: false,
        });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [visible, lyrics?.synced, activeLineIndex]);

  // Animated auto-scroll while playing if auto-follow is active
  useEffect(() => {
    if (
      !visible ||
      !lyrics?.synced ||
      isAutoFollowPaused ||
      activeLineIndex < 0
    ) {
      return;
    }

    flatListRef.current?.scrollToIndex({
      index: activeLineIndex,
      viewPosition: 0.5,
      animated: true,
    });
  }, [activeLineIndex, isAutoFollowPaused, lyrics?.synced, visible]);

  const handleLinePress = useCallback(
    (line: NormalizedLyricsLine) => {
      if (typeof line.startMs !== "number") return;
      const offsetMs = lyrics?.offsetMs ?? 0;
      const targetSeconds = Math.max(0, (line.startMs - offsetMs) / 1000);
      seekToPosition(targetSeconds).catch((err) =>
        console.error("failed to seek to lyrics line:", err),
      );
      setIsAutoFollowPaused(false);
    },
    [lyrics?.offsetMs],
  );

  const handleJumpToCurrent = useCallback(() => {
    setIsAutoFollowPaused(false);
    if (activeLineIndex >= 0) {
      flatListRef.current?.scrollToIndex({
        index: activeLineIndex,
        viewPosition: 0.5,
        animated: true,
      });
    }
  }, [activeLineIndex]);

  const handleScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      flatListRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
      setTimeout(() => {
        if (
          flatListRef.current &&
          info.index >= 0 &&
          info.index < (lyrics?.lines?.length ?? 0)
        ) {
          flatListRef.current.scrollToIndex({
            index: info.index,
            viewPosition: 0.5,
            animated: true,
          });
        }
      }, 60);
    },
    [lyrics?.lines?.length],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: NormalizedLyricsLine; index: number }) => (
      <LyricLineRow
        line={item}
        isActive={lyrics?.synced ? index === activeLineIndex : false}
        isSynced={Boolean(lyrics?.synced)}
        onPress={handleLinePress}
        theme={theme}
      />
    ),
    [activeLineIndex, handleLinePress, lyrics?.synced, theme],
  );

  const keyExtractor = useCallback(
    (item: NormalizedLyricsLine, index: number) =>
      `${index}-${item.startMs ?? index}`,
    [],
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        style={styles.modalRoot}
        contentContainerStyle={[
          styles.sheetContainer,
          {
            backgroundColor: theme.colors.surfaceContainerLow,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.dragHandleContainer}>
          <View
            style={[
              styles.dragHandle,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text
            variant="titleMedium"
            style={[styles.headerTitle, { color: theme.colors.onSurface }]}
          >
            lyrics
          </Text>
          <IconButton
            icon="close"
            size={20}
            iconColor={theme.colors.onSurfaceVariant}
            accessibilityLabel="close lyrics"
            onPress={onDismiss}
            style={styles.closeButton}
          />
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text
              variant="bodyMedium"
              style={[
                styles.statusText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              loading lyrics...
            </Text>
          </View>
        ) : lyrics && lyrics.lines.length > 0 ? (
          <View style={styles.listWrapper}>
            <FlatList
              ref={flatListRef}
              data={lyrics.lines}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              extraData={lyrics.synced ? activeLineIndex : undefined}
              onScrollBeginDrag={() => {
                if (lyrics.synced) {
                  setIsAutoFollowPaused(true);
                }
              }}
              onScrollToIndexFailed={handleScrollToIndexFailed}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.listContent,
                {
                  paddingBottom:
                    Math.max(insets.bottom, spacing.md) +
                    (lyrics.synced && isAutoFollowPaused ? 56 : spacing.lg),
                },
              ]}
            />

            {/* Jump to current floating button */}
            {lyrics.synced && isAutoFollowPaused && activeLineIndex >= 0 && (
              <View
                style={[
                  styles.jumpButtonContainer,
                  {
                    bottom: Math.max(insets.bottom, spacing.md) + spacing.xs,
                  },
                ]}
              >
                <Button
                  mode="contained-tonal"
                  icon="arrow-down-circle-outline"
                  onPress={handleJumpToCurrent}
                  compact
                  style={[
                    styles.jumpButton,
                    { backgroundColor: theme.colors.secondaryContainer },
                  ]}
                  textColor={theme.colors.onSecondaryContainer}
                  accessibilityLabel="jump to current"
                >
                  jump to current
                </Button>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.centerContainer}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              no lyrics available
            </Text>
          </View>
        )}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    justifyContent: "flex-end",
    margin: 0,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "80%",
    minHeight: 320,
    paddingTop: spacing.xs,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerTitle: {
    fontWeight: "600",
  },
  closeButton: {
    margin: 0,
  },
  centerContainer: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statusText: {
    marginTop: spacing.xs,
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  linePadding: {
    paddingVertical: spacing.xs,
  },
  blankLineSpacer: {
    height: spacing.md,
  },
  linePressable: {
    paddingVertical: spacing.xs / 2,
  },
  syncedLineContainer: {
    paddingVertical: spacing.xs,
  },
  syncedLineText: {
    fontSize: 18,
    lineHeight: 28,
  },
  unsyncedLineText: {
    fontSize: 16,
    lineHeight: 26,
  },
  jumpButtonContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  jumpButton: {
    elevation: 3,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
  },
});
