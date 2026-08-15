import { Tabs } from "expo-router";
import { BottomNavigation, Icon } from "react-native-paper";

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={({ navigation, state, descriptors, insets }) => (
        <BottomNavigation.Bar
          navigationState={state}
          safeAreaInsets={insets}
          onTabPress={({ route, preventDefault }) => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          }}
          renderIcon={({ route, focused, color }) => {
            const { options } = descriptors[route.key];
            if (options.tabBarIcon) {
              return options.tabBarIcon({ focused, color, size: 24 });
            }
            return null;
          }}
          getLabelText={({ route }) => {
            const { options } = descriptors[route.key];
            return (
              options.title ??
              (typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : route.name)
            );
          }}
        />
      )}
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
