import { Alert, StyleSheet, Text } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors } from '../config/theme';
import { isSupabaseConfigured } from '../config/env';
import { supabase } from '../lib/supabase/client';

export function AccountScreen() {
  async function signOut() {
    if (!isSupabaseConfigured) {
      Alert.alert('Conta', 'Supabase ainda nao configurado.');
      return;
    }

    await supabase.auth.signOut();
    Alert.alert('Conta', 'Sessao encerrada.');
  }

  return (
    <Screen>
      <Panel title="Plano atual">
        <Text style={styles.plan}>Free</Text>
        <Text style={styles.text}>Base pronta para evoluir assinatura Pro e Oficina.</Text>
      </Panel>

      <Panel title="Sessao">
        <AppButton onPress={signOut} tone="secondary">Sair</AppButton>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plan: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  text: {
    color: colors.muted,
    fontSize: 15,
  },
});
