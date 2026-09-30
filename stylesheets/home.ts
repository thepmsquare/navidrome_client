import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const homeStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  headerContainer: {
    paddingHorizontal: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  sectionHeaderTitle: {},
  horizontalList: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  trackList: {
    paddingHorizontal: spacing.xs,
  },
  trackArtwork: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  trackPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  tile: {
    width: 140,
    gap: spacing.xs,
  },
  artwork: {
    width: 140,
    height: 140,
    borderRadius: 8,
  },
  artworkPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  tileTitle: {
    fontWeight: "600",
  },
  tileSubtitle: {},
  emptyText: {
    paddingHorizontal: spacing.md,
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: 16,
    gap: spacing.sm + spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  infoLabel: {
    flex: 1,
  },
  infoValue: {
    flex: 2,
    textAlign: "right",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  countsContainer: {
    gap: spacing.sm + spacing.xs,
  },
  countsRow: {
    flexDirection: "row",
    gap: spacing.sm + spacing.xs,
  },
  countCard: {
    flex: 1,
    borderRadius: 16,
  },
});
