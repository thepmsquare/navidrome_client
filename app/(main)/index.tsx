import { ScrollView, View } from "react-native";
import { Surface, Text } from "react-native-paper";

import { HOME_SECTIONS } from "@/components/home";
import { homeStyles } from "@/stylesheets";

export default function HomeScreen() {
  return (
    <Surface style={homeStyles.page}>
      <ScrollView contentContainerStyle={homeStyles.scrollContent}>
        <View style={homeStyles.headerContainer}>
          <Text variant="titleLarge">home</Text>
        </View>

        {HOME_SECTIONS.map((section) => {
          const SectionComponent = section.component;
          return <SectionComponent key={section.id} />;
        })}
      </ScrollView>
    </Surface>
  );
}
