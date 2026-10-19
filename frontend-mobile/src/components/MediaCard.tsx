import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import CommentModal from '@/components/CommentModal';
import MediaVideo from '@/components/MediaVideo';
import FeedIcon, { type FeedIconName } from '@/features/feed/FeedIcon';
import { colors, fontSize, layout, radius, spacing } from '@/constants/theme';
import { MediaInteractionError, toggleMediaLike } from '@/services/media';
import type { MediaComment, MediaItem } from '@/types/media';

interface MediaCardProps {
  media: MediaItem;
}

function formatUploadedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
      });
}

export default function MediaCard({ media }: MediaCardProps) {
  const router = useRouter();
  const [failedMediaUrl, setFailedMediaUrl] = useState<string | null>(null);
  const [likes, setLikes] = useState(media.likes_count);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState(media.comments);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const displayName = media.user_full_name.trim() || media.user.trim();
  const username = media.user.trim();
  const caption = media.caption.trim();
  const title = media.title.trim();
  const uploadedAt = formatUploadedAt(media.uploaded_at);
  const fileUrl = media.file?.trim() ?? '';
  const showImage =
    media.media_type === 'image' && fileUrl && failedMediaUrl !== fileUrl;

  const openProfile = () => {
    router.push({ pathname: '/profile/[userId]', params: { userId: media.user_id } });
  };

  const toggleLike = async () => {
    if (isLiking) return;

    setIsLiking(true);
    setErrorMessage('');

    try {
      const response = await toggleMediaLike(media.id);
      const isNowLiked = response.message === 'Liked';
      setLiked(isNowLiked);
      setLikes((current) =>
        isNowLiked ? current + 1 : Math.max(current - 1, 0),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof MediaInteractionError
          ? error.message
          : 'Unable to update this like.',
      );
    } finally {
      setIsLiking(false);
    }
  };

  const share = async () => {
    try {
      await Share.share({
        message: [caption, fileUrl].filter(Boolean).join('\n'),
      });
    } catch {
      setErrorMessage('Unable to share this media.');
    }
  };

  const addComment = (comment: MediaComment) => {
    setComments((current) => [...current, comment]);
  };

  const openPostOptions = () => Alert.alert('Post options', undefined, [
    { text: 'View profile', onPress: openProfile },
    { text: 'Share post', onPress: () => void share() },
    { text: 'Cancel', style: 'cancel' },
  ]);

  return (
    <View style={styles.card}>
      <View style={styles.ownerHeader}>
        <Pressable
        accessibilityLabel={displayName ? `Open ${displayName}'s profile` : 'Open profile'}
        accessibilityRole="button"
        onPress={openProfile}
        style={({ pressed }) => [styles.ownerRow, pressed && styles.pressed]}>
        <View style={styles.avatar}>
          {media.user_profile_picture ? (
            <Image source={{ uri: media.user_profile_picture }} style={styles.avatarImage} />
          ) : displayName ? (
            <Text style={styles.avatarInitial}>{Array.from(displayName)[0].toUpperCase()}</Text>
          ) : <FeedIcon name="user" color="#145d9c" />}
        </View>
        <View style={styles.ownerText}>
          {displayName ? (
            <Text numberOfLines={1} style={styles.displayName}>{displayName}</Text>
          ) : null}
          {uploadedAt ? <Text style={styles.uploadedAt}>{uploadedAt}</Text> : null}
        </View>
        </Pressable>
        <Pressable accessibilityLabel="Post options" accessibilityRole="button" onPress={openPostOptions}
          style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
          <FeedIcon name="more" size={22} />
        </Pressable>
      </View>

      {media.content_type === 'news' ? (
        <View style={styles.newsHeader}>
          <Text style={styles.newsLabel}>NEWS</Text>
          {title ? <Text style={styles.newsTitle}>{title}</Text> : null}
        </View>
      ) : null}

      {showImage ? (
        <View style={styles.mediaFrame}>
          <Image
            accessibilityLabel={username ? `Media uploaded by ${username}` : 'Media image'}
            onError={() => setFailedMediaUrl(fileUrl)}
            resizeMode="cover"
            source={{ uri: fileUrl }}
            style={styles.mediaImage}
          />
        </View>
      ) : media.media_type === 'video' && fileUrl ? (
        <View style={styles.mediaFrame}>
          <MediaVideo uri={fileUrl} aspectRatio={1.075} />
        </View>
      ) : fileUrl ? (
        <View style={[styles.mediaFrame, styles.mediaPlaceholder]}>
          <Ionicons color={colors.textMuted} name="image-outline" size={26} />
          <Text style={styles.placeholderTitle}>Media unavailable</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <ActionButton
          accessibilityLabel={liked ? 'Unlike post' : 'Like post'}
          active={liked}
          count={likes}
          disabled={isLiking}
          icon="heart"
          onPress={() => void toggleLike()}
        />
        <ActionButton
          accessibilityLabel="Open comments"
          count={comments.length}
          icon="message"
          onPress={() => setCommentsVisible(true)}
        />
        <ActionButton
          accessibilityLabel="Share post"
          icon="send"
          onPress={() => void share()}
        />
        <Pressable
          accessibilityLabel="Save post (not available yet)"
          accessibilityRole="button"
          onPress={() => Alert.alert('Saved posts', 'Saving posts is not available yet.')}
          style={({ pressed }) => [styles.bookmark, pressed && styles.pressed]}>
          <FeedIcon name="bookmark" size={23} />
        </Pressable>
      </View>

      {caption ? (
        <Text style={[styles.caption, !fileUrl && styles.textOnlyCaption]}>
          {displayName ? <Text onPress={openProfile} style={styles.captionOwner}>{displayName} </Text> : null}
          {caption}
        </Text>
      ) : null}

      {comments.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setCommentsVisible(true)}
          style={({ pressed }) => [styles.commentsPreview, pressed && styles.pressed]}>
          <Text style={styles.commentsPreviewText}>
            View all {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </Text>
          <FeedIcon name="chevron" color="#81858f" size={14} />
        </Pressable>
      ) : null}

      {errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>{errorMessage}</Text>
      ) : null}

      <CommentModal
        comments={comments}
        mediaId={media.id}
        onClose={() => setCommentsVisible(false)}
        onCommentAdded={addComment}
        visible={commentsVisible}
      />
    </View>
  );
}

