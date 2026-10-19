import { isAxiosError } from 'axios';

import api from '@/services/api';
import type { Conversation, DirectMessage, MessageThread, MessageThreadPage, VoiceMessageSource } from '@/types/messages';

export class MessageServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageServiceError';
  }
}

function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstMessage(item);
      if (message) return message;
    }
  }
  if (value && typeof value === 'object') {
    const data = value as Record<string, unknown>;
    for (const key of ['error', 'detail', 'non_field_errors']) {
      const message = firstMessage(data[key]);
      if (message) return message;
    }
  }
  return undefined;
}

function readable(error: unknown, fallback: string) {
  if (!isAxiosError(error)) return new MessageServiceError(fallback);
  if (!error.response) return new MessageServiceError('Unable to reach the server. Check your connection.');
  if (error.response.status === 401) return new MessageServiceError('Your session has expired. Please log in again.');
  return new MessageServiceError(firstMessage(error.response.data) ?? fallback);
}

export async function getMessageThreads(): Promise<MessageThread[]> {
  try {
    const response = await api.get<MessageThreadPage>('users/messages/', {
      params: { page: 1, page_size: 50 },
    });
    return response.data.results;
  } catch (error) {
    throw readable(error, 'Unable to load messages. Please try again.');
  }
}

export async function getConversation(userId: number): Promise<Conversation> {
  try {
    const response = await api.get<Conversation>(`users/messages/${userId}/`, {
      params: { page: 'last', page_size: 50 },
    });
    return response.data;
  } catch (error) {
    throw readable(error, 'Unable to load this conversation. Please try again.');
  }
}

export async function sendTextMessage(userId: number, text: string): Promise<DirectMessage> {
  try {
    const response = await api.post<DirectMessage>('users/messages/', { recipient_id: userId, text });
    return response.data;
  } catch (error) {
    throw readable(error, 'Unable to send this message. Please try again.');
  }
}

export async function sendVoiceMessage(userId: number, source: VoiceMessageSource): Promise<DirectMessage> {
  const formData = new FormData();
  formData.append('recipient_id', String(userId));
  formData.append('voice_duration', String(source.durationSeconds));
  formData.append(
    'voice_file',
    { name: `voice-${Date.now()}.m4a`, type: 'audio/mp4', uri: source.uri } as unknown as Blob,
  );

  try {
    const response = await api.post<DirectMessage>('users/messages/', formData, { timeout: 30_000 });
    return response.data;
  } catch (error) {
    throw readable(error, 'Unable to send this voice message. Please try again.');
  }
}
