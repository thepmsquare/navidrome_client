import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Button, Surface, Text } from "react-native-paper";

import { logout } from "@/services/api";
import { exportBackupToFile } from "@/services/backup";
import { settingsStyles } from "@/stylesheets";
import { useAppTheme } from "@/types";

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [exporting, setExporting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function performLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/connect");
    } catch (error: any) {
      Alert.alert("error", error?.message || "failed to log out");
    } finally {
      setLoggingOut(false);
    }
  }

  function handleLogout() {
    Alert.alert(
      "log out",
      "are you sure you want to log out?",
      [
        {
          text: "cancel",
          style: "cancel",
        },
        {
          text: "log out",
          style: "destructive",
          onPress: performLogout,
        },
      ],
      { cancelable: true },
    );
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
        <Text variant="titleLarge">settings</Text>

        <Surface
          elevation={0}
          style={[
            settingsStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
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
            disabled={exporting || loggingOut}
            icon="file-export"
          >
            export profile
          </Button>
        </Surface>

        <Surface
          elevation={0}
          style={[
            settingsStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">account</Text>

          <Button
            mode="outlined"
            onPress={handleLogout}
            loading={loggingOut}
            disabled={loggingOut}
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
