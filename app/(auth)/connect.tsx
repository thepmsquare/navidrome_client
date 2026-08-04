import { ping } from "@/services/api";
import { connectStyles } from "@/stylesheets";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";

export default function ConnectScreen() {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  async function handlePing() {
    if (!serverUrl) {
      Alert.alert("error", "please fill in all fields");
      return;
    }
    setLoading(true);

    try {
      let pingResponse = await ping(serverUrl);
      await SecureStore.setItemAsync("subsonicVersion", pingResponse.version);
      await SecureStore.setItemAsync("serverUrl", serverUrl);
      router.replace("/");
    } catch (error: any) {
      Alert.alert("ping failed", error.message || "could not ping");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={connectStyles.container}>
      <Text style={connectStyles.title}>connect / login screen</Text>
      <TextInput
        style={connectStyles.input}
        placeholder="server url "
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
      />
      <Button
        title={loading ? "loading..." : "ping"}
        onPress={handlePing}
        disabled={loading}
      />
    </View>
  );
}
