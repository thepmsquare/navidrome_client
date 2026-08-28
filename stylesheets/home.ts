import { StyleSheet } from "react-native";

export const homeStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: "2.5%",
    paddingVertical: 24,
    gap: 16,
  },
  countsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  countCard: {
    width: "48%",
  },
});
