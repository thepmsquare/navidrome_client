import { StyleSheet } from "react-native";

import { shape, spacing } from "@/utils/spacing";

export const artistDetailStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  headerInfoContainer: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  artistImage: {
    width: 150,
    height: 150,
    borderRadius: shape.full,
    marginBottom: spacing.xs,
  },
  artistName: {
    textAlign: "center",
    fontWeight: "bold",
  },
  metaText: {
    textAlign: "center",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    minWidth: 120,
  },
  bioContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: shape.medium,
  },
  bioHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  bioText: {
    lineHeight: 20,
  },
  bioToggleText: {
    marginTop: spacing.xs,
    fontWeight: "bold",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontWeight: "bold",
  },
  albumListContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  albumCard: {
    width: 130,
    alignItems: "flex-start",
  },
  albumArt: {
    width: 130,
    height: 130,
    borderRadius: shape.medium,
    marginBottom: spacing.xs,
  },
  albumTitle: {
    width: 130,
    fontWeight: "600",
  },
  albumYear: {
    width: 130,
  },
  trackItem: {
    paddingVertical: spacing.xs,
  },
  trackNumber: {
    width: spacing.xl,
    textAlign: "center",
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: "center",
  },
});
