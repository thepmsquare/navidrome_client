import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const connectStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  brandingGroup: {
    alignItems: "center",
    gap: spacing.sm,
  },
  aboutCard: {
    padding: spacing.md,
    borderRadius: 16,
    gap: spacing.sm + spacing.xs,
  },
  aboutActions: {
    gap: spacing.sm + spacing.xs,
  },
  aboutSecondaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  aboutSecondaryButton: {
    flex: 1,
  },
  form: {
    padding: spacing.md,
    borderRadius: 16,
    gap: spacing.md,
  },
  icon: {
    width: 80,
    height: 80,
    alignSelf: "center",
  },
  header: {
    alignItems: "center",
    gap: spacing.xs,
  },
  appName: {
    textAlign: "center",
  },
  appSubtitle: {
    textAlign: "center",
  },
  serverInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  serverInfoText: {
    flex: 1,
  },
});
