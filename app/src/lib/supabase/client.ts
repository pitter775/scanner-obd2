import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { env, isSupabaseConfigured } from '../../config/env';

export const supabase = createClient(
  env.supabaseUrl || 'https://placeholder.supabase.co',
  env.supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: AsyncStorage,
    },
  },
);

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
}
