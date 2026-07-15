import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'bak_workforce_jwt';

export function saveToken(token: string): Promise<void> {
  return AsyncStorage.setItem(TOKEN_KEY, token);
}

export function loadToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export function clearToken(): Promise<void> {
  return AsyncStorage.removeItem(TOKEN_KEY);
}
