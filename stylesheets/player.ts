import { StyleSheet } from "react-native";

import { shape, spacing } from "@/utils/spacing";

export const playerStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    justifyContent: "space-between",
  },
  header: {
    backgroundColor: "transparent",
  },
  artContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.md,
  },
  artwork: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1,
    borderRadius: shape.large,
  },
  artworkPlaceholder: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1,
    borderRadius: shape.large,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContainer: {
    marginVertical: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleTextContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  heartButton: {
    margin: 0,
  },
  actionSurface: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: shape.large,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  starButton: {
    margin: 0,
    width: 36,
    height: 36,
  },
  utilityActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  scrobbledBadge: {
    fontWeight: "600",
  },
  timerBadge: {
    fontWeight: "600",
  },
  chipsScrollView: {
    marginTop: spacing.sm,
  },
  chipsScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  controlChip: {
    height: 32,
    borderRadius: shape.full,
  },
  chipRatingSurface: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: shape.full,
    height: 32,
    paddingHorizontal: spacing.xs,
  },
  starChipButton: {
    margin: 0,
    width: 24,
    height: 24,
  },
  title: {
    marginBottom: spacing.xs,
  },
  artist: {
    marginBottom: spacing.xs,
  },
  album: {
    marginTop: 0,
  },
  progressSection: {
    marginVertical: spacing.sm,
  },
  progressTouchArea: {
    height: spacing.xxl,
    justifyContent: "center",
  },
  progressBar: {
    height: 6,
    borderRadius: shape.extraSmall,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  controlsSurface: {
    borderRadius: shape.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playButton: {
    width: 68,
    height: 48,
    borderRadius: shape.full,
    margin: 0,
  },
  playButtonContainer: {
    width: 68,
    height: 48,
    borderRadius: shape.full,
    alignItems: "center",
    justifyContent: "center",
    margin: 0,
  },
  skipButton: {
    width: 52,
    height: 44,
    borderRadius: shape.full,
    margin: 0,
  },
  secondaryControlButton: {
    width: 46,
    height: 44,
    borderRadius: shape.full,
    margin: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  emptyText: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});

