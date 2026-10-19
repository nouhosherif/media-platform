// Keep the existing storage keys so existing browser sessions survive the move.
export const ACCESS_TOKEN_KEY = "token";
export const REFRESH_TOKEN_KEY = "refreshToken";

export const createSessionStorage = (storage) => ({
  getAccess: () => storage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => storage.getItem(REFRESH_TOKEN_KEY),
  setTokens: ({ access, refresh }) => {
    storage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) storage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear: () => {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
  },
});
