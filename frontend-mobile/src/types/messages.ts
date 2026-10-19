import type { SocialUser } from '@/types/user';

export type MessageType = 'text' | 'voice';

export interface DirectMessage {
  id: number;
  sender: SocialUser;
  recipient: SocialUser;
  message_type: MessageType;
  text: string;
  voice_file: string | null;
  voice_duration: number | null;
  is_read: boolean;
  created_at: string;
}

export interface MessageThread {
  user: SocialUser;
  last_message: DirectMessage;
  unread_count: number;
}

export interface Conversation {
  user: SocialUser;
  messages: DirectMessage[];
  count?: number;
  next?: string | null;
  previous?: string | null;
}

export interface MessageThreadPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: MessageThread[];
}

export interface VoiceMessageSource {
  durationSeconds: number;
  uri: string;
}
