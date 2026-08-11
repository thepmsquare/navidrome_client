import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Alert, View } from "react-native";
import {
  Button,
  MD3Colors,
  ProgressBar,
  Surface,
  Text,
  TextInput,
} from "react-native-paper";

import { login, ping } from "@/services/api";
import { connectStyles } from "@/stylesheets";
import { ConnectStage } from "@/types";

export default function ConnectScreen() {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectStage, setConnectStage] = useState<ConnectStage>("ping");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
      setConnectStage("login");
    } catch (error: any) {
      Alert.alert("ping failed", error.message || "could not ping");
    } finally {
      setLoading(false);
    }
  }
  async function handleLogin() {
    if (!username || !password) {
      Alert.alert("error", "please fill in all fields");
      return;
    }
    setLoading(true);

    try {
      let loginResponse = await login({
        serverUrl,
        username,
        password,
      });
      console.log("logged in successfully", loginResponse);
    } catch (error: any) {
      Alert.alert("login failed", error.message || "could not login");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Surface style={connectStyles.page}>
      <Text variant="displaySmall">connect / login screen</Text>

      {connectStage === "ping" ? (
        <Surface style={connectStyles.container} elevation={2}>
          <View style={{ width: "100%", marginVertical: 16 }}>
            <ProgressBar progress={0.5} color={MD3Colors.error50} />
          </View>
          <TextInput
            style={connectStyles.input}
            label="server url"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
          />

          <Button
            mode="contained"
            onPress={handlePing}
            disabled={loading}
            style={connectStyles.button}
          >
            {loading ? "loading..." : "ping"}
          </Button>
        </Surface>
      ) : (
        <Surface style={connectStyles.container} elevation={2}>
          <View style={{ width: "100%", marginVertical: 16 }}>
            <ProgressBar progress={0.99} color={MD3Colors.error50} />
          </View>
          <TextInput
            style={connectStyles.input}
            label="username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={connectStyles.input}
            label="password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            disabled={loading}
            style={connectStyles.button}
          >
            {loading ? "loading..." : "login"}
          </Button>
        </Surface>
      )}
    </Surface>
  );
}
