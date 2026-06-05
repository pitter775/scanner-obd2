import { Alert, StyleSheet, Text } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors } from '../config/theme';

export function AccountScreen() {
  async function signOut() {
    Alert.alert('Conta', 'Modo teste ativo. Nao ha sessao online para encerrar.');
  }

  return (
    <Screen>
      <Panel title="Plano atual">
        <Text style={styles.plan}>Free</Text>
        <Text style={styles.text}>Base pronta para evoluir assinatura Pro e Oficina.</Text>
      </Panel>

      <Panel title="Sessao">
        <AppButton icon="logout" onPress={signOut} tone="secondary">Sair</AppButton>
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
