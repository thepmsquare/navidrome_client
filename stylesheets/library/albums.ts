import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const albumsStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  searchbar: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sortActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  gridRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
});
