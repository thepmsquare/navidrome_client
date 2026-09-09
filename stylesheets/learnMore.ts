import { StyleSheet } from "react-native";

export const learnMoreStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: "4%",
    paddingVertical: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  section: {
    gap: 8,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },

  actions: {
    gap: 8,
    marginTop: 4,
  },
});
