import React from "react";
import { View } from "react-native";
import { IconButton } from "react-native-paper";

import { SongRow, SongRowProps } from "@/components/SongRow";
import { playbackQueueStyles } from "@/stylesheets";
import { useAppTheme } from "@/types";

/**
 * PlaybackQueueSongRow specializes SongRow via TypeScript interface extension
 * and component composition (the idiomatic React pattern for OOP extension).
 */
export interface PlaybackQueueSongRowProps
  extends Omit<SongRowProps, "rightActions" | "showMoreButton"> {
  queueIndex?: number;
  isFirstUpcoming?: boolean;
  isLastUpcoming?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  isHistory?: boolean;
  onReplay?: () => void;
}

export function PlaybackQueueSongRow({
  queueIndex,
  isFirstUpcoming = false,
  isLastUpcoming = false,
  onMoveUp,
  onMoveDown,
  onRemove,
  isHistory = false,
  onReplay,
  style,
  ...songRowProps
}: PlaybackQueueSongRowProps) {
  const theme = useAppTheme();

  const rightActions = isHistory ? (
    <IconButton
      icon="replay"
      size={20}
      iconColor={theme.colors.onSurfaceVariant}
      accessibilityLabel="play again"
      style={playbackQueueStyles.actionButton}
      onPress={onReplay}
    />
  ) : (
    <View style={playbackQueueStyles.itemActions}>
      <IconButton
        icon="chevron-up"
        size={20}
        disabled={isFirstUpcoming}
        iconColor={
          isFirstUpcoming
            ? theme.colors.surfaceDisabled
            : theme.colors.onSurfaceVariant
        }
        accessibilityLabel="move up"
        style={playbackQueueStyles.actionButton}
        onPress={onMoveUp}
      />
      <IconButton
        icon="chevron-down"
        size={20}
        disabled={isLastUpcoming}
        iconColor={
          isLastUpcoming
            ? theme.colors.surfaceDisabled
            : theme.colors.onSurfaceVariant
        }
        accessibilityLabel="move down"
        style={playbackQueueStyles.actionButton}
        onPress={onMoveDown}
      />
      <IconButton
        icon="close"
        size={20}
        iconColor={theme.colors.error}
        accessibilityLabel="remove track"
        style={playbackQueueStyles.actionButton}
        onPress={onRemove}
      />
    </View>
  );

  return (
    <SongRow
      {...songRowProps}
      showMoreButton={false}
      showDuration={true}
      rightActions={rightActions}
      style={[isHistory && playbackQueueStyles.historySection, style]}
    />
  );
}
