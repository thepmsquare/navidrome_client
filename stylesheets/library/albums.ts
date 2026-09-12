import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const albumsStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  artwork: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
});
