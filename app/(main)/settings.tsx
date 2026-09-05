import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";

import { logout } from "@/services/api";
import { settingsStyles } from "@/stylesheets";

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();

  async function handleLogout() {
    await logout();
    router.replace("/connect");
  }

  return (
    <Surface style={settingsStyles.page}>
      <ScrollView contentContainerStyle={settingsStyles.scrollContent}>
        <Text variant="displaySmall">settings</Text>

        <Button
          mode="contained"
          onPress={handleLogout}
          buttonColor={theme.colors.error}
          textColor={theme.colors.onError}
        >
          log out
        </Button>
      </ScrollView>
    </Surface>
  );
}
