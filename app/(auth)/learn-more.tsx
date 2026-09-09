import { useRouter } from "expo-router";
import { Alert, Linking, ScrollView, View } from "react-native";
import {
  Button,
  IconButton,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

import { learnMoreStyles } from "@/stylesheets";

export default function LearnMoreScreen() {
  const router = useRouter();
  const theme = useTheme();

  async function openUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("error", "could not open link");
    }
  }

  return (
    <Surface style={learnMoreStyles.page}>
      <ScrollView contentContainerStyle={learnMoreStyles.scrollContent}>
        <View style={learnMoreStyles.headerRow}>
          <IconButton
            icon="arrow-left"
            onPress={() => router.back()}
            accessibilityLabel="go back"
          />
          <Text variant="headlineSmall">learn more</Text>
        </View>

        <View style={learnMoreStyles.section}>
          <Text variant="titleMedium">what is navidrome?</Text>
          <Surface elevation={1} style={learnMoreStyles.card}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              navidrome lets you turn your personal music collection into your
              own private streaming service. instead of paying for a music
              subscription, you keep your songs on your computer or home storage
              and stream them wherever you go.
            </Text>
          </Surface>
        </View>

        <View style={learnMoreStyles.section}>
          <Text variant="titleMedium">what is this client app?</Text>
          <Surface elevation={1} style={learnMoreStyles.card}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              this app is a mobile music player made specifically to connect to
              your navidrome music collection. once connected, you can browse
              your library, play songs and listen to your music directly on your
              phone.
            </Text>
          </Surface>
        </View>

        <View style={learnMoreStyles.section}>
          <Text variant="titleMedium">getting started</Text>
          <Surface elevation={1} style={learnMoreStyles.card}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              1. set up navidrome on your computer or home storage with your
              music.{"\n"}
              2. open this app and enter your server address, username, and
              password.{"\n"}
              3. start enjoying your music. you can also try out the demo on the
              connect screen anytime.
            </Text>
          </Surface>
        </View>

        <View style={learnMoreStyles.section}>
          <Text variant="titleMedium">useful links</Text>
          <View style={learnMoreStyles.actions}>
            <Button
              mode="outlined"
              icon="book-open-outline"
              onPress={() => openUrl("https://www.navidrome.org/docs/")}
            >
              documentation
            </Button>
            <Button
              mode="outlined"
              icon="web"
              onPress={() => openUrl("https://www.navidrome.org")}
            >
              navidrome website
            </Button>
            <Button
              mode="outlined"
              icon="github"
              onPress={() => openUrl("https://github.com/navidrome/navidrome")}
            >
              github repository
            </Button>
          </View>
        </View>
      </ScrollView>
    </Surface>
  );
}
