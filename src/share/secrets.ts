// Keys the owner types into the app (a Claude API key, a GitHub token) are kept
// in the phone's keychain, never in app storage or logs. On the web preview the
// keychain is missing, so they live for the session only.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type SecretName = 'claudeKey' | 'githubToken';

const memory: Partial<Record<SecretName, string>> = {};

// Keys the owner saved as repository secrets are built in at build time (his
// choice, 14 Nov 2026). One typed into Settings on this phone wins over it.
const BUILT_IN: Partial<Record<SecretName, string>> = {
  claudeKey: process.env.EXPO_PUBLIC_CLAUDE_KEY || undefined,
  githubToken: process.env.EXPO_PUBLIC_UPLOAD_TOKEN || undefined,
};

export function isBuiltIn(name: SecretName): boolean {
  return !!BUILT_IN[name];
}

// Only a key typed into Settings on this phone.
export async function getOwnSecret(name: SecretName): Promise<string | null> {
  if (Platform.OS === 'web') return memory[name] ?? null;
  try {
    return await SecureStore.getItemAsync(`caristini.${name}`);
  } catch {
    return null;
  }
}

export async function getSecret(name: SecretName): Promise<string | null> {
  let own: string | null = null;
  if (Platform.OS === 'web') own = memory[name] ?? null;
  else {
    try {
      own = await SecureStore.getItemAsync(`caristini.${name}`);
    } catch {
      own = null;
    }
  }
  return own || BUILT_IN[name] || null;
}

export async function setSecret(name: SecretName, value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (value) memory[name] = value;
    else delete memory[name];
    return;
  }
  if (value) await SecureStore.setItemAsync(`caristini.${name}`, value);
  else await SecureStore.deleteItemAsync(`caristini.${name}`);
}
