import { StyleSheet } from "react-native";

export const connectStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-around",
    paddingHorizontal: "2.5%",
    paddingVertical: 24,
  },
  brandingGroup: {
    alignItems: "center",
    gap: 12,
  },
  formGroup: {
    gap: 12,
  },
  dummyGroup: {
    height: 200,
    width: "100%",
    borderRadius: 16,
  },
  form: { padding: "2.5%", borderRadius: 16, gap: 16, paddingVertical: 16 },
  icon: {
    width: 96,
    height: 96,
    alignSelf: "center",
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  appName: {
    textAlign: "center",
  },
  appSubtitle: {
    textAlign: "center",
  },
  inputActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: -8,
  },
  serverInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  serverInfoText: {
    flex: 1,
  },
});
