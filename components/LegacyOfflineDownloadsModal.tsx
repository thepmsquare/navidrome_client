import { ScrollView, StyleSheet } from "react-native";
import { Button, Dialog, Portal, Surface, Text } from "react-native-paper";

import { formatBytes } from "@/services/legacyCache";
import { useAppTheme } from "@/types";
import { spacing } from "@/utils/spacing";

interface LegacyOfflineDownloadsModalProps {
  visible: boolean;
  sizeBytes: number;
  onDismiss: () => void;
}

/**
 * Informs v1 -> v2 migrated users that incompatible legacy offline downloads
 * were automatically cleared after the rewrite.
 */
export function LegacyOfflineDownloadsModal({
  visible,
  sizeBytes,
  onDismiss,
}: LegacyOfflineDownloadsModalProps) {
  const theme = useAppTheme();

  if (!visible) return null;

  const formattedSize = formatBytes(sizeBytes);

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        dismissable={false}
        style={[
          styles.dialog,
          { backgroundColor: theme.colors.surfaceContainerLow },
        ]}
      >
        <Dialog.Icon
          icon="alert-circle-outline"
          color={theme.colors.error}
          size={32}
        />
        <Dialog.Title style={[styles.title, { color: theme.colors.onSurface }]}>
          your offline music was removed
        </Dialog.Title>

        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text
              variant="bodyMedium"
              style={[styles.paragraph, { color: theme.colors.onSurface }]}
            >
              this update changes how offline music is stored, so offline music
              from the previous version cannot be used.
            </Text>

            <Surface
              elevation={0}
              style={[
                styles.callout,
                {
                  backgroundColor: theme.colors.errorContainer,
                  borderLeftColor: theme.colors.error,
                },
              ]}
            >
              <Text
                variant="bodyMedium"
                style={[
                  styles.calloutBody,
                  { color: theme.colors.onErrorContainer },
                ]}
              >
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.bold,
                    { color: theme.colors.onErrorContainer },
                  ]}
                >
                  {formattedSize}
                </Text>{" "}
                of your offline music were automatically removed to free up
                storage. you can download music again anytime.
              </Text>
            </Surface>

            <Text
              variant="bodyMedium"
              style={[
                styles.paragraph,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              your data, preferences and settings remain intact. apologies for
              the disruption. this is frustrating. the goal is to minimise
              changes like this.
            </Text>
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions style={styles.actions}>
          <Button
            testID="legacy-offline-dismiss-button"
            mode="contained"
            onPress={onDismiss}
          >
            confirm
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 24,
  },
  title: {
    textAlign: "center",
  },
  scrollArea: {
    paddingHorizontal: 0,
    maxHeight: 360,
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  paragraph: {
    lineHeight: 20,
  },
  bold: {
    fontWeight: "700",
  },
  callout: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: spacing.xs,
  },
  calloutHeadline: {
    fontWeight: "700",
    lineHeight: 20,
  },
  calloutBody: {
    lineHeight: 20,
  },
  actions: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
