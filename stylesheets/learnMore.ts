import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const learnMoreStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    padding: spacing.md,
    borderRadius: 16,
    gap: spacing.sm + spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
