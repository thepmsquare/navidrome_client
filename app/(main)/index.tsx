import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Button, Text, View } from "react-native";

import { homeStyles } from "@/stylesheets";

export default function HomeScreen() {
  const router = useRouter();
  const [subsonicVersion, setSubsonicVersion] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const version = await SecureStore.getItemAsync("subsonicVersion");
      const url = await SecureStore.getItemAsync("serverUrl");
      setSubsonicVersion(version);
      setServerUrl(url);
    }

    loadData();
  }, []);

  async function handleLogout() {
    await SecureStore.deleteItemAsync("subsonicVersion");
    await SecureStore.deleteItemAsync("serverUrl");
    router.replace("/connect");
  }

  return (
    <View style={homeStyles.container}>
      <Text style={homeStyles.title}>welcome home! 🎉</Text>
      <Text style={homeStyles.subtitle}>you are currently logged in.</Text>
      <Text>subsonic version</Text>
      <Text>{subsonicVersion}</Text>
      <Text>server url</Text>
      <Text>{serverUrl}</Text>
      <Button title="log out" color="#d9534f" onPress={handleLogout} />
    </View>
  );
}
