import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const settingsStyles = StyleSheet.create({
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
});
