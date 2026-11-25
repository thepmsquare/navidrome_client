import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Chip,
  Icon,
  IconButton,
  Menu,
  Snackbar,
  Surface,
  Text,
} from "react-native-paper";

// Import the new component
import { LyricsSheetModal } from "@/components/LyricsSheetModal";
import { ModalArtViewer } from "@/components/ModalArtViewer";
import { PlaybackQueueView } from "@/components/PlaybackQueueView";
import { PlayerSeekBar } from "@/components/PlayerSeekBar";
import { SleepTimerModal } from "@/components/SleepTimerModal";
import { SongCacheButton } from "@/components/SongCacheButton";
import { SongSaveButton } from "@/components/SongSaveButton";
import { getCoverArtBaseUrl } from "@/services/api";
import { getAlbumByName, getArtistByName, getSongById } from "@/services/db";
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
  setPlaybackSpeed,
  setRatingCurrentTrack,
  togglePlayback,
  toggleShuffle,
  toggleStarCurrentTrack,
  usePlayerState,
} from "@/services/player";
import { useSleepTimer } from "@/services/sleepTimer";
import { playerStyles } from "@/stylesheets";
import { handleNetworkOrOfflineError } from "@/utils/network";
import {
  LyricsMode,
  LyricsTrackMetadata,
  NormalizedLyrics,
  useAppTheme,
} from "@/types";
import { triggerHapticImpact, triggerHapticSelection } from "@/utils/haptics";
import { spacing } from "@/utils/spacing";
import { formatTime } from "@/utils/time";

const PLAYBACK_SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const QUEUE_SPRING_CONFIG = {
  damping: 26,
  stiffness: 240,
  overshootClamping: true,
};
const QUEUE_EXPAND_THRESHOLD = 0.22;
const QUEUE_EXPAND_VELOCITY = -450;
const QUEUE_COLLAPSE_THRESHOLD = 0.78;
const QUEUE_COLLAPSE_VELOCITY = 450;

export interface PlayerContentProps {
  onCollapse?: () => void;
  isActive?: boolean;
  onViewModeChange?: (mode: "player" | "queue") => void;
}

