import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const homeStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
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
