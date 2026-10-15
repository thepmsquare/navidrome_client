import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Surface, Text } from "react-native-paper";

import { HOME_SECTIONS } from "@/components/home";
import { client_app_sync } from "@/services/api";
import { homeStyles } from "@/stylesheets";
import { useAppTheme } from "@/types";

export default function HomeScreen() {
  const theme = useAppTheme();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    client_app_sync(false)
      .catch((err) => {
        console.error("failed to refresh home:", err);
      })
      .finally(() => {
        setRefreshing(false);
      });
  }, []);

  return (
    <Surface style={homeStyles.page}>
      <ScrollView
        contentContainerStyle={homeStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.surfaceContainerHighest}
          />
        }
      >
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
