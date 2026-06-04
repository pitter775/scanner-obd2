import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Panel } from '../components/Panel';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../config/theme';
import { isSupabaseConfigured } from '../config/env';
import { supabase } from '../lib/supabase/client';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!isSupabaseConfigured) {
      navigation.replace('Home');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Login', error.message);
      return;
    }

    navigation.replace('Home');
  }

  async function signUp() {
    if (!isSupabaseConfigured) {
      Alert.alert('Supabase', 'Configure as variaveis EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Cadastro', error.message);
      return;
    }

    Alert.alert('Cadastro', 'Conta criada. Verifique o email se a confirmacao estiver ativa.');
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.brand}>Scanner Automotivo OBD2</Text>
        <Text style={styles.subtitle}>ELM327 PIC18F25K80 v1.5</Text>
      </View>

      <Panel
        subtitle={isSupabaseConfigured ? 'Entre para salvar diagnosticos na nuvem.' : 'Modo local liberado ate configurar o Supabase.'}
        title="Acesso"
      >
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
          Entrar
        </AppButton>
        <AppButton disabled={loading} onPress={signUp} tone="secondary">
          Criar conta
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
