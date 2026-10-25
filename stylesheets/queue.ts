import { StyleSheet } from "react-native";

import { shape, spacing } from "@/utils/spacing";

export const playbackQueueStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: "transparent",
    paddingHorizontal: spacing.xs,
  },
  headerStatsText: {
    marginRight: spacing.sm,
  },
  nowPlayingSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
    textTransform: "lowercase",
  },
  nowPlayingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: shape.large,
    gap: spacing.sm,
  },
  nowPlayingArt: {
    width: 54,
    height: 54,
    borderRadius: shape.medium,
  },
  nowPlayingArtPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: shape.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  nowPlayingMeta: {
    flex: 1,
    justifyContent: "center",
  },
  nowPlayingTitle: {
    fontWeight: "600",
  },
  nowPlayingArtist: {
    marginTop: 2,
  },
  nowPlayingBadge: {
    paddingHorizontal: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  itemIndexContainer: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },
  itemIndexText: {
    fontWeight: "500",
  },
  itemArt: {
    width: 42,
    height: 42,
    borderRadius: shape.small,
    marginRight: spacing.sm,
  },
  itemArtPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: shape.small,
    marginRight: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  itemMeta: {
    flex: 1,
    justifyContent: "center",
  },
  itemSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: spacing.xs,
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    margin: 0,
    width: 36,
    height: 36,
  },
  historySection: {
    opacity: 0.72,
  },
  historyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    minHeight: 280,
  },
  emptyText: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  emptySubtext: {
    textAlign: "center",
  },
});
