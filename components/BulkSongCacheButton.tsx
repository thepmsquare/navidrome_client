import { useEffect, useState } from "react";
import { Alert, StyleProp, ViewStyle } from "react-native";
import { Button } from "react-native-paper";

import {
  cancelSongCaching,
  deleteSongFromCache,
  dequeuePendingSong,
  enqueueSongsForManualCache,
  getDownloadQueueState,
  subscribeCacheQueue,
} from "@/services/songCache";
import { DownloadQueueState, SongCacheRow, SongCacheType, useAppTheme } from "@/types";

export interface BulkSongCacheButtonProps {
  songIds: string[];
  cacheEntries: Map<string, SongCacheRow>;
  style?: StyleProp<ViewStyle>;
}

export function BulkSongCacheButton({
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
    return unsubscribe;
  }, []);

  const totalCount = songIds.length;
  const manualCount = songIds.filter(
    (id) => cacheEntries.get(id)?.cacheType === SongCacheType.Manual,
  ).length;
  const allUncached = songIds.every((id) => !cacheEntries.has(id));
  const fullyManual = totalCount > 0 && manualCount === totalCount;

  const isThisButtonActive =
    queueState.active !== null && songIds.includes(queueState.active);
  const pendingThisButtonCount = songIds.filter((id) =>
    queueState.pending.includes(id),
  ).length;
  const isInQueue = isThisButtonActive || pendingThisButtonCount > 0;

  if (totalCount === 0) {
    return null;
  }

  let label: string;
  if (isThisButtonActive) {
    label = `downloading... (${manualCount}/${totalCount})`;
  } else if (pendingThisButtonCount > 0) {
    label = "queued";
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
      `are you sure you want to remove these ${totalCount} songs from offline cache?`,
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
            if (queueState.active && songIds.includes(queueState.active)) {
              cancelSongCaching(queueState.active);
            }
            for (const id of songIds) {
              if (queueState.pending.includes(id)) {
                dequeuePendingSong(id);
              }
            }
          },
        },
      ],
    );
  };

  const handlePress = () => {
    if (fullyManual) {
      confirmRemoveFromCache();
      return;
    }

    if (isInQueue) {
      confirmStopDownloading();
      return;
    }

    enqueueSongsForManualCache(songIds);
  };

  const icon = isInQueue
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
