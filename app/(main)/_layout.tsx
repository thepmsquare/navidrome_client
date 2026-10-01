import { Tabs } from "expo-router";
import { Icon } from "react-native-paper";

import { AppBottomBar } from "@/components/AppBottomBar";

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <AppBottomBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "home",
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              source={focused ? "home" : "home-outline"}
              size={size}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "library",
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              source={
                focused ? "music-box-multiple" : "music-box-multiple-outline"
              }
              size={size}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "search",
          tabBarIcon: ({ color, size }) => (
            <Icon
              source="magnify"
              size={size}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: "sync",
          tabBarIcon: ({ color, size }) => (
            <Icon
              source="sync"
              size={size}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "settings",
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              source={focused ? "cog" : "cog-outline"}
              size={size}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
    </Tabs>
  );
}
