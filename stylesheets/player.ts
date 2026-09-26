import { StyleSheet } from "react-native";

import { spacing } from "@/utils/spacing";

export const playerStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: spacing.xxl,
  },
  artContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.md,
  },
  artwork: {
    width: "100%",
    maxWidth: 340,
    aspectRatio: 1,
    borderRadius: 16,
  },
  artworkPlaceholder: {
    width: "100%",
    maxWidth: 340,
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContainer: {
    marginVertical: spacing.sm + spacing.xs,
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
    borderRadius: 16,
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
    width: 32,
    height: 32,
  },
  utilityActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  scrobbledBadge: {
    fontWeight: "600",
    opacity: 0.8,
  },
  cacheButtonContainer: {
    marginTop: spacing.sm,
    alignItems: "flex-start",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  cacheButton: {
    marginLeft: -spacing.sm,
  },
  cacheButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  cacheButtonLabel: {
    textTransform: "lowercase",
  },
  title: {
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  artist: {
    fontWeight: "500",
    marginBottom: spacing.xs / 2,
  },
  album: {
    marginTop: spacing.xs / 2,
  },
  progressSection: {
    marginVertical: spacing.sm + spacing.xs,
  },
  progressTouchArea: {
    paddingVertical: spacing.sm,
    justifyContent: "center",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
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

