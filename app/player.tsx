import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  IconButton,
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
  setRatingCurrentTrack,
  togglePlayback,
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
  const [, setProgressBarWidth] = useState<number>(0);
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
  const [prevSongId, setPrevSongId] = useState<string | undefined | null>(
    undefined,
  );
  const [prevLyricsMode, setPrevLyricsMode] = useState<LyricsMode>(lyricsMode);
  const [lyricsModalVisible, setLyricsModalVisible] = useState(false);
  const [lyrics, setLyrics] = useState<NormalizedLyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

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
    getCoverArtBaseUrl(600)
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error(
          "failed to get cover art url helper in player screen:",
          err,
        ),
      );
  }, []);

  const {
    currentTrack,
    isPlaying,
    isBuffering,
    position,
    duration,
    repeatMode,
    hasPrevious,
    hasNext,
    isPlayingFromCache,
  } = playerState;

  const songId = currentTrack?.id;

  if (songId !== prevSongId || lyricsMode !== prevLyricsMode) {
    setPrevSongId(songId);
    setPrevLyricsMode(lyricsMode);
    const cached = getCachedLyricsSync(songId, lyricsMode);
    setLyrics(cached);
    setLyricsLoading(Boolean(songId) && !cached);
  }

  useEffect(() => {
    let isCancelled = false;

    if (!songId) {
      return;
    }

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
      const resultingRating = await setRatingCurrentTrack(ratingVal);
      if (resultingRating === 0) {
        showSnackbar("rating removed");
      } else {
        showSnackbar(
          `rated ${resultingRating} star${resultingRating > 1 ? "s" : ""}`,
        );
      }
    } catch {
      showSnackbar("failed to update rating");
    }
  };

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(Math.max(position / duration, 0), 1);
  }, [position, duration]);

  // Removed handleSeek function as it was unused

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

  const repeatColor =
    repeatMode === "off" ? theme.colors.outline : theme.colors.primary;

  const repeatLabel =
    repeatMode === "one"
      ? "repeat one"
      : repeatMode === "all"
        ? "repeat all"
        : "repeat off";

  if (!currentTrack) {
    return (
      <View
        style={[
          playerStyles.container,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <View style={playerStyles.header}>
          <IconButton
            icon="chevron-down"
            size={28}
            iconColor={theme.colors.onSurface}
            accessibilityLabel="close player"
            onPress={() => router.back()}
          />
          <Text
            variant="titleMedium"
            style={[
              playerStyles.headerTitle,
              { color: theme.colors.onSurface },
            ]}
          >
            now playing
          </Text>
          <View style={playerStyles.headerSpacer} />
        </View>

        <View style={playerStyles.emptyContainer}>
          <Avatar.Icon
            size={96}
            icon="music-off"
            style={{ backgroundColor: theme.colors.surfaceContainerHighest }}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="bodyLarge"
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
      {/* Header with Close Icon and Title */}
      <View style={playerStyles.header}>
        <IconButton
          icon="chevron-down"
          size={28}
          iconColor={theme.colors.onSurface}
          accessibilityLabel="close player"
          onPress={() => router.back()}
        />
        <Text
          variant="titleMedium"
          style={[
            playerStyles.headerTitle,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          now playing
        </Text>
        <View style={playerStyles.headerActions}>
          <IconButton
            icon={sleepTimerState.isActive ? "timer" : "timer-outline"}
            size={24}
            iconColor={
              sleepTimerState.isActive
                ? theme.colors.primary
                : theme.colors.outline
            }
            accessibilityLabel={
              sleepTimerState.isActive ? "sleep timer active" : "sleep timer"
            }
            onPress={() => setSleepTimerModalVisible(true)}
          />
          <IconButton
            icon={repeatIcon}
            size={24}
            iconColor={repeatColor}
            accessibilityLabel={repeatLabel}
            onPress={() => {
              cycleRepeatMode().catch((err) =>
                console.error("failed to cycle repeat mode:", err),
              );
            }}
          />
        </View>
      </View>

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
                style={[playerStyles.album, { color: theme.colors.outline }]}
              >
                {currentTrack.album}
              </Text>
            ) : null}
          </View>

          <IconButton
            icon={isStarred ? "heart" : "heart-outline"}
            size={28}
            iconColor={
              isStarred ? theme.colors.error : theme.colors.onSurfaceVariant
            }
            accessibilityLabel={isStarred ? "unstar song" : "star song"}
            style={playerStyles.heartButton}
            onPress={handleToggleStar}
          />
        </View>

        {/* Tonal Utility Surface: 5-Star Rating + Quick Actions */}
        <Surface
          elevation={0}
          style={[
            playerStyles.actionSurface,
            { backgroundColor: theme.colors.surfaceContainerLow },
          ]}
        >
          {/* 5-Star Interactive Rating */}
          <View
            style={playerStyles.ratingContainer}
            accessibilityRole="radiogroup"
            accessibilityLabel="song rating"
          >
            {[1, 2, 3, 4, 5].map((starVal) => {
              const isFilled = currentRating >= starVal;
              return (
                <IconButton
                  key={starVal}
                  icon={isFilled ? "star" : "star-outline"}
                  size={20}
                  iconColor={
                    isFilled ? theme.colors.tertiary : theme.colors.outline
                  }
                  accessibilityLabel={`rate ${starVal} star${starVal > 1 ? "s" : ""}`}
                  style={playerStyles.starButton}
                  onPress={() => handleSetRating(starVal)}
                />
              );
            })}
          </View>

          {/* Quick Utility Actions: Cache, Save & Scrobble Badge */}
          <View style={playerStyles.utilityActions}>
            {sleepTimerState.isActive && (
              <Text
                variant="labelSmall"
                style={[
                  playerStyles.timerBadge,
                  { color: theme.colors.primary },
                ]}
              >
                {sleepTimerState.mode === "end_of_track"
                  ? "timer: end of song"
                  : `timer: ${Math.ceil(sleepTimerState.remainingSeconds / 60)}m`}
              </Text>
            )}
            {playerState.scrobbled && (
              <Text
                variant="labelSmall"
                style={[
                  playerStyles.scrobbledBadge,
                  { color: theme.colors.primary },
                ]}
              >
                ✓ scrobbled
              </Text>
            )}
            {hasLyrics && (
              <IconButton
                icon="text-box-outline"
                size={20}
                iconColor={theme.colors.outline}
                accessibilityLabel="lyrics"
                onPress={() => setLyricsModalVisible(true)}
              />
            )}
            <SongCacheButton
              songId={currentTrack.id}
              variant="icon"
              iconSize={20}
            />
            <SongSaveButton
              songId={currentTrack.id}
              variant="icon"
              iconSize={20}
              onSaveSuccess={(fileName) => {
                showSnackbar(`saved "${fileName}" to files`);
              }}
              onSaveError={() => {
                showSnackbar("failed to save to files");
              }}
            />
          </View>
        </Surface>
      </View>

      {/* Song Progress and Timestamps */}
      <View style={playerStyles.progressSection}>
        <Pressable
          onPress={() => {
            /* Optional: handle press on progress bar area */
          }}
          onPressIn={() => {
            /* Optional: visual feedback */
          }}
          onPressOut={() => {
            /* Optional: reset visual feedback */
          }}
          onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
          style={playerStyles.progressTouchArea}
          accessibilityLabel="song progress"
          accessibilityRole="adjustable"
        >
          <ProgressBar
            progress={progress}
            color={
              isPlayingFromCache ? theme.colors.tertiary : theme.colors.primary
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

      {/* Playback Controls */}
      <View style={playerStyles.controlsRow}>
        <IconButton
          icon="skip-previous"
          size={36}
          iconColor={
            hasPrevious
              ? theme.colors.onSurface
              : theme.colors.onSurfaceDisabled
          }
          disabled={!hasPrevious}
          accessibilityLabel="previous track"
          onPress={() => {
            playPrevious().catch((err) =>
              console.error("failed to play previous track:", err),
            );
          }}
        />

        {isBuffering ? (
          <ActivityIndicator size={48} color={theme.colors.primary} />
        ) : (
          <IconButton
            icon={isPlaying ? "pause-circle" : "play-circle"}
            size={64}
            iconColor={theme.colors.primary}
            style={playerStyles.playButton}
            accessibilityLabel={isPlaying ? "pause" : "play"}
            onPress={() => {
              togglePlayback().catch((err) =>
                console.error("failed to toggle playback:", err),
              );
            }}
          />
        )}

        <IconButton
          icon="skip-next"
          size={36}
          iconColor={
            hasNext ? theme.colors.onSurface : theme.colors.onSurfaceDisabled
          }
          disabled={!hasNext}
          accessibilityLabel="next track"
          onPress={() => {
            playNext().catch((err) =>
              console.error("failed to play next track:", err),
            );
          }}
        />
      </View>

      <SleepTimerModal
        visible={sleepTimerModalVisible}
        onDismiss={() => setSleepTimerModalVisible(false)}
        onTimerSet={(msg) => showSnackbar(msg)}
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
