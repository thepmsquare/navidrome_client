import { useRef, useState } from "react";
import { Alert, StyleProp, ViewStyle } from "react-native";
import { Button } from "react-native-paper";

import {
  cacheSongManually,
  cancelSongCaching,
  deleteSongFromCache,
} from "@/services/songCache";
import { SongCacheRow, SongCacheType, useAppTheme } from "@/types";

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

  const [isRunning, setIsRunning] = useState(false);
  const [, setCurrentDownloadingId] = useState<string | null>(null);
  const currentDownloadingIdRef = useRef<string | null>(null);
  const stopRequestedRef = useRef(false);

  const updateCurrentDownloadingId = (id: string | null) => {
    currentDownloadingIdRef.current = id;
    setCurrentDownloadingId(id);
  };

  const totalCount = songIds.length;
  const manualCount = songIds.filter(
    (id) => cacheEntries.get(id)?.cacheType === SongCacheType.Manual,
  ).length;
  const allUncached = songIds.every((id) => !cacheEntries.has(id));
  const fullyManual = totalCount > 0 && manualCount === totalCount;

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
            stopRequestedRef.current = true;
            if (currentDownloadingIdRef.current) {
              cancelSongCaching(currentDownloadingIdRef.current);
            }
          },
        },
      ],
    );
  };

  const startBulkDownload = async () => {
    setIsRunning(true);
    stopRequestedRef.current = false;

    const workList = songIds.filter(
      (id) => cacheEntries.get(id)?.cacheType !== SongCacheType.Manual,
    );

    for (const songId of workList) {
      if (stopRequestedRef.current) {
        break;
      }
      updateCurrentDownloadingId(songId);
      try {
        await cacheSongManually(songId);
      } catch {
        if (stopRequestedRef.current) {
          break;
        }
      }
    }

    setIsRunning(false);
    updateCurrentDownloadingId(null);
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

    startBulkDownload();
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
