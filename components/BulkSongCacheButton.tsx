/**
 * @component BulkSongCacheButton
 * @description A button component that manages bulk song caching (downloading) for a given set of songs.
 * It handles checking current cache status, initiating downloads, and allowing removal of cached files.
 *
 * @param {BulkSongCacheButtonProps} props - The properties for the component.
 * @param {string} props.sourceKey - A unique key identifying the source of the songs (e.g., 'album:123').
 * @param {string[]} props.songIds - An array of song IDs to manage caching for.
 * @param {Map<string, SongCacheRow>} props.cacheEntries - A map containing cache metadata for each song ID.
 * @param {StyleProp<ViewStyle>} [props.style] - Optional style applied to the button container.
 */
import { useEffect, useState } from "react";
import { Alert, StyleProp, ViewStyle } from "react-native";
import { Button } from "react-native-paper";

import {
  cancelSongCaching,
  deleteSongFromCache,
  getDownloadQueueState,
  notifyCacheQueueUpdated,
  subscribeCacheQueue,
  tryStartNextDownload,
} from "@/services/songCache";
import {
  addQueueRequester,
  enqueuePendingDownload,
  getQueueRequesterCount,
  getRequestersForSource,
  removeFromDownloadQueue,
  removeQueueRequester,
} from "@/services/db";
import { DownloadQueueState, SongCacheRow, SongCacheType, useAppTheme } from "@/types";

export interface BulkSongCacheButtonProps {
  sourceKey: string;
  songIds: string[];
  cacheEntries: Map<string, SongCacheRow>;
  style?: StyleProp<ViewStyle>;
}

export function BulkSongCacheButton({
  sourceKey,
  songIds,
  cacheEntries,
  style,
}: BulkSongCacheButtonProps) {
  const theme = useAppTheme();

  const [queueState, setQueueState] = useState<DownloadQueueState>(() => {
    try {
      return getDownloadQueueState();
    } catch {
      return { pending: [], active: null };
    }
  });

  useEffect(() => {
    const unsubscribe = subscribeCacheQueue((state) => {
      setQueueState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const totalCount = songIds.length;
  const manualCount = songIds.filter(
    (id) => cacheEntries.get(id)?.cacheType === SongCacheType.Manual,
  ).length;
  const allUncached = songIds.every((id) => !cacheEntries.has(id));
  const fullyManual = totalCount > 0 && manualCount === totalCount;

  let myRequestedIds: string[] = [];
  try {
    const sourceRequested = getRequestersForSource(sourceKey);
    const songIdSet = new Set(songIds);
    myRequestedIds = sourceRequested.filter((id) => songIdSet.has(id));
  } catch {
    myRequestedIds = [];
  }

  const isRunning = Boolean(
    myRequestedIds.length > 0 &&
      ((queueState.active && myRequestedIds.includes(queueState.active)) ||
        myRequestedIds.some((id) => queueState.pending.includes(id))),
  );

  if (totalCount === 0) {
    return null;
  }

  let label: string;
  if (isRunning) {
    label = `downloading... (${manualCount}/${totalCount})`;
  } else if (fullyManual) {
    label = "available offline";
  } else if (allUncached) {
    label = "make available offline";
  } else {
    label = `make available offline (${totalCount - manualCount}/${totalCount})`;
  }

  const confirmRemoveFromCache = () => {
    Alert.alert(
      "remove offline songs",
      `are you sure you want to remove these ${totalCount} offline songs?`,
      [
        {
          text: "no",
          style: "cancel",
        },
        {
          text: "yes",
          style: "destructive",
          onPress: async () => {
            for (const id of songIds) {
              await deleteSongFromCache(id);
            }
          },
        },
      ],
    );
  };

  const confirmStopDownloading = () => {
    Alert.alert(
      "stop downloading offline songs",
      "already downloaded songs will stay available offline. are you sure you want to stop?",
      [
        {
          text: "no",
          style: "cancel",
        },
        {
          text: "yes",
          style: "destructive",
          onPress: () => {
            if (myRequestedIds.length === 0) {
              return;
            }
            const unfinishedSongIds = myRequestedIds.filter(
              (id) =>
                id === queueState.active || queueState.pending.includes(id),
            );
            for (const songId of unfinishedSongIds) {
              removeQueueRequester(songId, sourceKey);
              if (getQueueRequesterCount(songId) === 0) {
                removeFromDownloadQueue(songId);
              }
            }
            if (
              queueState.active &&
              myRequestedIds.includes(queueState.active) &&
              getQueueRequesterCount(queueState.active) === 0
            ) {
              cancelSongCaching(queueState.active);
            }
            notifyCacheQueueUpdated();
          },
        },
      ],
    );
  };

  const handleStart = () => {
    const toEnqueue = songIds.filter(
      (id) => cacheEntries.get(id)?.cacheType !== SongCacheType.Manual,
    );
    for (const songId of toEnqueue) {
      addQueueRequester(songId, sourceKey);
      enqueuePendingDownload(songId);
    }
    notifyCacheQueueUpdated();
    tryStartNextDownload();
  };

  const handlePress = () => {
    if (fullyManual) {
      confirmRemoveFromCache();
      return;
    }

    if (isRunning) {
      confirmStopDownloading();
      return;
    }

    handleStart();
  };

  const icon = isRunning
    ? "download"
    : fullyManual
      ? "check-circle"
      : "download-outline";

  const textColor = fullyManual ? theme.colors.primary : undefined;

  return (
    <Button
      mode="contained-tonal"
      icon={icon}
      textColor={textColor}
      onPress={handlePress}
      style={style}
      labelStyle={{ textTransform: "lowercase" }}
      accessibilityLabel={label}
    >
      {label}
    </Button>
  );
}

export default BulkSongCacheButton;
