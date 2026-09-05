import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";

import { logout } from "@/services/api";
import { exportBackupToFile } from "@/services/backup";
import { settingsStyles } from "@/stylesheets";

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [exporting, setExporting] = useState(false);

  async function handleLogout() {
    await logout();
    router.replace("/connect");
  }

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportBackupToFile();
      if (result.success) {
        Alert.alert("success", "backup exported successfully");
      } else if (!result.cancelled) {
        Alert.alert("error", result.error || "failed to export backup");
      }
    } catch (error: any) {
      Alert.alert("error", error?.message || "failed to export backup");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Surface style={settingsStyles.page}>
      <ScrollView contentContainerStyle={settingsStyles.scrollContent}>
        <Text variant="displaySmall">settings</Text>

        <Button
          mode="outlined"
          onPress={handleExport}
          loading={exporting}
          disabled={exporting}
          icon="file-export"
        >
          export
        </Button>

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
