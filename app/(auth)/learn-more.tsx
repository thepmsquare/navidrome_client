import { useRouter } from "expo-router";
import { Alert, Linking, ScrollView, View } from "react-native";
import { Appbar, Button, Surface, Text } from "react-native-paper";

import { learnMoreStyles } from "@/stylesheets";
import { useAppTheme } from "@/types";

export default function LearnMoreScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  async function openUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("error", "could not open link");
    }
  }

  return (
    <Surface style={learnMoreStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="learn more" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={learnMoreStyles.scrollContent}>
        <Surface
          elevation={0}
          style={[
            learnMoreStyles.card,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">what is navidrome?</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            navidrome lets you turn your personal music collection into your own
            private streaming service. instead of paying for a music
            subscription, you keep your songs on your computer or home storage
            and stream them wherever you go.
          </Text>
        </Surface>

        <Surface
          elevation={0}
          style={[
            learnMoreStyles.card,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">what is this client app?</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            this app is a mobile music player made specifically to connect to
            your navidrome music collection. once connected, you can browse your
            library, play songs and listen to your music directly on your phone.
          </Text>
        </Surface>

        <Surface
          elevation={0}
          style={[
            learnMoreStyles.card,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">getting started</Text>
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

        <Surface
          elevation={0}
          style={[
            learnMoreStyles.card,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
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
        </Surface>
      </ScrollView>
    </Surface>
  );
}
