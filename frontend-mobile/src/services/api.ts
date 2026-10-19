import { AxiosHeaders, create, isAxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeAccessToken,
} from '@/services/tokenStorage';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!configuredBaseUrl) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
}

const normalizedRootUrl = configuredBaseUrl
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

export const apiBaseUrl = `${normalizedRootUrl}/api/`;

const requestOptions = {
  baseURL: apiBaseUrl,
  timeout: 10_000,
  headers: {
    Accept: 'application/json',
  },
};

const api = create(requestOptions);
const refreshApi = create(requestOptions);

interface RefreshResponse {
  access: string;
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

class MissingRefreshTokenError extends Error {}

let refreshPromise: Promise<string> | null = null;

function isPublicAuthRequest(url?: string) {
  const normalizedUrl = url?.split('?')[0].replace(/^\/+|\/+$/g, '');
  return normalizedUrl === 'users/login' || normalizedUrl === 'users/register';
}

async function requestNewAccessToken() {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    throw new MissingRefreshTokenError();
  }

  const response = await refreshApi.post<RefreshResponse>('users/token/refresh/', {
    refresh: refreshToken,
  });

  if (!response.data.access) {
    throw new Error('Token refresh response did not contain an access token.');
  }

  await storeAccessToken(response.data.access);
  return response.data.access;
}

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = requestNewAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

api.interceptors.request.use(async (config) => {
  config.headers = AxiosHeaders.from(config.headers);

  if (isPublicAuthRequest(config.url)) {
    config.headers.delete('Authorization');
    return config;
  }

  const accessToken = await getAccessToken();

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!isAxiosError(error) || error.response?.status !== 401 || !error.config) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetryableRequestConfig;

    if (originalRequest._retry || isPublicAuthRequest(originalRequest.url)) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers = AxiosHeaders.from(originalRequest.headers);
      originalRequest.headers.set('Authorization', `Bearer ${accessToken}`);
      return api(originalRequest);
    } catch (refreshError) {
      if (refreshError instanceof MissingRefreshTokenError) {
        return Promise.reject(error);
      }

      await clearTokens();
      return Promise.reject(refreshError);
    }
  },
);

export default api;
