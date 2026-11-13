// Keys the owner types into the app (a Claude API key, a GitHub token) are kept
// in the phone's keychain, never in app storage or logs. On the web preview the
// keychain is missing, so they live for the session only.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type SecretName = 'claudeKey' | 'githubToken';

const memory: Partial<Record<SecretName, string>> = {};

// Nothing is built in: a key compiled into the app can be read out of the
// update bundle by anyone, so keys come only from what the owner types here.

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
  return own || null;
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
