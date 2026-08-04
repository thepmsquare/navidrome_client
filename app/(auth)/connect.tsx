import { useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";

// import { useRouter } from "expo-router";
import { ping } from "@/services/api";

export default function ConnectScreen() {
  // const router = useRouter();
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  async function handlePing() {
    if (!serverUrl) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    // router.replace("/");
    try {
      let pingResponse = await ping(serverUrl);
      console.log(pingResponse);
    } catch (error: any) {
      Alert.alert("ping failed", error.message || "could not ping");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect / Login Screen</Text>
      <TextInput
        style={styles.input}
        placeholder="Server URL "
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
});
