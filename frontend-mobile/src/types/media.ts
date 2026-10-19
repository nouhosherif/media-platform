export type MediaType = 'image' | 'video' | 'text' | '';
export type ContentType = 'post' | 'news';

export interface MediaComment {
  id: number;
  user: string;
  text: string;
  created_at: string;
}

export interface MediaItem {
  id: number;
  user: string;
  user_id: number;
  user_full_name: string;
  user_profile_picture: string | null;
  file: string | null;
  caption: string;
  title: string;
  content_type: ContentType;
  media_type: MediaType;
  file_size: number | null;
  uploaded_at: string;
  likes_count: number;
  comments: MediaComment[];
}

export interface MediaFeedPage {
  next: string | null;
  previous: string | null;
  results: MediaItem[];
}

export interface MediaUploadSource {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
  file?: Blob;
}

export interface MediaUploadRequest {
  caption: string;
  sources: MediaUploadSource[];
}

export interface MediaUploadBatchResponse {
  count: number;
  results: MediaItem[];
}