interface ActionButtonProps {
  accessibilityLabel: string;
  active?: boolean;
  count?: number;
  disabled?: boolean;
  icon: FeedIconName;
  onPress: () => void;
}

function ActionButton({
  accessibilityLabel,
  active = false,
  count,
  disabled,
  icon,
  onPress,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        disabled && styles.disabled,
        pressed && styles.actionPressed,
      ]}>
      <FeedIcon color={active ? '#f15d76' : '#20242a'} filled={active} name={icon} size={24} />
      {count !== undefined ? (
        <Text style={styles.actionLabel}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 2,
    marginBottom: 16,
    maxWidth: layout.feedMaxWidth,
    paddingBottom: 14,
    shadowColor: '#242735',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.035,
    shadowRadius: 11,
    width: '100%',
  },
  ownerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ownerRow: { alignItems: 'center', flexDirection: 'row', flex: 1, minWidth: 0 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#d8e8ff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { color: '#145d9c', fontSize: 23, fontWeight: '700' },
  ownerText: { flex: 1, marginLeft: 14, minWidth: 0 },
  displayName: { color: '#101114', fontSize: 16, fontWeight: '700' },
  uploadedAt: { color: '#81858f', fontSize: 13, marginTop: 3 },
  moreButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#f8f8fa', alignItems: 'center', justifyContent: 'center' },
  newsHeader: { paddingBottom: spacing.md, paddingHorizontal: spacing.lg },
  newsLabel: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.round,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  newsTitle: {
    color: colors.text,
    fontSize: fontSize.section,
    fontWeight: '800',
    lineHeight: 25,
    marginTop: spacing.sm,
  },
  mediaFrame: {
    backgroundColor: '#eff1f5',
    borderRadius: 15,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  mediaImage: { backgroundColor: '#eff1f5', width: '100%', aspectRatio: 1.075 },
  mediaPlaceholder: {
    alignItems: 'center',
    aspectRatio: 1.075,
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  placeholderTitle: { color: colors.textSecondary, fontSize: fontSize.body, fontWeight: '700' },
  actionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 17,
    marginHorizontal: 16,
    minHeight: 48,
    paddingTop: 4,
  },
  action: {
    alignItems: 'center',
    borderRadius: radius.small,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 40,
  },
  bookmark: { marginLeft: 'auto', minHeight: 40, minWidth: 32, alignItems: 'flex-end', justifyContent: 'center' },
  actionPressed: { backgroundColor: colors.surfaceStrong },
  actionLabel: { color: '#81858f', fontSize: 14 },
  caption: {
    color: '#101114',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingTop: 5,
  },
  captionOwner: { fontWeight: '700' },
  textOnlyCaption: { fontSize: fontSize.input, lineHeight: 26 },
  commentsPreview: { alignSelf: 'flex-start', alignItems: 'center', flexDirection: 'row', gap: 5, paddingHorizontal: 16, paddingTop: 8 },
  commentsPreviewText: { color: '#81858f', fontSize: 14 },
  error: {
    backgroundColor: colors.errorSurface,
    borderRadius: radius.small,
    color: colors.error,
    fontSize: fontSize.caption,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.sm,
    textAlign: 'center',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.65 },
});
