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
    gap: 12,
    justifyContent: "space-between",
  },
  countCard: {
    flex: 1,
  },
});
