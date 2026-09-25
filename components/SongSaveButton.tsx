import { useEffect, useState } from "react";
import {
  Alert,
  GestureResponderEvent,
  Insets,
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from "react-native";
import { Button, IconButton } from "react-native-paper";

import { CircularProgressRing } from "@/components/CircularProgressRing";
import {
  cancelSongExport,
  isSongExporting,
  saveSongToFiles,
  subscribeSongExportProgress,
} from "@/services/songExport";
import { useAppTheme } from "@/types";

export interface SongSaveButtonProps {
  songId?: string | null;
  /**
   * Mini mode toggle: if true, displays icon only.
   */
  mini?: boolean;
  /**
   * Display style: "button" shows icon + text, "icon" shows compact icon only.
   * Defaults to "button" unless mini is true or showText is explicitly set to false.
   */
  variant?: "button" | "icon";
  /**
   * Toggle: if false, displays icon only.
   */
  showText?: boolean;
  /**
   * Icon size when in mini/icon variant (defaults to 24).
   */
  iconSize?: number;
  /**
   * Button mode when in button variant (defaults to "text").
   */
  mode?: "text" | "outlined" | "contained" | "elevated" | "contained-tonal";
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  hitSlop?: Insets | number;
  onSaveSuccess?: (fileName: string) => void;
  onSaveError?: (error: unknown) => void;
  onSaveCancelled?: () => void;
}

export function SongSaveButton({
  songId,
  mini = false,
  variant = "button",
  showText = true,
  iconSize = 24,
  mode = "text",
  compact = true,
  style,
  contentStyle,
  labelStyle,
  hitSlop,
  onSaveSuccess,
  onSaveError,
  onSaveCancelled,
}: SongSaveButtonProps) {
  const theme = useAppTheme();

  const [prevSongId, setPrevSongId] = useState<string | undefined | null>(undefined);
  const [isExporting, setIsExporting] = useState(() =>
    songId ? isSongExporting(songId) : false,
  );
  const [exportProgress, setExportProgress] = useState(0);

  if (songId !== prevSongId) {
    setPrevSongId(songId);
    setIsExporting(songId ? isSongExporting(songId) : false);
    setExportProgress(0);
  }

  useEffect(() => {
    if (!songId) return;

    const unsubscribe = subscribeSongExportProgress(
      ({ songId: progressId, progress }) => {
        if (progressId === songId) {
          if (progress > 0 && progress < 1) {
            setIsExporting(true);
            setExportProgress(progress);
          } else if (progress === 1 || progress === 0) {
            setIsExporting(false);
            setExportProgress(0);
          }
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [songId]);

  if (!songId) {
    return null;
  }

  const confirmCancelExport = () => {
    Alert.alert(
      "cancel export",
      "are you sure you want to cancel saving this song?",
      [
        {
          text: "no",
          style: "cancel",
        },
        {
          text: "yes",
          style: "destructive",
          onPress: () => {
            cancelSongExport(songId);
            setIsExporting(false);
            setExportProgress(0);
            onSaveCancelled?.();
          },
        },
      ],
    );
  };

  const handlePress = async (e?: GestureResponderEvent) => {
    e?.stopPropagation?.();

    if (!songId) return;

    if (isExporting) {
      confirmCancelExport();
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(0);

      const result = await saveSongToFiles(songId, (p) => {
        setExportProgress(p);
      });

      if (result.cancelled) {
        onSaveCancelled?.();
      } else if (result.success) {
        onSaveSuccess?.(result.fileName || "");
      } else {
        onSaveError?.(result.error || "failed to save file");
      }
    } catch (err) {
      console.error("failed to save song to files:", err);
      onSaveError?.(err);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const progressPercent = Math.round(
    exportProgress < 0 ? 0 : Math.min(1, Math.max(0, exportProgress)) * 100,
  );

  const saveText = isExporting
    ? exportProgress > 0
      ? `saving... ${progressPercent}%`
      : "saving..."
    : "save to files";

  const isIconOnly = mini || variant === "icon" || showText === false;
  const progressRingSize = Math.max(22, iconSize + 2);
  const iconColor = theme.colors.outline;

  if (isIconOnly) {
    if (isExporting) {
      return (
        <Pressable
          style={[
            styles.iconProgressContainer,
            { width: progressRingSize + 12, height: progressRingSize + 12 },
            style,
          ]}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="cancel export"
          onPress={handlePress}
        >
          <CircularProgressRing
            progress={exportProgress}
            size={progressRingSize}
            strokeWidth={2.5}
            color={theme.colors.tertiary}
            trackColor={theme.colors.surfaceContainerHighest}
            showPercentage
          />
        </Pressable>
      );
    }

    return (
      <IconButton
        icon="folder-download-outline"
        iconColor={iconColor}
        size={iconSize}
        style={style}
        hitSlop={hitSlop}
        accessibilityLabel={saveText}
        onPress={handlePress}
      />
    );
  }

  return (
    <Button
      mode={mode}
      compact={compact}
      icon={
        isExporting
          ? () => (
              <CircularProgressRing
                progress={exportProgress}
                size={20}
                strokeWidth={2}
                color={theme.colors.tertiary}
                trackColor={theme.colors.surfaceContainerHighest}
                showPercentage={false}
              />
            )
          : "folder-download-outline"
      }
      textColor={isExporting ? theme.colors.tertiary : iconColor}
      onPress={handlePress}
      style={[styles.button, style]}
      contentStyle={[styles.content, contentStyle]}
      labelStyle={[
        styles.label,
        { color: isExporting ? theme.colors.tertiary : iconColor },
        labelStyle,
      ]}
      accessibilityLabel={saveText}
      hitSlop={hitSlop}
    >
      {saveText}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: -8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    textTransform: "lowercase",
  },
  iconProgressContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SongSaveButton;
