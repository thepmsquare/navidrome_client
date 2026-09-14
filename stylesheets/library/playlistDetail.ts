import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const playlistDetailStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  playlistInfoContainer: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  coverArt: {
    width: 180,
    height: 180,
    borderRadius: 16,
    marginBottom: spacing.sm,
  },
  playlistName: {
    textAlign: "center",
    fontWeight: "bold",
  },
  commentText: {
    textAlign: "center",
  },
  metaText: {
    textAlign: "center",
  },
  trackNumber: {
    width: spacing.xl,
    textAlign: "center",
  },
  trackItem: {
    paddingVertical: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: "center",
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
});
