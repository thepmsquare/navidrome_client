import React, { useContext, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  Divider,
  IconButton,
  Modal,
  Portal,
  Surface,
  Text,
} from "react-native-paper";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import changelogData from "@/assets/changelog.json";
import { useAppTheme } from "@/types";
import { APP_VERSION, APP_VERSION_CODE } from "@/utils/constants";
import { spacing } from "@/utils/spacing";

interface ChangelogNote {
  text: string;
  level: number;
}

interface ChangelogRelease {
  heading: string;
  version: string;
  versionCode: number | null;
  notes: ChangelogNote[];
}

interface ChangelogModalProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
}

function NotesList({ notes }: { notes: ChangelogNote[] }) {
  const theme = useAppTheme();
  return (
    <View style={styles.notesContainer}>
      {notes.map((note, idx) => (
        <View
          key={idx}
          style={[
            styles.noteRow,
            { marginLeft: note.level > 0 ? spacing.md * note.level : 0 },
          ]}
        >
          <Text
            variant="bodyMedium"
            style={[styles.bulletChar, { color: theme.colors.primary }]}
          >
            {"•"}
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.noteText, { color: theme.colors.onSurfaceVariant }]}
          >
            {note.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PreviousVersionAccordion({
  release,
  isExpanded,
  onToggle,
}: {
  release: ChangelogRelease;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const theme = useAppTheme();
  const label = release.versionCode
    ? `version ${release.version} (${release.versionCode})`
    : release.version;

  return (
    <Surface
      elevation={0}
      style={[
        styles.accordionCard,
        { backgroundColor: theme.colors.surfaceContainerHighest },
      ]}
    >
      <Pressable
        testID={`changelog-accordion-${release.heading}`}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${label} release notes, ${isExpanded ? "expanded" : "collapsed"}`}
        style={styles.accordionHeader}
      >
        <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
          {label}
        </Text>
        <IconButton
          icon={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={onToggle}
          style={styles.chevronIcon}
          accessibilityLabel={`toggle ${label} release notes`}
        />
      </Pressable>
      {isExpanded && (
        <View style={styles.accordionContent}>
          <Divider style={styles.divider} />
          <NotesList notes={release.notes} />
        </View>
      )}
    </Surface>
  );
}

function parseChangelogReleases(): {
  currentRelease: ChangelogRelease | null;
  previousReleases: ChangelogRelease[];
} {
  const rawReleases = (changelogData as any)?.default ?? changelogData;
  const releases = Array.isArray(rawReleases) ? (rawReleases as ChangelogRelease[]) : [];
  if (!releases || releases.length === 0) {
    return { currentRelease: null, previousReleases: [] };
  }

  // 1. If top section is unreleased, treat as active development version
  if (releases[0].heading.toLowerCase() === "unreleased") {
    return {
      currentRelease: releases[0],
      previousReleases: releases.slice(1),
    };
  }

  // 2. Match configured app version and versionCode
  const matchIdx = releases.findIndex(
    (r) => r.version === APP_VERSION && r.versionCode === APP_VERSION_CODE,
  );

  if (matchIdx !== -1) {
    return {
      currentRelease: releases[matchIdx],
      previousReleases: releases.filter((_, idx) => idx !== matchIdx),
    };
  }

  return {
    currentRelease: releases[0],
    previousReleases: releases.slice(1),
  };
}

export function ChangelogModal({
  visible,
  onDismiss,
  title = "changelog",
}: ChangelogModalProps) {
  const theme = useAppTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const [expandedHeadings, setExpandedHeadings] = useState<Record<string, boolean>>({});

  const { currentRelease, previousReleases } = parseChangelogReleases();

  const toggleHeading = (heading: string) => {
    setExpandedHeadings((prev) => ({
      ...prev,
      [heading]: !prev[heading],
    }));
  };

  if (!visible) return null;

  const isCurrentUnreleased =
    currentRelease?.heading.toLowerCase() === "unreleased";

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
            {title}
          </Text>
          <IconButton
            testID="changelog-close-button"
            icon="close"
            size={20}
            iconColor={theme.colors.onSurfaceVariant}
            accessibilityLabel={`close ${title}`}
            onPress={onDismiss}
            style={styles.closeButton}
          />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
        >
          {currentRelease && (
            <Surface
              elevation={0}
              style={[
                styles.currentCard,
                {
                  backgroundColor: theme.colors.surfaceContainerHighest,
                  borderColor: theme.colors.primary,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.currentHeader}>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.primary, fontWeight: "700" }}
                >
                  {isCurrentUnreleased
                    ? "current version (in development)"
                    : "current version"}
                </Text>
                <Text
                  variant="titleMedium"
                  style={{ color: theme.colors.onSurface }}
                >
                  {isCurrentUnreleased
                    ? "unreleased"
                    : currentRelease.versionCode
                      ? `version ${currentRelease.version} (${currentRelease.versionCode})`
                      : currentRelease.version}
                </Text>
              </View>
              <Divider style={styles.divider} />
              <NotesList notes={currentRelease.notes} />
            </Surface>
          )}

          {previousReleases.length > 0 && (
            <View style={styles.previousSection}>
              <Text
                variant="labelLarge"
                style={[
                  styles.previousSectionTitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                previous versions
              </Text>

              {previousReleases.map((release) => (
                <PreviousVersionAccordion
                  key={release.heading}
                  release={release}
                  isExpanded={Boolean(expandedHeadings[release.heading])}
                  onToggle={() => toggleHeading(release.heading)}
                />
              ))}
            </View>
          )}
        </ScrollView>
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
    maxHeight: "85%",
    minHeight: 360,
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  currentCard: {
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  currentHeader: {
    gap: 2,
  },
  divider: {
    opacity: 0.4,
  },
  previousSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  previousSectionTitle: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  accordionCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  chevronIcon: {
    margin: 0,
  },
  accordionContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  notesContainer: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  bulletChar: {
    lineHeight: 20,
    fontWeight: "700",
  },
  noteText: {
    flex: 1,
    lineHeight: 20,
  },
});
