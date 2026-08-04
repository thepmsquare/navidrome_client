import { login, ping } from "@/services/api";
import { connectStyles } from "@/stylesheets";
import { ConnectStage } from "@/types";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";

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
    <View style={connectStyles.container}>
      <Text style={connectStyles.title}>connect / login screen</Text>
      {connectStage === "ping" ? (
        <>
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
        </>
      ) : (
        <>
          <TextInput
            style={connectStyles.input}
            placeholder="username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={connectStyles.input}
            placeholder="password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
          />
          <Button
            title={loading ? "loading..." : "login"}
            onPress={handleLogin}
            disabled={loading}
          />
        </>
      )}
    </View>
  );
}
