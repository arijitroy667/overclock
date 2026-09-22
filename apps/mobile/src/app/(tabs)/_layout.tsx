import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/theme';

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Now', tabBarIcon: ({ color }) => <Ionicons name="flash-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="energy" options={{ title: 'Energy', tabBarIcon: ({ color }) => <Ionicons name="battery-half-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: ({ color }) => <Ionicons name="leaf-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} /> }} />
    </Tabs>
  );
}
