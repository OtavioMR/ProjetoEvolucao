import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';

import { useTheme } from '../../src/shared/theme/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabs: { name: string; title: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
    { name: 'index', title: 'Hoje', icon: 'grid-outline' },
    { name: 'nutrition', title: 'Alimentação', icon: 'restaurant-outline' },
    { name: 'training', title: 'Treinos', icon: 'barbell-outline' },
    { name: 'progress', title: 'Evolução', icon: 'trending-up-outline' },
    { name: 'more', title: 'Mais', icon: 'ellipsis-horizontal' },
  ];
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.secondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 62 + Math.max(insets.bottom, 8),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ focused, size }) => (
              <Ionicons
                name={tab.icon}
                color={focused ? colors.accent : colors.secondary}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
