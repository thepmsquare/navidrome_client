import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const miniPlayerStyles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    overflow: "hidden",
  },
  progressBar: {
    height: 3,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: spacing.xxl + spacing.sm,
    gap: spacing.sm,
  },
  trackPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: spacing.sm,
  },
  artworkPlaceholder: {
    borderRadius: spacing.sm,
  },
  infoContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
    justifyContent: "center",
  },
  title: {
    fontWeight: "600",
  },
  subtitle: {
    marginTop: spacing.xs / 2,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    margin: 0,
    width: spacing.xxl,
    height: spacing.xxl,
  },
  bufferingIndicator: {
    width: spacing.xxl,
    height: spacing.xxl,
    justifyContent: "center",
    alignItems: "center",
  },
});
