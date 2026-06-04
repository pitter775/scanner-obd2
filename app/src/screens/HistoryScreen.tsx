import { StyleSheet, Text } from 'react-native';

import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { colors } from '../config/theme';

export function HistoryScreen() {
  return (
    <Screen>
      <Panel title="Historico">
        <Text style={styles.text}>
          A estrutura do banco ja esta pronta. A listagem das sessoes sera ligada ao Supabase na proxima etapa.
        </Text>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
