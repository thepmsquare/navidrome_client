import { Slot, useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function checkToken() {
      const token = await SecureStore.getItemAsync("user_token");
      setIsLoggedIn(!!token);
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
}
