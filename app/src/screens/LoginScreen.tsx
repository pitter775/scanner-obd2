import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../config/theme';
import { requestBluetoothPermissions } from '../services/bluetoothService';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('teste@scannerobd2.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);

  useEffect(() => {
    void preparePermissions();
  }, []);

  async function preparePermissions() {
    setLoading(true);
    try {
      await requestBluetoothPermissions();
      setPermissionsReady(true);
    } catch {
      setPermissionsReady(false);
      Alert.alert(
        'Permissoes',
        'Para testar o adaptador OBD2, permita o Bluetooth quando o Android solicitar. Tambem da para liberar em Configuracoes > Apps > Scanner OBD2 > Permissoes.',
      );
    } finally {
      setLoading(false);
    }
  }

  function validateCredentials() {
    const nextEmail = email.trim();
    const nextPassword = password.trim();

    if (!nextEmail || !nextPassword) {
      Alert.alert('Login', 'Informe email e senha.');
      return null;
    }

    if (nextPassword.length < 6) {
      Alert.alert('Login', 'A senha precisa ter pelo menos 6 caracteres.');
      return null;
    }

    return { email: nextEmail, password: nextPassword };
  }

  async function signIn() {
    const credentials = validateCredentials();
    if (!credentials) {
      return;
    }

    navigation.replace('Bluetooth');
  }

  async function signUp() {
    const credentials = validateCredentials();
    if (!credentials) {
      return;
    }

    navigation.replace('Bluetooth');
  }

  function enterTestMode() {
    navigation.replace('Bluetooth');
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.brand}>Scanner Automotivo OBD2</Text>
        <Text style={styles.subtitle}>Adaptador OBD2 Bluetooth</Text>
      </View>

      <Panel
        subtitle={permissionsReady ? 'Permissoes prontas para testar o scanner.' : 'Antes de testar, libere as permissoes do Bluetooth.'}
        title="Teste inicial"
      >
        <AppButton disabled={loading} onPress={preparePermissions} tone={permissionsReady ? 'secondary' : 'primary'}>
          {permissionsReady ? 'Permissoes liberadas' : 'Preparar permissoes'}
        </AppButton>
        <TextField
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="seu@email.com"
          value={email}
        />
        <TextField
          label="Senha"
          onChangeText={setPassword}
          placeholder="minimo 6 caracteres"
          secureTextEntry
          value={password}
        />
        <AppButton disabled={loading} onPress={signIn}>
          Entrar e testar
        </AppButton>
        <AppButton disabled={loading} onPress={signUp} tone="secondary">
          Criar conta depois
        </AppButton>
        <AppButton disabled={loading} onPress={enterTestMode} tone="secondary">
          Entrar modo teste
        </AppButton>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: 24,
  },
  brand: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
});
