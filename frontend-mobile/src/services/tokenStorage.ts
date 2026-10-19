import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'media-platform.access-token';
const REFRESH_TOKEN_KEY = 'media-platform.refresh-token';

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export async function storeTokens(accessToken: string, refreshToken: string) {
  try {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  } catch (error) {
    await clearTokens();
    throw error;
  }
}

export async function storeAccessToken(accessToken: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function getStoredTokens(): Promise<StoredTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
  ]);

  return { accessToken, refreshToken };
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
