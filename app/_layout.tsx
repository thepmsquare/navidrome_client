import { Slot, useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { ActivityIndicator, PaperProvider } from "react-native-paper";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { layoutStyles } from "@/stylesheets";

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function checkToken() {
      const serverUrl = await SecureStore.getItemAsync("serverUrl");
      const subsonicVersion = await SecureStore.getItemAsync("subsonicVersion");
      const username = await SecureStore.getItemAsync("username");
      const password = await SecureStore.getItemAsync("password");

      setIsLoggedIn(
        !!serverUrl && !!subsonicVersion && !!username && !!password,
      );
      setIsLoading(false);
    }

    checkToken();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const onConnectPage = segments[0] === "connect";

    if (!isLoggedIn && !onConnectPage) {
      router.replace("/connect");
    } else if (isLoggedIn && onConnectPage) {
      router.replace("/");
    }
  }, [isLoggedIn, isLoading, segments, router]);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <PaperProvider>
          <SafeAreaView style={layoutStyles.container}>
            <ActivityIndicator size="large" />
          </SafeAreaView>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <SafeAreaView style={layoutStyles.safeArea}>
          <Slot />
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
