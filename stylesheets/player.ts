import { StyleSheet } from "react-native";

export const playerStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  headerTitle: {
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 48,
  },
  artContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
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
    marginVertical: 12,
  },
  title: {
    fontWeight: "700",
    marginBottom: 4,
  },
  artist: {
    fontWeight: "500",
    marginBottom: 2,
  },
  album: {
    marginTop: 2,
  },
  progressSection: {
    marginVertical: 12,
  },
  progressTouchArea: {
    paddingVertical: 8,
    justifyContent: "center",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 16,
  },
  playButton: {
    margin: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 24,
  },
});
