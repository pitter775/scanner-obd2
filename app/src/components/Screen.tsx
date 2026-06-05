import type { PropsWithChildren } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from './AppButton';
import { colors, spacing } from '../config/theme';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
}>;

export function Screen({ children, scroll = true }: ScreenProps) {
  const route = useRoute();
  const navigation = useNavigation();
  const showNav = route.name !== 'Login';
  const bottomNav = showNav ? <BottomNav activeRoute={route.name} navigate={(name) => navigation.navigate(name as never)} /> : null;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>{children}</View>
        {bottomNav}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      {bottomNav}
    </SafeAreaView>
  );
}

function BottomNav({ activeRoute, navigate }: { activeRoute: string; navigate: (name: string) => void }) {
  const items = [
    ['Bluetooth', 'B', 'BT'],
    ['Dashboard', 'D', 'Dash'],
    ['Diagnostics', '!', 'DTC'],
    ['Vehicles', 'C', 'Carro'],
    ['Debug', 'i', 'Debug'],
  ];

  return (
    <View style={styles.bottomNav}>
      {items.map(([name, icon, label]) => (
        <View key={name} style={styles.navItem}>
          <AppButton compact icon={icon} onPress={() => navigate(name)} tone={activeRoute === name ? 'primary' : 'secondary'}>
            {label}
          </AppButton>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: 96,
  },
  bottomNav: {
    backgroundColor: colors.background,
    borderTopColor: colors.borderStrong,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 6,
    left: 0,
    padding: spacing.xs,
    position: 'absolute',
    right: 0,
  },
  navItem: {
    flex: 1,
  },
});
