import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Button } from "react-native-paper";

import { BulkSongCacheButton } from "@/components/BulkSongCacheButton";
import { playPlaylist } from "@/services/player";
import { Child, SongCacheRow } from "@/types";
import { spacing } from "@/utils/spacing";

export interface DetailActionsRowProps {
  songs: Child[];
  sourceKey: string;
  cacheEntries: Map<string, SongCacheRow>;
  style?: StyleProp<ViewStyle>;
}

export function DetailActionsRow({
  songs,
  sourceKey,
  cacheEntries,
  style,
}: DetailActionsRowProps) {
  const hasSongs = songs.length > 0;

  const handlePlayAll = () => {
    if (!hasSongs) return;
    playPlaylist(songs, 0);
  };

  const handleShufflePlay = () => {
    if (!hasSongs) return;
    const shuffled = [...songs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }
    playPlaylist(shuffled, 0);
  };

  return (
    <View style={[styles.actionsRow, style]}>
      <Button
        mode="contained"
        icon="play"
        onPress={handlePlayAll}
        disabled={!hasSongs}
        style={styles.actionButton}
        labelStyle={styles.buttonLabel}
        accessibilityLabel="play all"
      >
        play
      </Button>

      <Button
        mode="contained-tonal"
        icon="shuffle"
        onPress={handleShufflePlay}
        disabled={!hasSongs}
        style={styles.actionButton}
        labelStyle={styles.buttonLabel}
        accessibilityLabel="shuffle play"
      >
        shuffle
      </Button>

      <BulkSongCacheButton
        compact
        sourceKey={sourceKey}
        songIds={songs.map((s) => s.id)}
        cacheEntries={cacheEntries}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
  },
  buttonLabel: {
    textTransform: "lowercase",
  },
});

export default DetailActionsRow;
