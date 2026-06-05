import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '../config/theme';
import { useAppStore } from '../store/appStore';
import { AppButton } from './AppButton';

type BottomNavProps = {
  activeRoute?: string;
  onNavigate: (name: string) => void;
};

export function BottomNav({ activeRoute, onNavigate }: BottomNavProps) {
  const connectionReady = useAppStore((state) => state.connectionReady);
  const items = [
    { icon: 'bluetooth', label: 'Conexão', name: 'Bluetooth' },
    { icon: 'gauge', label: 'Painel', name: 'Dashboard', requiresConnection: true },
    { icon: 'shield-alert', label: 'Falhas', name: 'Diagnostics', requiresConnection: true },
    { icon: 'chart', label: 'Hist.', name: 'History' },
    { icon: 'bug', label: 'Debug', name: 'Debug' },
  ] as const;

  if (!activeRoute || activeRoute === 'Login') {
    return null;
  }

  return (
    <View style={styles.bottomNav}>
      {items.map((item) => (
        <View key={item.name} style={styles.navItem}>
          <AppButton
            compact
            disabled={'requiresConnection' in item && item.requiresConnection && !connectionReady}
            icon={item.icon}
            onPress={() => onNavigate(item.name)}
            tone={activeRoute === item.name ? 'primary' : 'secondary'}
          >
            {item.label}
          </AppButton>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    backgroundColor: colors.background,
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
