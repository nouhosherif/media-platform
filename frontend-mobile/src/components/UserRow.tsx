import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Avatar from '@/components/ui/Avatar';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { toggleFollow, UserServiceError } from '@/services/users';
import type { SocialUser } from '@/types/user';

interface UserRowProps {
  onFollowChanged?: (user: SocialUser) => void;
  onPress?: () => void;
  showFollow?: boolean;
  user: SocialUser;
}

export default function UserRow({ onFollowChanged, onPress, showFollow = true, user }: UserRowProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(user);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const follow = async () => {
    if (updating) return;
    setUpdating(true);
    setError('');
    try {
      const response = await toggleFollow(current.id);
      const next = {
        ...current,
        followers_count: response.followers_count,
        is_following: response.is_following,
      };
      setCurrent(next);
      onFollowChanged?.(next);
    } catch (caught) {
      setError(caught instanceof UserServiceError ? caught.message : 'Unable to update this follow.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress ?? (() =>
          router.push({ pathname: '/profile/[userId]', params: { userId: current.id } })
        )}
        style={styles.identity}>
        <Avatar label={current.full_name || current.username} size={48} uri={current.profile_picture} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.name}>{current.full_name || current.username}</Text>
          <Text numberOfLines={1} style={styles.username}>@{current.username}</Text>
          {current.bio ? <Text numberOfLines={1} style={styles.bio}>{current.bio}</Text> : null}
          {error ? <Text numberOfLines={2} style={styles.error}>{error}</Text> : null}
        </View>
      </Pressable>
      {showFollow ? (
        <Pressable
          accessibilityLabel={current.is_following ? `Unfollow ${current.username}` : `Follow ${current.username}`}
          disabled={updating}
          onPress={() => void follow()}
          style={[styles.follow, current.is_following && styles.following, updating && styles.disabled]}>
          <Ionicons
            color={current.is_following ? colors.textSecondary : colors.white}
            name={current.is_following ? 'checkmark' : 'person-add-outline'}
            size={16}
          />
          <Text style={[styles.followText, current.is_following && styles.followingText]}>
            {current.is_following ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 76, padding: spacing.md },
  identity: { alignItems: 'center', flex: 1, flexDirection: 'row', minWidth: 0 },
  copy: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  name: { color: colors.text, fontSize: fontSize.body, fontWeight: '700' },
  username: { color: colors.textMuted, fontSize: fontSize.caption, marginTop: 1 },
  bio: { color: colors.textSecondary, fontSize: fontSize.caption, marginTop: 3 },
  error: { color: colors.error, fontSize: 10, marginTop: 2 },
  follow: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.card, flexDirection: 'row', gap: spacing.xs, minHeight: 36, paddingHorizontal: spacing.md },
  following: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1 },
  followText: { color: colors.white, fontSize: fontSize.caption, fontWeight: '700' },
  followingText: { color: colors.textSecondary },
  disabled: { opacity: 0.55 },
});
