import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { brand } from '../config/brand';
import { TextField } from '../components/TextField';
import { colors } from '../config/theme';
import { requestBluetoothPermissions } from '../services/bluetoothService';
import { useAppStore } from '../store/appStore';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
const iconSimple = require('../../assets/brand/icon-simple.png') as ImageSourcePropType;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState(`teste@${brand.emailDomain}`);
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const setActiveAdapter = useAppStore((state) => state.setActiveAdapter);
  const setConnectionReady = useAppStore((state) => state.setConnectionReady);
  const setMockMode = useAppStore((state) => state.setMockMode);

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
        'Permissões',
        `Para testar o adaptador OBD2, permita o Bluetooth quando o Android solicitar. Também dá para liberar em Configurações > Apps > ${brand.appName} > Permissões.`,
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

    if (isMockLogin(credentials.email, credentials.password)) {
      startMockDashboard();
      return;
    }

    setMockMode(false);
    navigation.replace('Bluetooth');
  }

  async function signUp() {
    const credentials = validateCredentials();
    if (!credentials) {
      return;
    }

    setMockMode(false);
    navigation.replace('Bluetooth');
  }

  function enterTestMode() {
    startMockDashboard();
  }

  function startMockDashboard() {
    setMockMode(true);
    setActiveAdapter({
      address: 'MOCK-DESKTOP',
      id: 'mock-obd2',
      name: 'OBD2 Mock Desktop',
    });
    setConnectionReady(true);
    navigation.replace('Dashboard');
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logoMarkWrap}>
          <View style={styles.logoGlow} />
          <Image resizeMode="contain" source={iconSimple} style={styles.logoMark} />
        </View>
        <View style={styles.wordmark}>
          <Text style={styles.wordInfra}>Infra</Text>
          <Text style={styles.wordScan}>Scan</Text>
          <Text style={styles.wordObd}>OBD</Text>
        </View>
        <Text style={styles.subtitle}>by {brand.companyName}</Text>
        <Text style={styles.tagline}>Diagnóstico OBD2 Bluetooth</Text>
      </View>

      <Panel
        subtitle={permissionsReady ? 'Permissões prontas para testar o scanner.' : 'Antes de testar, libere as permissões do Bluetooth.'}
        title="Teste inicial"
      >
        <AppButton disabled={loading} icon="bluetooth" onPress={preparePermissions} tone={permissionsReady ? 'secondary' : 'primary'}>
          {permissionsReady ? 'Permissões liberadas' : 'Preparar permissões'}
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
        <AppButton disabled={loading} icon="login" onPress={signIn}>
          Entrar e testar
        </AppButton>
        <AppButton disabled={loading} icon="user-plus" onPress={signUp} tone="secondary">
          Criar conta depois
        </AppButton>
        <AppButton disabled={loading} icon="zap" onPress={enterTestMode} tone="secondary">
          Entrar modo teste
        </AppButton>
      </Panel>
    </Screen>
  );
}

function isMockLogin(email: string, password: string) {
  return ['pitter', 'peter'].includes(email.toLowerCase()) && password === '494601';
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: 24,
  },
  logoGlow: {
    backgroundColor: colors.primaryGlow,
    borderRadius: 80,
    height: 128,
    opacity: 0.16,
    position: 'absolute',
    width: 128,
  },
  logoMark: {
    height: 118,
    width: 118,
  },
  logoMarkWrap: {
    alignItems: 'center',
    height: 130,
    justifyContent: 'center',
    width: 130,
  },
  wordmark: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 1,
    marginTop: 4,
  },
  wordInfra: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    textShadowColor: 'rgba(248,250,252,0.35)',
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 10,
  },
  wordObd: {
    color: colors.primaryGlow,
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 5,
  },
  wordScan: {
    color: colors.electric,
    fontSize: 32,
    fontWeight: '900',
    textShadowColor: 'rgba(56,189,248,0.38)',
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  tagline: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
});
