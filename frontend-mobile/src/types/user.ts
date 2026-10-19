export interface PublicUserProfile {
  id: number;
  username: string;
  email?: string;
  full_name: string;
  bio: string;
  profile_picture: string | null;
  posts_count: number;
  likes_count: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  first_name: string;
  last_name: string;
  is_self: boolean;
}

export interface UserProfile extends PublicUserProfile {
  email: string;
  phone_number: string;
  location: string;
  date_joined: string;
}

export interface ProfileUpdate {
  first_name: string;
  last_name: string;
  bio: string;
  phone_number: string;
  location: string;
}

export type CurrentUser = UserProfile;

export interface SocialUser {
  id: number;
  username: string;
  full_name: string;
  bio: string;
  profile_picture: string | null;
  posts_count: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
}

export type FollowDirectoryTab = 'discover' | 'followers' | 'following';

export interface FollowDirectory {
  tab: FollowDirectoryTab;
  results: SocialUser[];
  followers_count: number;
  following_count: number;
}

export interface FollowToggleResult {
  message: 'Followed' | 'Unfollowed';
  is_following: boolean;
  followers_count: number;
  following_count: number;
}

export interface ProfilePhotoSource {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
}
