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
        <Text variant="headlineMedium">settings</Text>

        <Surface elevation={1} style={settingsStyles.sectionCard}>
          <Text variant="titleMedium">data</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            export your server connection details and preferences as a backup
            file. you can import this on another device from the connect screen.
          </Text>
          <Button
            mode="outlined"
            onPress={handleExport}
            loading={exporting}
            disabled={exporting}
            icon="file-export"
          >
            export profile
          </Button>
        </Surface>

        <Surface elevation={1} style={settingsStyles.sectionCard}>
          <Text variant="titleMedium">account</Text>

          <Button
            mode="outlined"
            onPress={handleLogout}
            textColor={theme.colors.error}
            style={{ borderColor: theme.colors.error }}
          >
            log out
          </Button>
        </Surface>
      </ScrollView>
    </Surface>
  );
}
