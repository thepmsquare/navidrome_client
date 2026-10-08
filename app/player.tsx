import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  GestureResponderEvent,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Chip,
  IconButton,
  Menu,
  ProgressBar,
  Snackbar,
  Surface,
  Text,
} from "react-native-paper";

// Import the new component
import { LyricsSheetModal } from "@/components/LyricsSheetModal";
import { ModalArtViewer } from "@/components/ModalArtViewer";
import { SleepTimerModal } from "@/components/SleepTimerModal";
import { SongCacheButton } from "@/components/SongCacheButton";
import { SongSaveButton } from "@/components/SongSaveButton";
import { getCoverArtBaseUrl } from "@/services/api";
import {
  getCachedLyricsSync,
  getLyricsMode,
  resolveLyricsForSong,
  subscribeLyricsMode,
} from "@/services/lyrics";
import {
  cycleRepeatMode,
  playNext,
  playPrevious,
  seekToPosition,
  setRatingCurrentTrack,
  togglePlayback,
  toggleShuffle,
  toggleStarCurrentTrack,
  usePlayerState,
} from "@/services/player";
import { useSleepTimer } from "@/services/sleepTimer";
import { playerStyles } from "@/stylesheets";
import {
  LyricsMode,
  LyricsTrackMetadata,
  NormalizedLyrics,
  useAppTheme,
} from "@/types";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const totalSecs = Math.floor(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function PlayerScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const playerState = usePlayerState();
  const sleepTimerState = useSleepTimer();
  const [sleepTimerModalVisible, setSleepTimerModalVisible] = useState(false);
  const [ratingMenuVisible, setRatingMenuVisible] = useState(false);
  const [progressBarWidth, setProgressBarWidth] = useState<number>(0);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null, size?: number) => string | null) | null
  >(null);
  // State for the full-screen art modal
  const [isArtModalVisible, setIsArtModalVisible] = useState(false);
  const [artUrlForModal, setArtUrlForModal] = useState<string | null>(null);
  // Lyrics state
  const [lyricsMode, setLyricsModeState] = useState<LyricsMode>(() =>
    getLyricsMode(),
  );
  const [lyricsModalVisible, setLyricsModalVisible] = useState(false);
  const [lyrics, setLyrics] = useState<NormalizedLyrics | null>(() => {
    const initialSongId = playerState.currentTrack?.id;
    return initialSongId
      ? getCachedLyricsSync(initialSongId, getLyricsMode())
      : null;
  });
  const [lyricsLoading, setLyricsLoading] = useState(() => {
    const initialSongId = playerState.currentTrack?.id;
    return (
      Boolean(initialSongId) &&
      !getCachedLyricsSync(initialSongId, getLyricsMode())
    );
  });

  useEffect(() => {
    return subscribeLyricsMode((mode) => {
      setLyricsModeState(mode);
    });
  }, []);

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  useEffect(() => {
    let isMounted = true;
    getCoverArtBaseUrl(600)
      .then((fn) => {
        if (isMounted) setGetArtUrl(() => fn);
      })
      .catch((err) =>
        console.error(
          "failed to get cover art url helper in player screen:",
          err,
        ),
      );
    return () => {
      isMounted = false;
    };
  }, []);

  const {
    currentTrack,
    isPlaying,
    isBuffering,
    position,
    duration,
    repeatMode,
    shuffle,
    hasPrevious,
    hasNext,
    isPlayingFromCache,
  } = playerState;

  const songId = currentTrack?.id;

  const [prevLyricsTracking, setPrevLyricsTracking] = useState({
    songId,
    lyricsMode,
  });

  // Sync lyrics state immediately when track or lyrics mode changes
  if (
    prevLyricsTracking.songId !== songId ||
    prevLyricsTracking.lyricsMode !== lyricsMode
  ) {
    setPrevLyricsTracking({ songId, lyricsMode });
    const cached = songId ? getCachedLyricsSync(songId, lyricsMode) : null;
    setLyrics(cached);
    setLyricsLoading(Boolean(songId && !cached));
  }

  useEffect(() => {
    if (!songId) {
      return;
    }

    let isCancelled = false;
    const currentMode = lyricsMode;
    const currentSongId = songId;

    // Prefer track's own duration over playerState.duration which may be 0 initially
    const reliableDuration =
      typeof currentTrack?.duration === "number" && currentTrack.duration > 0
        ? currentTrack.duration
        : typeof duration === "number" && duration > 0
          ? duration
          : undefined;

    const trackMeta: LyricsTrackMetadata = {
      title: currentTrack?.title ?? "",
      artist: currentTrack?.artist,
      album: currentTrack?.album,
      duration: reliableDuration,
    };

    resolveLyricsForSong(songId, trackMeta, {
      mode: currentMode,
      onUpgrade: (upgraded) => {
        if (
          !isCancelled &&
          songId === currentSongId &&
          lyricsMode === currentMode
        ) {
          setLyrics(upgraded);
        }
      },
    })
      .then((res) => {
        if (
          !isCancelled &&
          songId === currentSongId &&
          lyricsMode === currentMode
        ) {
          setLyrics(res);
        }
      })
      .catch(() => {
        if (
          !isCancelled &&
          songId === currentSongId &&
          lyricsMode === currentMode
        ) {
          setLyrics(null);
        }
      })
      .finally(() => {
        if (
          !isCancelled &&
          songId === currentSongId &&
          lyricsMode === currentMode
        ) {
          setLyricsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    songId,
    lyricsMode,
    currentTrack?.title,
    currentTrack?.artist,
    currentTrack?.album,
    currentTrack?.duration,
    duration,
  ]);

  const hasLyrics = Boolean(lyrics && lyrics.lines && lyrics.lines.length > 0);

  const isStarred = !!currentTrack?.starred;
  const currentRating = currentTrack?.userRating ?? 0;

  const handleToggleStar = async () => {
    try {
      const nowStarred = await toggleStarCurrentTrack();
      showSnackbar(
        nowStarred ? "added to favorites" : "removed from favorites",
      );
    } catch {
      showSnackbar("failed to update favorite");
    }
  };

  const handleSetRating = async (ratingVal: number) => {
    try {
      await setRatingCurrentTrack(ratingVal);
    } catch {
      showSnackbar("failed to update rating");
    }
  };

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(Math.max(position / duration, 0), 1);
  }, [position, duration]);

  const handleSeek = (event: GestureResponderEvent) => {
    if (!duration || duration <= 0 || progressBarWidth <= 0) return;
    const touchX = event.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, touchX / progressBarWidth));
    const targetSecs = Math.round(ratio * duration);
    seekToPosition(targetSecs).catch((err) =>
      console.error("failed to seek position:", err),
    );
  };

  // Handler for clicking the album art
  const handleArtPress = () => {
    if (currentTrack && currentTrack.coverArt) {
      // Check if getArtUrl is available before calling it
      if (getArtUrl) {
        const url = getArtUrl(currentTrack.coverArt, 1080); // Use a high resolution for modal view
        setArtUrlForModal(url);
        setIsArtModalVisible(true);
      } else {
        // Fallback if URL helper isn't ready yet
        console.warn("getArtUrl is not available yet.");
        setArtUrlForModal(null);
        setIsArtModalVisible(true);
      }
    } else {
      // Handle case where no art is available (e.g., show default placeholder)
      setArtUrlForModal(null);
      setIsArtModalVisible(true); // Still open the modal, but it will show a fallback/placeholder
    }
  };

  const repeatIcon =
    repeatMode === "one"
      ? "repeat-once"
      : repeatMode === "all"
        ? "repeat"
        : "repeat-off";

  const isRepeatActive = repeatMode !== "off";
  const repeatContainerColor = isRepeatActive
    ? theme.colors.primaryContainer
    : theme.colors.surfaceContainerHighest;
  const repeatColor = isRepeatActive
    ? theme.colors.onPrimaryContainer
    : theme.colors.outline;

  const repeatLabel =
    repeatMode === "one"
      ? "repeat one"
      : repeatMode === "all"
        ? "repeat all"
        : "repeat off";

  const shuffleIcon = "shuffle-variant";
  const shuffleContainerColor = shuffle
    ? theme.colors.primaryContainer
    : theme.colors.surfaceContainerHighest;
  const shuffleColor = shuffle
    ? theme.colors.onPrimaryContainer
    : theme.colors.outline;
  const shuffleLabel = shuffle ? "shuffle on" : "shuffle off";

  const handleToggleShuffle = async () => {
    try {
      Haptics.selectionAsync().catch(() => {});
      await toggleShuffle();
    } catch {
      showSnackbar("failed to toggle shuffle");
    }
  };

  const handleCycleRepeat = async () => {
    try {
      Haptics.selectionAsync().catch(() => {});
      await cycleRepeatMode();
    } catch (err) {
      console.error("failed to cycle repeat mode:", err);
    }
  };

  const handleTogglePlayback = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await togglePlayback();
    } catch (err) {
      console.error("failed to toggle playback:", err);
    }
  };

  const handlePlayPrevious = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await playPrevious();
    } catch (err) {
      console.error("failed to play previous track:", err);
    }
  };

  const handlePlayNext = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await playNext();
    } catch (err) {
      console.error("failed to play next track:", err);
    }
  };

  if (!currentTrack) {
    return (
      <View
        style={[
          playerStyles.container,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Appbar.Header statusBarHeight={0} style={playerStyles.header}>
          <Appbar.BackAction
            accessibilityLabel="close player"
            onPress={() => router.back()}
          />
          <Appbar.Content title="now playing" />
        </Appbar.Header>

        <View style={playerStyles.emptyContainer}>
          <Avatar.Icon
            size={96}
            icon="music-off"
            style={{ backgroundColor: theme.colors.surfaceContainerHighest }}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="headlineSmall"
            style={[
              playerStyles.emptyText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            no track playing
          </Text>
          <IconButton
            icon="arrow-left"
            mode="contained"
            size={24}
            accessibilityLabel="close player"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  const artUrl =
    getArtUrl && currentTrack.coverArt
      ? getArtUrl(currentTrack.coverArt, 600)
      : null;

  return (
    <View
      style={[
        playerStyles.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      {/* Header with Appbar */}
      <Appbar.Header statusBarHeight={0} style={playerStyles.header}>
        <Appbar.BackAction
          accessibilityLabel="close player"
          onPress={() => router.back()}
        />
        <Appbar.Content title="now playing" />
      </Appbar.Header>

      {/* Large Album Artwork (Clickable Area) */}
      <Pressable onPress={handleArtPress} style={playerStyles.artContainer}>
        {/* Fixed: Removed functional style callback using currentStyles */}
        {artUrl ? (
          <Image
            source={{
              uri: artUrl,
              cacheKey: `${currentTrack.coverArt}-600`,
            }}
            style={playerStyles.artwork}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={[
              playerStyles.artworkPlaceholder,
              { backgroundColor: theme.colors.surfaceContainerHighest },
            ]}
          >
            <Avatar.Icon
              size={120}
              icon="music"
              style={{ backgroundColor: theme.colors.secondaryContainer }}
              color={theme.colors.onSecondaryContainer}
            />
          </View>
        )}
      </Pressable>

      {/* Song Name, Artist, Album Name, and Favorite Heart */}
      <View style={playerStyles.infoContainer}>
        <View style={playerStyles.titleRow}>
          <View style={playerStyles.titleTextContainer}>
            <Text
              variant="headlineSmall"
              numberOfLines={2}
              ellipsizeMode="tail"
              style={[playerStyles.title, { color: theme.colors.onSurface }]}
            >
              {currentTrack.title || "unknown track"}
            </Text>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                playerStyles.artist,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {currentTrack.artist || "unknown artist"}
            </Text>
            {currentTrack.album ? (
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  playerStyles.album,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {currentTrack.album}
              </Text>
            ) : null}
          </View>

          <IconButton
            icon={isStarred ? "heart" : "heart-outline"}
            size={28}
            iconColor={
              isStarred ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
            accessibilityLabel={isStarred ? "unstar song" : "star song"}
            style={playerStyles.heartButton}
            onPress={handleToggleStar}
          />
        </View>

        {/* Horizontally Scrollable Utility Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={playerStyles.chipsScrollView}
          contentContainerStyle={playerStyles.chipsScrollContent}
        >
          {/* Rating Chip + Contextual Popover Menu */}
          <Menu
            visible={ratingMenuVisible}
            onDismiss={() => setRatingMenuVisible(false)}
            anchor={
              <Chip
                mode="flat"
                icon={currentRating > 0 ? "star" : "star-outline"}
                style={[
                  playerStyles.controlChip,
                  {
                    backgroundColor:
                      currentRating > 0
                        ? theme.colors.secondaryContainer
                        : theme.colors.surfaceContainerHighest,
                  },
                ]}
                textStyle={{
                  color:
                    currentRating > 0
                      ? theme.colors.onSecondaryContainer
                      : theme.colors.onSurfaceVariant,
                  fontSize: 12,
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  currentRating > 0
                    ? `rating: ${currentRating} stars`
                    : "rate song"
                }
                onPress={() => setRatingMenuVisible(true)}
              >
                {currentRating > 0 ? `${currentRating}` : "rate"}
              </Chip>
            }
            contentStyle={[
              playerStyles.ratingMenuContent,
              { backgroundColor: theme.colors.surfaceContainerHigh },
            ]}
          >
            <Text
              variant="labelMedium"
              style={[
                playerStyles.ratingMenuTitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {currentRating > 0
                ? `rating: ${currentRating} / 5`
                : "rate this song"}
            </Text>
            <View
              style={playerStyles.ratingMenuStarsRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="song rating"
            >
              {[1, 2, 3, 4, 5].map((starVal) => {
                const isFilled = currentRating >= starVal;
                return (
                  <IconButton
                    key={starVal}
                    icon={isFilled ? "star" : "star-outline"}
                    size={28}
                    iconColor={
                      isFilled ? theme.colors.primary : theme.colors.outline
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isFilled }}
                    accessibilityLabel={`rate ${starVal} star${starVal > 1 ? "s" : ""}`}
                    style={playerStyles.ratingMenuStarButton}
                    onPress={async () => {
                      setRatingMenuVisible(false);
                      await handleSetRating(starVal);
                    }}
                  />
                );
              })}
            </View>
            {currentRating > 0 && (
              <Button
                mode="text"
                compact
                textColor={theme.colors.error}
                style={playerStyles.ratingMenuClearButton}
                onPress={async () => {
                  setRatingMenuVisible(false);
                  await handleSetRating(currentRating);
                }}
              >
                remove rating
              </Button>
            )}
          </Menu>

          {/* Sleep Timer Chip */}
          <Chip
            mode="flat"
            icon={sleepTimerState.isActive ? "timer" : "timer-outline"}
            accessibilityLabel={
              sleepTimerState.isActive ? "sleep timer active" : "sleep timer"
            }
            style={[
              playerStyles.controlChip,
              {
                backgroundColor: sleepTimerState.isActive
                  ? theme.colors.secondaryContainer
                  : theme.colors.surfaceContainerHighest,
              },
            ]}
            textStyle={{
              color: sleepTimerState.isActive
                ? theme.colors.onSecondaryContainer
                : theme.colors.onSurfaceVariant,
              fontSize: 12,
            }}
            onPress={() => setSleepTimerModalVisible(true)}
          >
            {sleepTimerState.isActive
              ? sleepTimerState.mode === "end_of_track"
                ? "timer: end of song"
                : `timer: ${Math.ceil(sleepTimerState.remainingSeconds / 60)}m`
              : "sleep timer"}
          </Chip>

          {/* Scrobbled Chip */}
          {playerState.scrobbled && (
            <Chip
              mode="flat"
              icon="check"
              style={[
                playerStyles.controlChip,
                { backgroundColor: theme.colors.secondaryContainer },
              ]}
              textStyle={{
                color: theme.colors.onSecondaryContainer,
                fontSize: 12,
              }}
            >
              scrobbled
            </Chip>
          )}

          {/* Lyrics Chip */}
          {hasLyrics && (
            <Chip
              mode="flat"
              icon="text-box-outline"
              accessibilityLabel="lyrics"
              style={[
                playerStyles.controlChip,
                { backgroundColor: theme.colors.surfaceContainerHighest },
              ]}
              textStyle={{
                color: theme.colors.onSurfaceVariant,
                fontSize: 12,
              }}
              onPress={() => setLyricsModalVisible(true)}
            >
              lyrics
            </Chip>
          )}

          {/* Cache / Download Chip */}
          <SongCacheButton songId={currentTrack.id} variant="chip" />

          {/* Save to Files Chip */}
          <SongSaveButton
            songId={currentTrack.id}
            variant="chip"
            onSaveSuccess={(fileName) => {
              showSnackbar(`saved "${fileName}" to files`);
            }}
            onSaveError={() => {
              showSnackbar("failed to save to files");
            }}
          />
        </ScrollView>
      </View>

      {/* Song Progress and Timestamps */}
      <View style={playerStyles.progressSection}>
        <Pressable
          onPress={handleSeek}
          onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
          style={playerStyles.progressTouchArea}
          accessibilityLabel="song progress"
          accessibilityRole="adjustable"
          accessibilityValue={{
            min: 0,
            max: duration,
            now: position,
            text: `${formatTime(position)} of ${formatTime(duration)}`,
          }}
          accessibilityActions={[
            { name: "increment", label: "seek forward 10 seconds" },
            { name: "decrement", label: "seek backward 10 seconds" },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") {
              const newPos = Math.min(duration, position + 10);
              seekToPosition(newPos).catch((err) =>
                console.error("failed to seek forward:", err),
              );
            } else if (event.nativeEvent.actionName === "decrement") {
              const newPos = Math.max(0, position - 10);
              seekToPosition(newPos).catch((err) =>
                console.error("failed to seek backward:", err),
              );
            }
          }}
        >
          <ProgressBar
            progress={progress}
            color={
              isPlayingFromCache
                ? theme.colors.secondary
                : theme.colors.tertiary
            }
            style={[
              playerStyles.progressBar,
              { backgroundColor: theme.colors.surfaceContainerHighest },
            ]}
          />
        </Pressable>
        <View style={playerStyles.timeRow}>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {formatTime(position)}
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {formatTime(duration)}
          </Text>
        </View>
      </View>

      {/* Playback Controls Surface */}
      <Surface
        elevation={0}
        style={[
          playerStyles.controlsSurface,
          { backgroundColor: theme.colors.surfaceContainer },
        ]}
      >
        <View style={playerStyles.controlsRow}>
          <IconButton
            mode="contained"
            icon={shuffleIcon}
            size={22}
            containerColor={shuffleContainerColor}
            iconColor={shuffleColor}
            style={playerStyles.secondaryControlButton}
            accessibilityLabel={shuffleLabel}
            onPress={handleToggleShuffle}
          />

          <IconButton
            mode="contained"
            icon="skip-previous"
            size={26}
            containerColor={
              hasPrevious
                ? theme.colors.surfaceContainerHighest
                : theme.colors.surfaceContainerLow
            }
            iconColor={
              hasPrevious
                ? theme.colors.onSurface
                : theme.colors.onSurfaceDisabled
            }
            disabled={!hasPrevious}
            style={playerStyles.skipButton}
            accessibilityLabel="previous track"
            onPress={handlePlayPrevious}
          />

          {isBuffering ? (
            <View
              style={[
                playerStyles.playButtonContainer,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <ActivityIndicator size={28} color={theme.colors.onPrimary} />
            </View>
          ) : (
            <IconButton
              mode="contained"
              icon={isPlaying ? "pause" : "play"}
              size={32}
              containerColor={theme.colors.primary}
              iconColor={theme.colors.onPrimary}
              style={playerStyles.playButton}
              accessibilityLabel={isPlaying ? "pause" : "play"}
              onPress={handleTogglePlayback}
            />
          )}

          <IconButton
            mode="contained"
            icon="skip-next"
            size={26}
            containerColor={
              hasNext
                ? theme.colors.surfaceContainerHighest
                : theme.colors.surfaceContainerLow
            }
            iconColor={
              hasNext ? theme.colors.onSurface : theme.colors.onSurfaceDisabled
            }
            disabled={!hasNext}
            style={playerStyles.skipButton}
            accessibilityLabel="next track"
            onPress={handlePlayNext}
          />

          <IconButton
            mode="contained"
            icon={repeatIcon}
            size={22}
            containerColor={repeatContainerColor}
            iconColor={repeatColor}
            style={playerStyles.secondaryControlButton}
            accessibilityLabel={repeatLabel}
            onPress={handleCycleRepeat}
          />
        </View>
      </Surface>

      <SleepTimerModal
        visible={sleepTimerModalVisible}
        onDismiss={() => setSleepTimerModalVisible(false)}
        onTimerSet={(msg) => {
          if (msg.includes("valid")) {
            showSnackbar(msg);
          }
        }}
      />

      <LyricsSheetModal
        visible={lyricsModalVisible}
        onDismiss={() => setLyricsModalVisible(false)}
        lyrics={lyrics}
        isLoading={lyricsLoading}
        positionSeconds={position}
        songId={currentTrack?.id}
      />

      {/* Full Screen Art Modal */}
      <ModalArtViewer
        isVisible={isArtModalVisible}
        artUrl={artUrlForModal}
        onClose={() => {
          setIsArtModalVisible(false);
          setArtUrlForModal(null);
        }}
      />

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}
