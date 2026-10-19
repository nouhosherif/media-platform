import { isAxiosError } from 'axios';

import api from '@/services/api';
import type { MediaFeedPage } from '@/types/media';
import type {
  FollowDirectory,
  FollowDirectoryTab,
  FollowToggleResult,
  ProfilePhotoSource,
  ProfileUpdate,
  PublicUserProfile,
  SocialUser,
  UserProfile,
} from '@/types/user';

const myProfilePath = 'users/profile/';
const myMediaPath = 'media/my-media/';

export class UserServiceError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'UserServiceError';
    this.status = status;
  }
}

function firstResponseMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstResponseMessage(item);

      if (message) {
        return message;
      }
    }
  }

  if (value && typeof value === 'object') {
    const data = value as Record<string, unknown>;

    for (const key of ['detail', 'error', 'non_field_errors']) {
      const message = firstResponseMessage(data[key]);

      if (message) {
        return message;
      }
    }
  }

  return undefined;
}

function readableUserError(error: unknown, fallback: string) {
  if (!isAxiosError(error)) {
    return new UserServiceError(fallback);
  }

  if (!error.response) {
    return new UserServiceError(
      'Unable to reach the server. Check your network connection and try again.',
    );
  }

  if (error.response.status === 401) {
    return new UserServiceError(
      'Your session has expired. Please log in again.',
      error.response.status,
    );
  }

  if (error.response.status === 404) {
    return new UserServiceError('This profile could not be found.', 404);
  }

  return new UserServiceError(
    firstResponseMessage(error.response.data) ?? fallback,
    error.response.status,
  );
}

function getPhotoDetails(source: ProfilePhotoSource) {
  const fileName = source.fileName?.trim() || `profile-${Date.now()}.jpg`;
  const extension = fileName.split('.').pop()?.toLowerCase();
  const inferred = extension === 'png' ? 'image/png' : 'image/jpeg';
  const mimeType = source.mimeType?.startsWith('image/')
    ? source.mimeType
    : inferred;

  if (source.fileSize && source.fileSize > 5 * 1024 * 1024) {
    throw new UserServiceError('Profile photo too large. The maximum size is 5 MB.');
  }

  return { fileName, mimeType };
}

export async function getMyProfile(): Promise<UserProfile> {
  try {
    const response = await api.get<UserProfile>(myProfilePath);
    return response.data;
  } catch (error) {
    throw readableUserError(error, 'Unable to load your profile. Please try again.');
  }
}

export async function updateMyProfile(values: ProfileUpdate): Promise<UserProfile> {
  try {
    const response = await api.patch<UserProfile>(myProfilePath, values);
    return response.data;
  } catch (error) {
    throw readableUserError(error, 'Unable to update your profile. Please try again.');
  }
}

export async function getUserProfile(
  userId: number,
): Promise<PublicUserProfile> {
  try {
    const response = await api.get<PublicUserProfile>(`users/profile/${userId}/`);
    return response.data;
  } catch (error) {
    throw readableUserError(error, 'Unable to load this profile. Please try again.');
  }
}

export async function getMyMedia(
  pageUrl = myMediaPath,
): Promise<MediaFeedPage> {
  try {
    const response = await api.get<MediaFeedPage>(pageUrl);
    return response.data;
  } catch (error) {
    throw readableUserError(error, 'Unable to load your media. Please try again.');
  }
}

export async function getUserMedia(
  userId: number,
  pageUrl = `media/user/${userId}/`,
): Promise<MediaFeedPage> {
  try {
    const response = await api.get<MediaFeedPage>(pageUrl);
    return response.data;
  } catch (error) {
    throw readableUserError(error, 'Unable to load this user\'s media. Please try again.');
  }
}

export async function searchUsers(query: string): Promise<SocialUser[]> {
  try {
    const response = await api.get<SocialUser[]>('users/search/', {
      params: { q: query.trim() },
    });
    return response.data;
  } catch (error) {
    throw readableUserError(error, 'Unable to search for users. Please try again.');
  }
}

export async function getFollowDirectory(
  tab: FollowDirectoryTab,
  query = '',
): Promise<FollowDirectory> {
  try {
    const response = await api.get<FollowDirectory>('users/follows/', {
      params: { q: query.trim(), tab },
    });
    return response.data;
  } catch (error) {
    throw readableUserError(error, 'Unable to load people. Please try again.');
  }
}

export async function toggleFollow(userId: number): Promise<FollowToggleResult> {
  try {
    const response = await api.post<FollowToggleResult>(`users/follow/${userId}/`);
    return response.data;
  } catch (error) {
    throw readableUserError(error, 'Unable to update this follow. Please try again.');
  }
}

export async function uploadProfilePhoto(
  source: ProfilePhotoSource,
): Promise<{ profile_picture: string }> {
  const { fileName, mimeType } = getPhotoDetails(source);
  const formData = new FormData();
  formData.append(
    'profile_picture',
    { name: fileName, type: mimeType, uri: source.uri } as unknown as Blob,
  );

  try {
    const response = await api.post<{ profile_picture: string }>(
      'users/profile/photo/',
      formData,
      { timeout: 30_000 },
    );
    return response.data;
  } catch (error) {
    throw readableUserError(error, 'Unable to update your profile photo. Please try again.');
  }
}
