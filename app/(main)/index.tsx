import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, Text, View } from "react-native";

import { getArtistAlbumSongCounts } from "@/services/api";
import { homeStyles } from "@/stylesheets";
import { Search3Counts } from "@/types";

export default function HomeScreen() {
  const router = useRouter();
  const [subsonicVersion, setSubsonicVersion] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [counts, setCounts] = useState<Search3Counts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      const version = await SecureStore.getItemAsync("subsonicVersion");
      const url = await SecureStore.getItemAsync("serverUrl");
      const user = await SecureStore.getItemAsync("username");
      setSubsonicVersion(version);
      setServerUrl(url);
      setUsername(user);

      try {
        setLoadingCounts(true);
        const countsData = await getArtistAlbumSongCounts();
        setCounts(countsData);
      } catch (error) {
        console.error("failed to fetch counts:", error);
      } finally {
        setLoadingCounts(false);
      }
    }

    loadData();
  }, []);

  async function handleLogout() {
    await SecureStore.deleteItemAsync("subsonicVersion");
    await SecureStore.deleteItemAsync("serverUrl");
    await SecureStore.deleteItemAsync("username");
    await SecureStore.deleteItemAsync("password");
    router.replace("/connect");
  }

  return (
    <View style={homeStyles.container}>
      <Text style={homeStyles.title}>welcome home! 🎉</Text>
      <Text style={homeStyles.subtitle}>you are currently logged in.</Text>

      <Text style={homeStyles.label}>username</Text>
      <Text style={homeStyles.value}>{username}</Text>
      <Text style={homeStyles.label}>subsonic version</Text>
      <Text style={homeStyles.value}>{subsonicVersion}</Text>
      <Text style={homeStyles.label}>server url</Text>
      <Text style={homeStyles.value}>{serverUrl}</Text>

      <Text style={homeStyles.sectionTitle}>library stats</Text>
      {loadingCounts ? (
        <View style={{ marginVertical: 16, alignItems: "center" }}>
          <ActivityIndicator size="small" />
          <Text style={homeStyles.statLabel}>loading stats...</Text>
        </View>
      ) : (
        <View style={homeStyles.statsContainer}>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statNumber}>
              {counts?.artistCount ?? 0}
            </Text>
            <Text style={homeStyles.statLabel}>artists</Text>
          </View>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statNumber}>{counts?.albumCount ?? 0}</Text>
            <Text style={homeStyles.statLabel}>albums</Text>
          </View>
          <View style={homeStyles.statCard}>
            <Text style={homeStyles.statNumber}>{counts?.songCount ?? 0}</Text>
            <Text style={homeStyles.statLabel}>songs</Text>
          </View>
        </View>
      )}

      <Button title="log out" color="#d9534f" onPress={handleLogout} />
    </View>
  );
}
