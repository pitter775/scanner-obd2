import { useRoute } from '@react-navigation/native';
import type { PropsWithChildren } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { brand } from '../config/brand';
import { colors, spacing } from '../config/theme';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
}>;

const iconSimple = require('../../assets/brand/icon-simple.png') as ImageSourcePropType;

export function Screen({ children, scroll = true }: ScreenProps) {
  const route = useRoute();
  const showHeader = route.name !== 'Login';
  const content = (
    <>
      {showHeader ? <AppHeader routeName={route.name} /> : null}
      {children}
    </>
  );

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>{content}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>{content}</ScrollView>
    </SafeAreaView>
  );
}

function AppHeader({ routeName }: { routeName: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <Image resizeMode="contain" source={iconSimple} style={styles.headerIcon} />
        <View>
          <Text style={styles.headerAppName}>{brand.appName}</Text>
          <Text style={styles.headerCompany}>{brand.companyName}</Text>
        </View>
      </View>
      <Text style={styles.headerTitle}>{screenTitle(routeName)}</Text>
    </View>
  );
}

function screenTitle(routeName: string) {
  const titles: Record<string, string> = {
    Account: 'Conta',
    Bluetooth: 'Conexão',
    Dashboard: 'Painel',
    Debug: 'Debug',
    Diagnostics: 'Falhas',
    History: 'Histórico',
    Home: 'Início',
  };

  return titles[routeName] ?? routeName;
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
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,24,39,0.86)',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerAppName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  headerBrand: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
  },
  headerCompany: {
    color: colors.primaryGlow,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerIcon: {
    height: 38,
    width: 38,
  },
  headerTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
});
