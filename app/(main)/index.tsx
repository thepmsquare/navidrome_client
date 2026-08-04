import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Button, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();

  async function handleLogout() {
    await SecureStore.deleteItemAsync("user_token");

    router.replace("/connect");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Home! 🎉</Text>
      <Text style={styles.subtitle}>You are currently logged in.</Text>

      <Button title="Log Out" color="#d9534f" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
});
