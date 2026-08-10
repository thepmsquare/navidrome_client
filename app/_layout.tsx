import { layoutStyles } from "@/stylesheets";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  MD3LightTheme as DefaultTheme,
  PaperProvider,
} from "react-native-paper";

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function checkToken() {
      const serverUrl = await SecureStore.getItemAsync("serverUrl");
      const subsonicVersion = await SecureStore.getItemAsync("subsonicVersion");

      setIsLoggedIn(!!serverUrl && !!subsonicVersion);
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
      <View style={layoutStyles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: "tomato",
      secondary: "yellow",
    },
  };
  return (
    <PaperProvider theme={theme}>
      <Slot />
    </PaperProvider>
  );
}
