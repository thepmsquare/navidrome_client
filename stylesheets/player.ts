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
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  playButton: {
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

