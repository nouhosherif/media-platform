import type { SocialUser } from '@/types/user';

export type NotificationType = 'message' | 'follow' | 'call' | 'system';

export interface AppNotification {
  id: number;
  actor: SocialUser | null;
  notification_type: NotificationType;
  message: string;
  target_url: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPage {
  count?: number;
  next?: string | null;
  previous?: string | null;
  unread_count: number;
  total_count: number;
  results: AppNotification[];
}
