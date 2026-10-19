import { isAxiosError } from 'axios';

import api from '@/services/api';
import type { AppNotification, NotificationPage } from '@/types/notifications';

export class NotificationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationServiceError';
  }
}

function readable(error: unknown) {
  if (isAxiosError(error) && !error.response) {
    return new NotificationServiceError('Unable to reach the server. Check your connection.');
  }
  if (isAxiosError(error) && error.response?.status === 401) {
    return new NotificationServiceError('Your session has expired. Please log in again.');
  }
  return new NotificationServiceError('Unable to update notifications. Please try again.');
}

export async function getNotifications(): Promise<NotificationPage> {
  try {
    const response = await api.get<NotificationPage>('users/notifications/', {
      params: { page: 1, page_size: 50 },
    });
    return response.data;
  } catch (error) {
    throw readable(error);
  }
}

export async function markNotificationRead(id: number): Promise<AppNotification> {
  try {
    const response = await api.post<AppNotification>(`users/notifications/${id}/read/`);
    return response.data;
  } catch (error) {
    throw readable(error);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await api.post('users/notifications/mark-all-read/');
  } catch (error) {
    throw readable(error);
  }
}