export function PlayerContent({
  onCollapse,
  isActive = true,
  onViewModeChange,
}: PlayerContentProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const playerState = usePlayerState();
  const sleepTimerState = useSleepTimer();
  const [viewMode, setViewMode] = useState<"player" | "queue">("player");
  const [isQueueMounted, setIsQueueMounted] = useState(false);
  const [sleepTimerModalVisible, setSleepTimerModalVisible] = useState(false);
  const [ratingMenuVisible, setRatingMenuVisible] = useState(false);
  const [speedMenuVisible, setSpeedMenuVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null, size?: number) => string | null) | null
  >(null);
  // State for the full-screen art modal
  const [isArtModalVisible, setIsArtModalVisible] = useState(false);
  const [artUrlForModal, setArtUrlForModal] = useState<string | null>(null);

  const artTranslateX = useSharedValue(0);
  const artOpacity = useSharedValue(1);
  const queueProgress = useSharedValue(0);
  const previousTrackIdRef = useRef<string | null>(null);
  const [playerHeight, setPlayerHeight] = useState(
    () => Dimensions.get("window").height,
  );

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

  const ensureQueueMounted = useCallback(() => {
    setIsQueueMounted((prev) => (prev ? prev : true));
  }, []);

  const unmountQueue = useCallback(() => {
    setIsQueueMounted(false);
    setViewMode("player");
  }, []);

  const queueTopOffset = Math.round(playerHeight * 0.4);
  const queueDragDistance = Math.max(1, playerHeight - queueTopOffset);

  const queueExpandPanGesture = Gesture.Pan()
    .enabled(viewMode === "player")
    .activeOffsetY([-12, 999])
    .failOffsetX([-15, 15])
    .onUpdate((event) => {
      runOnJS(ensureQueueMounted)();
      const next = Math.max(
        0,
        Math.min(1, -event.translationY / queueDragDistance),
      );
      queueProgress.value = next;
    })
    .onEnd((event) => {
      const shouldOpen =
        queueProgress.value > QUEUE_EXPAND_THRESHOLD ||
        event.velocityY < QUEUE_EXPAND_VELOCITY;

      if (shouldOpen) {
        runOnJS(triggerHapticSelection)();
        runOnJS(ensureQueueMounted)();
        runOnJS(setViewMode)("queue");
        queueProgress.value = withSpring(1, QUEUE_SPRING_CONFIG);
      } else {
        queueProgress.value = withSpring(0, QUEUE_SPRING_CONFIG, (finished) => {
          if (finished) {
            runOnJS(unmountQueue)();
          }
        });
      }
    });

  const queueCollapsePanGesture = Gesture.Pan()
    .enabled(viewMode === "queue")
    .activeOffsetY([-999, 12])
    .failOffsetX([-15, 15])
    .onUpdate((event) => {
      const next = Math.max(
        0,
        Math.min(1, 1 - event.translationY / queueDragDistance),
      );
      queueProgress.value = next;
    })
    .onEnd((event) => {
      const shouldClose =
        queueProgress.value < QUEUE_COLLAPSE_THRESHOLD ||
        event.velocityY > QUEUE_COLLAPSE_VELOCITY;

      if (shouldClose) {
        queueProgress.value = withSpring(0, QUEUE_SPRING_CONFIG, (finished) => {
          if (finished) {
            runOnJS(unmountQueue)();
          }
        });
      } else {
        queueProgress.value = withSpring(1, QUEUE_SPRING_CONFIG);
      }
    });

  const openQueue = useCallback(() => {
    ensureQueueMounted();
    setViewMode("queue");
    queueProgress.value = withSpring(1, QUEUE_SPRING_CONFIG);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureQueueMounted]);

  const closeQueue = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    queueProgress.value = withSpring(0, QUEUE_SPRING_CONFIG, (finished) => {
      if (finished) {
        runOnJS(unmountQueue)();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unmountQueue]);

  const [prevIsActive, setPrevIsActive] = useState(isActive);
  if (prevIsActive !== isActive) {
    setPrevIsActive(isActive);
    if (!isActive) {
      // eslint-disable-next-line react-hooks/immutability
      queueProgress.value = 0;
      if (isQueueMounted) {
        setIsQueueMounted(false);
      }
      if (viewMode !== "player") {
        setViewMode("player");
      }
    }
  }

  useEffect(() => {
    onViewModeChange?.(viewMode);
  }, [viewMode, onViewModeChange]);

  useEffect(() => {
    if (!isActive || viewMode !== "queue") return;
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        closeQueue();
        return true;
      },
    );
    return () => backHandler.remove();
  }, [isActive, viewMode, closeQueue]);

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
    } catch (e: any) {
      if (!handleNetworkOrOfflineError(e)) {
        showSnackbar("failed to update favorite");
      }
    }
  };

  const handleSetRating = async (ratingVal: number) => {
    try {
      await setRatingCurrentTrack(ratingVal);
    } catch (e: any) {
      if (!handleNetworkOrOfflineError(e)) {
        showSnackbar("failed to update rating");
      }
    }
  };

  const playbackSpeed = playerState.playbackSpeed ?? 1.0;

  const handleSelectSpeed = async (speedVal: number) => {
    try {
      triggerHapticSelection();
      await setPlaybackSpeed(speedVal);
    } catch {
      showSnackbar("failed to update playback speed");
    }
  };

  const handleSeek = (targetSecs: number) => {
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
      triggerHapticSelection();
      await toggleShuffle();
    } catch {
      showSnackbar("failed to toggle shuffle");
    }
  };

  const handleCycleRepeat = async () => {
    try {
      triggerHapticSelection();
      await cycleRepeatMode();
    } catch (err) {
      console.error("failed to cycle repeat mode:", err);
    }
  };

  const handleTogglePlayback = async () => {
    try {
      triggerHapticImpact();
      await togglePlayback();
    } catch (err) {
      console.error("failed to toggle playback:", err);
    }
  };

  const handlePlayPrevious = async () => {
    try {
      triggerHapticImpact();
      await playPrevious();
    } catch (err) {
      console.error("failed to play previous track:", err);
    }
  };

  const handlePlayNext = async () => {
    try {
      triggerHapticImpact();
      await playNext();
    } catch (err) {
      console.error("failed to play next track:", err);
    }
  };

  const artPanGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      artTranslateX.value = event.translationX;
      artOpacity.value = interpolate(
        Math.abs(event.translationX),
        [0, 160],
        [1, 0.5],
        "clamp",
      );
    })
    .onEnd((event) => {
      const isSwipeLeft =
        event.translationX < -60 || event.velocityX < -500;
      const isSwipeRight =
        event.translationX > 60 || event.velocityX > 500;

      if (isSwipeLeft) {
        artTranslateX.value = withTiming(-200, { duration: 120 }, (finished) => {
          if (finished) {
            runOnJS(handlePlayNext)();
          }
        });
        artOpacity.value = withTiming(0, { duration: 120 });
      } else if (isSwipeRight) {
        artTranslateX.value = withTiming(200, { duration: 120 }, (finished) => {
          if (finished) {
            runOnJS(handlePlayPrevious)();
          }
        });
        artOpacity.value = withTiming(0, { duration: 120 });
      } else {
        artTranslateX.value = withSpring(0, {
          damping: 26,
          stiffness: 240,
          overshootClamping: true,
        });
        artOpacity.value = withTiming(1, { duration: 140 });
      }
    });

  // Animate artwork entry when currentTrack changes
  useEffect(() => {
    if (!currentTrack) return;
    if (previousTrackIdRef.current && previousTrackIdRef.current !== currentTrack.id) {
      artOpacity.value = 0;
      artTranslateX.value = artTranslateX.value < 0 ? 40 : -40;
      artTranslateX.value = withSpring(0, {
        damping: 26,
        stiffness: 240,
        overshootClamping: true,
      });
      artOpacity.value = withTiming(1, { duration: 180 });
    }
    previousTrackIdRef.current = currentTrack.id;
  }, [currentTrack, artOpacity, artTranslateX]);

  const animatedArtStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: artTranslateX.value }],
    opacity: artOpacity.value,
  }));

  const animatedPlayerLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(queueProgress.value, [0, 1], [1, 0.5], "clamp"),
    transform: [
      {
        scale: interpolate(queueProgress.value, [0, 1], [1, 0.96], "clamp"),
      },
    ],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(queueProgress.value, [0, 1], [0, 1], "clamp"),
  }));

  const animatedQueueStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          queueProgress.value,
          [0, 1],
          [queueDragDistance, 0],
          "clamp",
        ),
      },
    ],
    opacity: interpolate(queueProgress.value, [0, 0.05], [0, 1], "clamp"),
  }));

  const resolvedArtistId = useMemo(() => {
    if (!currentTrack) return null;
    if (currentTrack.artistId) return currentTrack.artistId;
    try {
      const dbSong = getSongById(currentTrack.id);
      if (dbSong?.artistId) return dbSong.artistId;
    } catch {}
    if (currentTrack.artist) {
      try {
        const art = getArtistByName(currentTrack.artist);
        if (art?.id) return art.id;
      } catch {}
    }
    return null;
  }, [currentTrack]);

  const resolvedAlbumId = useMemo(() => {
    if (!currentTrack) return null;
    if (currentTrack.albumId) return currentTrack.albumId;
    try {
      const dbSong = getSongById(currentTrack.id);
      if (dbSong?.albumId) return dbSong.albumId;
    } catch {}
    if (currentTrack.album) {
      try {
        const alb = getAlbumByName(
          currentTrack.album,
          currentTrack.artistId ?? currentTrack.artist ?? undefined,
        );
        if (alb?.id) return alb.id;
      } catch {}
    }
    return null;
  }, [currentTrack]);

  const handleClose = () => {
    if (onCollapse) {
      onCollapse();
    } else {
      router.back();
    }
  };

  const handleArtistPress = () => {
    if (!resolvedArtistId) return;
    triggerHapticSelection();
    onCollapse?.();
    router.push({
      pathname: "/artist/[id]",
      params: { id: resolvedArtistId },
    });
  };

  const handleAlbumPress = () => {
    if (!resolvedAlbumId) return;
    triggerHapticSelection();
    onCollapse?.();
    router.push({
      pathname: "/album/[id]",
      params: { id: resolvedAlbumId },
    });
  };

  if (!currentTrack) {
    if (viewMode === "queue") {
      return <PlaybackQueueView onBack={() => setViewMode("player")} />;
    }
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
            onPress={handleClose}
          />
          <Appbar.Content title="now playing" />
          <Appbar.Action
            icon="playlist-music"
            accessibilityLabel="view queue"
            onPress={() => setViewMode("queue")}
          />
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
            onPress={handleClose}
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
        localStyles.root,
        { backgroundColor: theme.colors.background },
      ]}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) setPlayerHeight(h);
      }}
    >
      <GestureDetector gesture={queueExpandPanGesture}>
        <Animated.View
          style={[
            playerStyles.container,
            {
              backgroundColor: theme.colors.background,
              paddingBottom: insets.bottom + spacing.md,
            },
            animatedPlayerLayerStyle,
          ]}
          pointerEvents={viewMode === "queue" ? "none" : "auto"}
        >
          {/* Header with Appbar */}
          <Appbar.Header statusBarHeight={0} style={playerStyles.header}>
            <Appbar.BackAction
              accessibilityLabel="close player"
              onPress={handleClose}
            />
            <Appbar.Content title="now playing" />
            <Appbar.Action
              icon="playlist-music"
              accessibilityLabel="view queue"
              onPress={openQueue}
            />
          </Appbar.Header>

      {/* Large Album Artwork (Clickable Area with Swipe Gestures) */}
      <GestureDetector gesture={artPanGesture}>
        <Animated.View style={[playerStyles.artContainer, animatedArtStyle]}>
          <Pressable
            onPress={handleArtPress}
            style={({ pressed }) => [
              playerStyles.artPressable,
              pressed && { opacity: 0.88 },
            ]}
            android_ripple={{
              color: theme.colors.onSurface + "1F",
              borderless: false,
            }}
            accessibilityRole="button"
            accessibilityLabel="album artwork, tap to view full size, swipe left or right to change track"
            testID="player-album-art"
          >
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
        </Animated.View>
      </GestureDetector>

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
            <Pressable
              onPress={handleArtistPress}
              disabled={!resolvedArtistId}
              hitSlop={{
                top: spacing.sm,
                bottom: spacing.sm,
                left: spacing.sm,
                right: spacing.md,
              }}
              accessibilityRole="button"
              accessibilityLabel={`artist: ${currentTrack.artist || "unknown artist"}`}
              accessibilityHint="navigates to artist details"
              accessibilityState={{ disabled: !resolvedArtistId }}
              android_ripple={{
                color: theme.colors.onSurfaceVariant + "1F",
                borderless: false,
              }}
              style={({ pressed }) => [
                playerStyles.metadataPressable,
                playerStyles.artistPressable,
                pressed &&
                  resolvedArtistId && {
                    backgroundColor: theme.colors.onSurfaceVariant + "14",
                  },
              ]}
            >
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
            </Pressable>

            {currentTrack.album ? (
              <Pressable
                onPress={handleAlbumPress}
                disabled={!resolvedAlbumId}
                hitSlop={{
                  top: spacing.sm,
                  bottom: spacing.sm,
                  left: spacing.sm,
                  right: spacing.md,
                }}
                accessibilityRole="button"
                accessibilityLabel={`album: ${currentTrack.album}`}
                accessibilityHint="navigates to album details"
                accessibilityState={{ disabled: !resolvedAlbumId }}
                android_ripple={{
                  color: theme.colors.onSurfaceVariant + "1F",
                  borderless: false,
                }}
                style={({ pressed }) => [
                  playerStyles.metadataPressable,
                  pressed &&
                    resolvedAlbumId && {
                      backgroundColor: theme.colors.onSurfaceVariant + "14",
                    },
                ]}
              >
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
              </Pressable>
            ) : null}
          </View>

          <IconButton
            icon={isStarred ? "heart" : "heart-outline"}
            size={28}
            iconColor={
              isStarred ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
            accessibilityLabel={isStarred ? "unstar track" : "star track"}
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
                    : "rate track"
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
                : "rate this track"}
            </Text>
            <View
              style={playerStyles.ratingMenuStarsRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="track rating"
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
                ? "timer: end of track"
                : `timer: ${Math.ceil(sleepTimerState.remainingSeconds / 60)}m`
              : "sleep timer"}
          </Chip>

          {/* Playback Speed Chip + Contextual Popover Menu */}
          <Menu
            visible={speedMenuVisible}
            onDismiss={() => setSpeedMenuVisible(false)}
            anchor={
              <Chip
                mode="flat"
                icon="play-speed"
                style={[
                  playerStyles.controlChip,
                  {
                    backgroundColor:
                      playbackSpeed !== 1
                        ? theme.colors.secondaryContainer
                        : theme.colors.surfaceContainerHighest,
                  },
                ]}
                textStyle={{
                  color:
                    playbackSpeed !== 1
                      ? theme.colors.onSecondaryContainer
                      : theme.colors.onSurfaceVariant,
                  fontSize: 12,
                }}
                accessibilityRole="button"
                accessibilityLabel={`playback speed: ${playbackSpeed}x`}
                onPress={() => setSpeedMenuVisible(true)}
              >
                {`${playbackSpeed}x`}
              </Chip>
            }
            contentStyle={[
              playerStyles.speedMenuContent,
              { backgroundColor: theme.colors.surfaceContainerHigh },
            ]}
          >
            <Text
              variant="labelMedium"
              style={[
                playerStyles.speedMenuTitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              playback speed
            </Text>
            {PLAYBACK_SPEED_PRESETS.map((speedVal) => {
              const isSelected = playbackSpeed === speedVal;
              return (
                <Menu.Item
                  key={speedVal}
                  title={`${speedVal}x${speedVal === 1 ? " (normal)" : ""}`}
                  leadingIcon={isSelected ? "check" : undefined}
                  onPress={async () => {
                    setSpeedMenuVisible(false);
                    await handleSelectSpeed(speedVal);
                  }}
                  accessibilityLabel={`${speedVal}x speed`}
                />
              );
            })}
            {playbackSpeed !== 1 && (
              <Button
                mode="text"
                compact
                textColor={theme.colors.primary}
                style={playerStyles.speedMenuResetButton}
                onPress={async () => {
                  setSpeedMenuVisible(false);
                  await handleSelectSpeed(1);
                }}
                accessibilityLabel="reset speed to normal"
              >
                reset to normal speed
              </Button>
            )}
          </Menu>

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
        <PlayerSeekBar
          position={position}
          duration={duration}
          onSeek={handleSeek}
          color={
            isPlayingFromCache ? theme.colors.secondary : theme.colors.tertiary
          }
          trackColor={theme.colors.surfaceContainerHighest}
        />
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

      <Pressable
        onPress={openQueue}
        style={localStyles.queueHint}
        accessibilityRole="button"
        accessibilityLabel="swipe up for queue"
        testID="player-queue-hint"
      >
        <Icon
          source="chevron-up"
          size={18}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          swipe up for queue
        </Text>
      </Pressable>
        </Animated.View>
      </GestureDetector>

      <Animated.View
        style={[localStyles.queueBackdrop, animatedBackdropStyle]}
        pointerEvents={viewMode === "queue" ? "auto" : "none"}
      >
        <Pressable
          style={localStyles.backdropPressable}
          onPress={closeQueue}
          accessibilityRole="button"
          accessibilityLabel="dismiss queue"
          testID="queue-sheet-backdrop"
        />
      </Animated.View>

      <Animated.View
        style={[
          localStyles.queueSheet,
          {
            top: queueTopOffset,
            backgroundColor: theme.colors.background,
          },
          animatedQueueStyle,
        ]}
        pointerEvents={viewMode === "queue" ? "auto" : "none"}
      >
        {(isQueueMounted || viewMode === "queue") && (
          <PlaybackQueueView
            onBack={closeQueue}
            showDragHandle
            wrapHeader={(header) => (
              <GestureDetector gesture={queueCollapsePanGesture}>
                <View>{header}</View>
              </GestureDetector>
            )}
          />
        )}
      </Animated.View>

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
        action={{
          label: "dismiss",
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

export default function PlayerScreen() {
  return <PlayerContent />;
}

const localStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  queueHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    opacity: 0.75,
  },
  queueBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    zIndex: 15,
  },
  backdropPressable: {
    flex: 1,
  },
  queueSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 20,
    overflow: "hidden",
  },
});
