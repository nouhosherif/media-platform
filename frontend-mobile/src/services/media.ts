import { isAxiosError } from 'axios';

import api from '@/services/api';
import type {
  MediaComment,
  MediaFeedPage,
  MediaItem,
  MediaUploadBatchResponse,
  MediaUploadRequest,
  MediaUploadSource,
} from '@/types/media';

const feedPath = 'media/feed/';
const uploadPath = 'media/upload/';

export const feedPaths = {
  all: feedPath,
  following: 'media/following/',
  personalized: 'media/personalized/',
  explore: 'media/explore/',
} as const;

export type FeedKind = keyof typeof feedPaths;

export const maxMediaUploadBytes = 5 * 1024 * 1024;
export const maxMediaUploadCount = 10;

const mimeTypeByExtension: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mp4: 'video/mp4',
  png: 'image/png',
};

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
};

export class MediaFeedError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'MediaFeedError';
    this.status = status;
  }
}

export class MediaUploadError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'MediaUploadError';
    this.status = status;
  }
}

export class MediaInteractionError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'MediaInteractionError';
    this.status = status;
  }
}

function getExtension(value?: string | null) {
  if (!value) {
    return '';
  }

  const cleanValue = value.split(/[?#]/)[0];
  const match = cleanValue.match(/\.([a-z0-9]+)$/i);
  return match?.[1].toLowerCase() ?? '';
}

function getUploadDetails(source: MediaUploadSource) {
  const metadataMimeType = source.mimeType?.split(';')[0].trim().toLowerCase();
  const sourceExtension =
    getExtension(source.fileName) || getExtension(source.uri);
  const inferredMimeType = mimeTypeByExtension[sourceExtension];
  const mimeType =
    metadataMimeType && metadataMimeType !== 'application/octet-stream'
      ? metadataMimeType
      : inferredMimeType;

  if (!mimeType || !extensionByMimeType[mimeType]) {
    throw new MediaUploadError('Only JPEG, PNG, and MP4 files are supported.');
  }

  if (source.fileSize && source.fileSize > maxMediaUploadBytes) {
    throw new MediaUploadError('File too large. The maximum upload size is 5 MB.');
  }

  const extension = extensionByMimeType[mimeType];
  const suppliedFileName = source.fileName?.trim();
  const suppliedExtension = getExtension(suppliedFileName);
  const fileName =
    suppliedFileName && mimeTypeByExtension[suppliedExtension] === mimeType
      ? suppliedFileName
      : `media-${Date.now()}.${extension}`;
  return { fileName, mimeType };
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

    for (const key of ['file', 'files', 'caption', 'error', 'detail', 'non_field_errors']) {
      const message = firstResponseMessage(data[key]);

      if (message) {
        return message;
      }
    }
  }

  return undefined;
}

export async function getFeed(pageUrl = feedPath): Promise<MediaFeedPage> {
  try {
    const response = await api.get<MediaFeedPage>(pageUrl);
    return response.data;
  } catch (error) {
    if (!isAxiosError(error)) {
      throw new MediaFeedError('Unable to load the feed. Please try again.');
    }

    if (!error.response) {
      throw new MediaFeedError(
        'Unable to reach the server. Check your network connection and try again.',
      );
    }

    if (error.response.status === 401) {
      throw new MediaFeedError(
        'Your session has expired. Please log in again.',
        error.response.status,
      );
    }

    throw new MediaFeedError(
      'Unable to load the feed. Please try again.',
      error.response.status,
    );
  }
}

export async function uploadMedia({
  caption,
  sources,
}: MediaUploadRequest): Promise<MediaItem[]> {
  const normalizedCaption = caption.trim();

  if (!normalizedCaption && sources.length === 0) {
    throw new MediaUploadError('Write something or select media to publish.');
  }

  if (sources.length > maxMediaUploadCount) {
    throw new MediaUploadError(
      `Select no more than ${maxMediaUploadCount} photos.`,
    );
  }

  const uploadDetails = sources.map((source) => ({
    ...getUploadDetails(source),
    source,
  }));

  if (
    uploadDetails.length > 1 &&
    uploadDetails.some(({ mimeType }) => !mimeType.startsWith('image/'))
  ) {
    throw new MediaUploadError('Multiple selection supports photos only.');
  }

  const formData = new FormData();

  if (normalizedCaption) {
    formData.append('caption', normalizedCaption);
  }

  uploadDetails.forEach(({ fileName, mimeType, source }) => {
    const file =
      source.file ??
      ({
        uri: source.uri,
        name: fileName,
        type: mimeType,
      } as unknown as Blob);
    const fieldName = uploadDetails.length > 1 ? 'files' : 'file';

    if (source.file) {
      formData.append(fieldName, source.file, fileName);
    } else {
      formData.append(fieldName, file);
    }
  });

  try {
    const response = await api.post<MediaItem | MediaUploadBatchResponse>(uploadPath, formData, {
      timeout: sources.length > 1 ? 90_000 : 30_000,
    });
    return 'results' in response.data ? response.data.results : [response.data];
  } catch (error) {
    if (error instanceof MediaUploadError) {
      throw error;
    }

    if (!isAxiosError(error)) {
      throw new MediaUploadError('Unable to upload this file. Please try again.');
    }

    if (error.code === 'ECONNABORTED') {
      throw new MediaUploadError(
        'The upload timed out. Check your connection and try again.',
      );
    }

    if (!error.response) {
      throw new MediaUploadError(
        'Unable to reach the server. Check your network connection and try again.',
      );
    }

    if (error.response.status === 401) {
      throw new MediaUploadError(
        'Your session has expired. Please log in again.',
        error.response.status,
      );
    }

    throw new MediaUploadError(
      firstResponseMessage(error.response.data) ??
        'Unable to upload this file. Please try again.',
      error.response.status,
    );
  }
}

function interactionError(error: unknown, fallback: string) {
  if (!isAxiosError(error)) {
    return new MediaInteractionError(fallback);
  }

  if (!error.response) {
    return new MediaInteractionError(
      'Unable to reach the server. Check your network connection and try again.',
    );
  }

  const status = error.response.status;
  const message =
    status === 401
      ? 'Your session has expired. Please log in again.'
      : firstResponseMessage(error.response.data) ?? fallback;
  return new MediaInteractionError(message, status);
}

export async function toggleMediaLike(mediaId: number) {
  try {
    const response = await api.post<{ message: 'Liked' | 'Unliked' }>(
      `media/like/${mediaId}/`,
    );
    return response.data;
  } catch (error) {
    throw interactionError(error, 'Unable to update this like. Please try again.');
  }
}

export async function addMediaComment(mediaId: number, text: string) {
  try {
    const response = await api.post<MediaComment>(
      `media/comment/${mediaId}/`,
      { text },
    );
    return response.data;
  } catch (error) {
    throw interactionError(error, 'Unable to add this comment. Please try again.');
  }
}

export async function deleteMedia(mediaId: number) {
  try {
    await api.delete(`media/delete/${mediaId}/`);
  } catch (error) {
    throw interactionError(error, 'Unable to delete this media. Please try again.');
  }
}
