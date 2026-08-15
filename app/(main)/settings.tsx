import { Surface, Text } from "react-native-paper";

export default function SettingsScreen() {
  return (
    <Surface
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text variant="headlineMedium">settings</Text>
    </Surface>
  );
}
