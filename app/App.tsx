import 'react-native-url-polyfill/auto';

import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomNav } from './src/components/BottomNav';
import { AppNavigator } from './src/navigation/AppNavigator';
import { installConsoleDiagnostics } from './src/services/diagnosticLog';
import type { RootStackParamList } from './src/types/navigation';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const [activeRoute, setActiveRoute] = useState<string>();

  useEffect(() => {
    installConsoleDiagnostics();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer
        onReady={() => setActiveRoute(navigationRef.getCurrentRoute()?.name)}
        onStateChange={() => setActiveRoute(navigationRef.getCurrentRoute()?.name)}
        ref={navigationRef}
      >
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <BottomNav
          activeRoute={activeRoute}
          onNavigate={(name) => {
            if (navigationRef.isReady()) {
              navigationRef.navigate(name as never);
            }
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}
