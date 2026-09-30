import { ScrollView } from "react-native";
import { Surface, Text } from "react-native-paper";

import { homeStyles } from "@/stylesheets";

export default function HomeScreen() {
  return (
    <Surface style={homeStyles.page}>
      <ScrollView contentContainerStyle={homeStyles.scrollContent}>
        <Text variant="titleLarge">home</Text>
      </ScrollView>
    </Surface>
  );
}
