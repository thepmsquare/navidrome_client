import { StyleSheet } from "react-native";

export const miniPlayerStyles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  progressBar: {
    height: 2.5,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 56,
  },
  trackPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  artworkPlaceholder: {
    borderRadius: 8,
  },
  infoContainer: {
    flex: 1,
    marginHorizontal: 12,
    justifyContent: "center",
  },
  title: {
    fontWeight: "600",
  },
  subtitle: {
    marginTop: 1,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    margin: 0,
  },
  bufferingIndicator: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});
