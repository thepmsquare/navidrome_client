import { Stack, useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import {
  ActivityIndicator,
  MD3DarkTheme,
  MD3LightTheme,
  Provider as PaperProvider,
} from "react-native-paper";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { layoutStyles } from "@/stylesheets";
import { useMaterial3Theme } from "@pchmn/expo-material3-theme";

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const { theme } = useMaterial3Theme();

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

    const onConnectPage = (segments as string[]).includes("connect");

    if (!isLoggedIn && !onConnectPage) {
      router.replace("/connect");
    } else if (isLoggedIn && onConnectPage) {
      router.replace("/");
    }
  }, [isLoggedIn, isLoading, segments, router]);

  const paperTheme = useMemo(
    () =>
      colorScheme === "dark"
        ? { ...MD3DarkTheme, colors: theme.dark }
        : { ...MD3LightTheme, colors: theme.light },
    [colorScheme, theme],
  );

  const onConnectPage = (segments as string[]).includes("connect");
  const routeMatchesAuth =
    (!isLoggedIn && onConnectPage) || (isLoggedIn && !onConnectPage);
  const showSpinner = isLoading || !routeMatchesAuth;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <SafeAreaView style={layoutStyles.safeArea}>
          {showSpinner ? (
            <SafeAreaView style={layoutStyles.container}>
              <ActivityIndicator size="large" />
            </SafeAreaView>
          ) : (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(main)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen
                name="player"
                options={{
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />
            </Stack>
          )}
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

