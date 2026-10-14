import React from "react";
import { StyleSheet, View } from "react-native";
import {
  IconButton,
  Modal,
  Portal,
  Switch,
  Text,
  TouchableRipple,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/types";
import { spacing } from "@/utils/spacing";

export interface ArtistsFilterModalProps {
  visible: boolean;
  onDismiss: () => void;
  hideEmptyArtists: boolean;
  onToggleHideEmptyArtists: (value: boolean) => void;
}

export function ArtistsFilterModal({
  visible,
  onDismiss,
  hideEmptyArtists,
  onToggleHideEmptyArtists,
}: ArtistsFilterModalProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        style={styles.modalRoot}
        contentContainerStyle={[
          styles.sheetContainer,
          {
            backgroundColor: theme.colors.surfaceContainerLow,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <View style={styles.dragHandleContainer}>
          <View
            style={[
              styles.dragHandle,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />
        </View>

        <View style={styles.header}>
          <Text
            variant="titleMedium"
            style={[styles.headerTitle, { color: theme.colors.onSurface }]}
          >
            filter artists
          </Text>
          <IconButton
            icon="close"
            size={20}
            iconColor={theme.colors.onSurfaceVariant}
            accessibilityLabel="close filters"
            onPress={onDismiss}
            style={styles.closeButton}
          />
        </View>

        <View style={styles.content}>
          <TouchableRipple
            onPress={() => onToggleHideEmptyArtists(!hideEmptyArtists)}
            accessibilityRole="switch"
            accessibilityState={{ checked: hideEmptyArtists }}
            style={styles.optionRow}
          >
            <View style={styles.optionContent}>
              <View style={styles.optionTextContainer}>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.onSurface }}
                >
                  hide artists with 0 albums
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  only show artists with at least one album
                </Text>
              </View>
              <Switch
                value={hideEmptyArtists}
                onValueChange={onToggleHideEmptyArtists}
              />
            </View>
          </TouchableRipple>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    justifyContent: "flex-end",
    margin: 0,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.xs,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerTitle: {
    fontWeight: "600",
  },
  closeButton: {
    margin: 0,
  },
  content: {
    paddingVertical: spacing.xs,
  },
  optionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  optionTextContainer: {
    flex: 1,
    gap: spacing.xs / 2,
  },
});
