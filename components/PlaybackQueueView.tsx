import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  View,
} from "react-native";
import {
  Appbar,
  Avatar,
  Button,
  IconButton,
  Surface,
  Text,
} from "react-native-paper";

import { PlaybackQueueSongRow } from "@/components/PlaybackQueueSongRow";
import { getCoverArtBaseUrl } from "@/services/api";
import {
  clearQueue,
  moveQueueItem,
  playTrackAtIndex,
  removeFromQueue,
  togglePlayback,
  usePlaybackQueue,
  usePlayerState,
} from "@/services/player";
import { playbackQueueStyles } from "@/stylesheets";
import { Child, useAppTheme } from "@/types";

interface PlaybackQueueViewProps {
  onBack?: () => void;
  showBackAction?: boolean;
  onTrackSelected?: (index: number) => void;
}

export function PlaybackQueueView({
  onBack,
  showBackAction = true,
  onTrackSelected,
}: PlaybackQueueViewProps) {
  const theme = useAppTheme();
  const { queue, currentIndex } = usePlaybackQueue();
  const { isPlaying, currentTrack } = usePlayerState();
  const [showHistory, setShowHistory] = useState(false);
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null, size?: number) => string | null) | null
  >(null);

  useEffect(() => {
    let isMounted = true;
    getCoverArtBaseUrl().then((fn) => {
      if (isMounted) setGetArtUrl(() => fn);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const historySongs = useMemo(() => {
    if (currentIndex <= 0) return [];
    return queue.slice(0, currentIndex).map((song, idx) => ({
      song,
      originalIndex: idx,
    }));
  }, [queue, currentIndex]);

  const activeSong = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < queue.length) {
      return queue[currentIndex];
    }
    return null;
  }, [queue, currentIndex]);

  const upcomingSongs = useMemo(() => {
    if (currentIndex >= queue.length - 1) return [];
    return queue.slice(currentIndex + 1).map((song, idx) => ({
      song,
      originalIndex: currentIndex + 1 + idx,
    }));
  }, [queue, currentIndex]);

  const totalRemainingSeconds = useMemo(() => {
    return upcomingSongs.reduce((acc, curr) => acc + (curr.song.duration || 0), 0);
  }, [upcomingSongs]);

  const statsText = useMemo(() => {
    if (upcomingSongs.length === 0) return "";
    const countStr = `${upcomingSongs.length} song${upcomingSongs.length === 1 ? "" : "s"}`;
    if (totalRemainingSeconds > 0) {
      const minutes = Math.ceil(totalRemainingSeconds / 60);
      return `${countStr} • ${minutes}m`;
    }
    return countStr;
  }, [upcomingSongs.length, totalRemainingSeconds]);

  const handleClearQueue = useCallback(() => {
    Alert.alert(
      "clear queue",
      "are you sure you want to clear upcoming tracks from the queue?",
      [
        { text: "cancel", style: "cancel" },
        {
          text: "clear",
          style: "destructive",
          onPress: () => clearQueue(),
        },
      ],
    );
  }, []);

  const handleTrackPress = useCallback(
    (index: number) => {
      playTrackAtIndex(index);
      onTrackSelected?.(index);
    },
    [onTrackSelected],
  );

  const renderNowPlaying = () => {
    if (!activeSong && !currentTrack) return null;
    const title = activeSong?.title || currentTrack?.title || "unknown track";
    const artist = activeSong?.artist || currentTrack?.artist || "unknown artist";
    const coverArt = activeSong?.coverArt || currentTrack?.coverArt;
    const artUrl = getArtUrl && coverArt ? getArtUrl(coverArt, 120) : null;

    return (
      <View style={playbackQueueStyles.nowPlayingSection}>
        <Text
          variant="labelMedium"
          style={[
            playbackQueueStyles.sectionTitle,
            { color: theme.colors.primary },
          ]}
        >
          now playing
        </Text>
        <Surface
          elevation={1}
          style={[
            playbackQueueStyles.nowPlayingCard,
            { backgroundColor: theme.colors.surfaceContainerHigh },
          ]}
        >
          {artUrl ? (
            <Image
              source={{ uri: artUrl }}
              style={playbackQueueStyles.nowPlayingArt}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View
              style={[
                playbackQueueStyles.nowPlayingArtPlaceholder,
                { backgroundColor: theme.colors.surfaceContainerHighest },
              ]}
            >
              <Avatar.Icon
                size={32}
                icon="music"
                style={{ backgroundColor: "transparent" }}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          )}

          <View style={playbackQueueStyles.nowPlayingMeta}>
            <Text
              variant="bodyLarge"
              numberOfLines={1}
              style={[
                playbackQueueStyles.nowPlayingTitle,
                { color: theme.colors.onSurface },
              ]}
            >
              {title}
            </Text>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={[
                playbackQueueStyles.nowPlayingArtist,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {artist}
            </Text>
          </View>

          <IconButton
            icon={isPlaying ? "pause" : "play"}
            size={24}
            iconColor={theme.colors.primary}
            accessibilityLabel={isPlaying ? "pause" : "play"}
            onPress={() => togglePlayback()}
          />
        </Surface>
      </View>
    );
  };

  const renderHistory = () => {
    if (historySongs.length === 0) return null;

    return (
      <View style={playbackQueueStyles.historySection}>
        <Pressable
          onPress={() => setShowHistory((prev) => !prev)}
          style={playbackQueueStyles.historyHeaderRow}
          accessibilityRole="button"
          accessibilityLabel={`history, ${historySongs.length} songs`}
        >
          <Text
            variant="labelMedium"
            style={[
              playbackQueueStyles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {`history (${historySongs.length})`}
          </Text>
          <IconButton
            icon={showHistory ? "chevron-up" : "chevron-down"}
            size={20}
            iconColor={theme.colors.onSurfaceVariant}
            style={playbackQueueStyles.actionButton}
          />
        </Pressable>

        {showHistory &&
          historySongs.map(({ song, originalIndex }) => (
            <PlaybackQueueSongRow
              key={`history-${song.id}-${originalIndex}`}
              song={song}
              isHistory={true}
              getArtUrl={getArtUrl}
              onPress={() => handleTrackPress(originalIndex)}
              onReplay={() => handleTrackPress(originalIndex)}
            />
          ))}
      </View>
    );
  };

  const renderUpNextItem = ({
    item,
    index,
  }: {
    item: { song: Child; originalIndex: number };
    index: number;
  }) => {
    const { song, originalIndex } = item;
    const isFirstUpcoming = index === 0;
    const isLastUpcoming = index === upcomingSongs.length - 1;

    return (
      <PlaybackQueueSongRow
        song={song}
        queueIndex={index}
        isFirstUpcoming={isFirstUpcoming}
        isLastUpcoming={isLastUpcoming}
        getArtUrl={getArtUrl}
        onPress={() => handleTrackPress(originalIndex)}
        onMoveUp={() => moveQueueItem(originalIndex, originalIndex - 1)}
        onMoveDown={() => moveQueueItem(originalIndex, originalIndex + 1)}
        onRemove={() => removeFromQueue(originalIndex)}
      />
    );
  };

  const renderHeader = () => (
    <View>
      {renderHistory()}
      {renderNowPlaying()}

      <View style={playbackQueueStyles.sectionHeaderRow}>
        <Text
          variant="labelMedium"
          style={[
            playbackQueueStyles.sectionTitle,
            { color: theme.colors.primary },
          ]}
        >
          {`up next (${upcomingSongs.length})`}
        </Text>

        <View style={playbackQueueStyles.sectionHeaderRight}>
          {upcomingSongs.length > 0 && (
            <Button
              mode="text"
              compact
              textColor={theme.colors.error}
              onPress={handleClearQueue}
            >
              clear
            </Button>
          )}
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={playbackQueueStyles.emptyContainer}>
      <Avatar.Icon
        size={56}
        icon="playlist-music-outline"
        style={{ backgroundColor: theme.colors.surfaceContainerHighest }}
        color={theme.colors.onSurfaceVariant}
      />
      <Text
        variant="titleMedium"
        style={[
          playbackQueueStyles.emptyText,
          { color: theme.colors.onSurface },
        ]}
      >
        no upcoming tracks
      </Text>
      <Text
        variant="bodySmall"
        style={[
          playbackQueueStyles.emptySubtext,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        tracks added to your queue will show up here
      </Text>
    </View>
  );

  return (
    <Surface
      style={[
        playbackQueueStyles.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Appbar.Header
        statusBarHeight={0}
        style={playbackQueueStyles.header}
      >
        {showBackAction && onBack ? (
          <Appbar.BackAction
            accessibilityLabel="back to player"
            onPress={onBack}
          />
        ) : null}
        <Appbar.Content title="playback queue" />
        {statsText ? (
          <Text
            variant="labelSmall"
            style={[
              playbackQueueStyles.headerStatsText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {statsText}
          </Text>
        ) : null}
      </Appbar.Header>

      <FlatList
        data={upcomingSongs}
        keyExtractor={(item) => `upcoming-${item.song.id}-${item.originalIndex}`}
        renderItem={renderUpNextItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={playbackQueueStyles.listContent}
      />
    </Surface>
  );
}
