import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const searchStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  searchbar: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  chipScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    marginRight: spacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontWeight: "bold",
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
  artistAvatar: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: spacing.xxl / 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    marginTop: spacing.xxl,
  },
  emptyText: {
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
