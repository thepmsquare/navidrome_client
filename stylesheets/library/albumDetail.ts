import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const albumDetailStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  albumInfoContainer: {
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
  albumName: {
    textAlign: "center",
    fontWeight: "bold",
  },
  artistName: {
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
});
