import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  Boolean(envUrl) &&
  envUrl !== 'https://your-project.supabase.co' &&
  Boolean(envKey) &&
  envKey !== 'your-anon-key';

/** Valid-looking placeholders so createClient does not throw when .env is missing. */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTk1NzM0NTIwMH0.cLCylO8o7CqJBQKQP4l8d8U8YB0wY9Rx_KYypLDnJjs';

const supabaseUrl = isSupabaseConfigured ? envUrl : PLACEHOLDER_URL;
const supabaseAnonKey = isSupabaseConfigured ? envKey : PLACEHOLDER_KEY;

const CHUNK_SIZE = 1900;

class LargeSecureStore {
  async getItem(key: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(`${key}_count`);
    if (!countStr) {
      return AsyncStorage.getItem(key);
    }
    const count = parseInt(countStr, 10);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
      if (chunk) chunks.push(chunk);
    }
    return chunks.join('');
  }

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(`${key}_count`).catch(() => {});
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}_count`, String(count));
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        `${key}_${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }
  }

  async removeItem(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(`${key}_count`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(`${key}_count`).catch(() => {});
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
    await AsyncStorage.removeItem(key);
  }
}

const storage = Platform.OS === 'web' ? AsyncStorage : new LargeSecureStore();

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: isSupabaseConfigured,
    persistSession: isSupabaseConfigured,
    detectSessionInUrl: false,
  },
});
