import { StyleSheet } from "react-native";

export const playlistDetailStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  playlistInfoContainer: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  coverArt: {
    width: 180,
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
  },
  playlistName: {
    textAlign: "center",
    fontWeight: "bold",
  },
  commentText: {
    textAlign: "center",
    opacity: 0.8,
  },
  metaText: {
    textAlign: "center",
    opacity: 0.7,
  },
  trackNumber: {
    width: 32,
    textAlign: "center",
    opacity: 0.6,
  },
  trackItem: {
    paddingVertical: 4,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 32,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
