import { isAxiosError } from 'axios';

import api from '@/services/api';
import {
  clearTokens,
  getStoredTokens,
  storeTokens,
} from '@/services/tokenStorage';
import type { CurrentUser } from '@/types/user';

export type { CurrentUser } from '@/types/user';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegistrationData {
  username?: string;
  email: string;
  password: string;
}

export interface RegistrationFieldErrors {
  username?: string;
  email?: string;
  password?: string;
}

interface LoginResponse {
  access: string;
  refresh: string;
  username: string;
}

export interface RegistrationResponse {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  access: string;
  refresh: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class RegistrationError extends AuthenticationError {
  fieldErrors: RegistrationFieldErrors;

  constructor(message: string, fieldErrors: RegistrationFieldErrors = {}) {
    super(message);
    this.name = 'RegistrationError';
    this.fieldErrors = fieldErrors;
  }
}

function firstErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstErrorMessage(item);

      if (message) {
        return message;
      }
    }
  }

  return undefined;
}

function registrationRequestError(error: unknown) {
  if (!isAxiosError(error)) {
    return new RegistrationError('Unable to create the account. Please try again.');
  }

  if (!error.response) {
    return new RegistrationError(
      'Unable to reach the server. Check your network connection and try again.',
    );
  }

  const responseData = error.response.data;

  if (!responseData || typeof responseData !== 'object' || Array.isArray(responseData)) {
    return new RegistrationError('Unable to create the account. Please try again.');
  }

  const data = responseData as Record<string, unknown>;
  const fieldErrors: RegistrationFieldErrors = {};
  const usernameError = firstErrorMessage(data.username);
  const emailError = firstErrorMessage(data.email);
  const passwordError = firstErrorMessage(data.password);

  if (usernameError) {
    fieldErrors.username = usernameError;
  }

  if (emailError) {
    fieldErrors.email = emailError;
  }

  if (passwordError) {
    fieldErrors.password = passwordError;
  }
  const generalMessage =
    firstErrorMessage(data.non_field_errors) ??
    firstErrorMessage(data.detail) ??
    fieldErrors.username ??
    fieldErrors.email ??
    fieldErrors.password ??
    'Unable to create the account. Please try again.';

  return new RegistrationError(generalMessage, fieldErrors);
}

function readableRequestError(error: unknown, fallbackMessage: string) {
  if (!isAxiosError(error)) {
    return fallbackMessage;
  }

  if (!error.response) {
    return 'Unable to reach the server. Check your network connection and try again.';
  }

  if (error.response.status === 401) {
    return 'Invalid username, email, or password.';
  }

  return fallbackMessage;
}

export async function register(data: RegistrationData) {
  const username = data.username?.trim();
  const email = data.email.trim().toLowerCase();

  if (!email || !data.password) {
    throw new RegistrationError('Email and password are required.', {
      email: email ? undefined : 'Enter your email address.',
      password: data.password ? undefined : 'Enter a password.',
    });
  }

  const payload: RegistrationData = {
    email,
    password: data.password,
  };

  if (username) {
    payload.username = username;
  }

  try {
    const response = await api.post<RegistrationResponse>('users/register/', payload);

    if (!response.data.access || !response.data.refresh) {
      throw new RegistrationError(
        'The account was created, but the server did not return a complete session.',
      );
    }

    await storeTokens(response.data.access, response.data.refresh);
    return response.data;
  } catch (error) {
    if (error instanceof RegistrationError) {
      throw error;
    }

    throw registrationRequestError(error);
  }
}

export async function login(credentials: LoginCredentials) {
  const username = credentials.username.trim();

  if (!username || !credentials.password) {
    throw new AuthenticationError('Username or email and password are required.');
  }

  try {
    const response = await api.post<LoginResponse>('users/login/', {
      username,
      password: credentials.password,
    });

    if (!response.data.access || !response.data.refresh) {
      throw new AuthenticationError('The server returned an incomplete login response.');
    }

    await storeTokens(response.data.access, response.data.refresh);

    try {
      return await getCurrentUser();
    } catch (error) {
      await clearTokens();
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    throw new AuthenticationError(
      readableRequestError(error, 'Unable to sign in. Please try again.'),
    );
  }
}

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const response = await api.get<CurrentUser>('users/profile/');
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      throw new AuthenticationError('Your session has expired. Please log in again.');
    }

    throw new AuthenticationError(
      readableRequestError(error, 'Unable to load the current user.'),
    );
  }
}

export async function logout() {
  try {
    await clearTokens();
  } catch {
    throw new AuthenticationError('Unable to clear the saved session.');
  }
}

export async function hasStoredSession() {
  try {
    const { accessToken, refreshToken } = await getStoredTokens();
    const hasCompleteSession = Boolean(accessToken && refreshToken);

    if (!hasCompleteSession && (accessToken || refreshToken)) {
      await clearTokens();
    }

    return hasCompleteSession;
  } catch {
    throw new AuthenticationError('Unable to read the saved session.');
  }
}
