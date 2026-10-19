import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomNav, { bottomNavBaseHeight } from '@/components/BottomNav';
import AppButton from '@/components/ui/AppButton';
import Avatar from '@/components/ui/Avatar';
import StatePanel from '@/components/ui/StatePanel';
import { colors, fontSize, layout, radius, spacing } from '@/constants/theme';
import { getUserMedia, getUserProfile, toggleFollow, UserServiceError } from '@/services/users';
import type { MediaItem } from '@/types/media';
import type { PublicUserProfile } from '@/types/user';

type MediaFilter = 'all' | 'video' | 'image';

function VideoTile({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <View style={styles.videoTile}>
      <VideoView contentFit="cover" nativeControls={false} player={player} style={styles.image} />
      <View style={styles.playBadge}>
        <Ionicons color={colors.white} name="play" size={16} />
      </View>
    </View>
  );
}

function MediaTile({ item, size }: { item: MediaItem; size: number }) {
  const [failed, setFailed] = useState(false);
  const fileUrl = item.file?.trim() ?? '';
  return (
    <View style={[styles.tile, { height: size, width: size }]}>
      {item.media_type === 'image' && fileUrl && !failed ? (
        <Image onError={() => setFailed(true)} source={{ uri: fileUrl }} style={styles.image} />
      ) : item.media_type === 'video' && fileUrl ? (
        <VideoTile uri={fileUrl} />
      ) : item.media_type === 'text' ? (
        <View style={styles.textTile}>
          <Text numberOfLines={6} style={styles.textTileContent}>{item.caption}</Text>
        </View>
      ) : (
        <View style={styles.unavailableTile}>
          <Ionicons color={colors.textMuted} name="image-outline" size={24} />
        </View>
      )}
    </View>
  );
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string }>();
  const { width } = useWindowDimensions();
  const requestId = useRef(0);
  const userId = Number(params.userId);
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('This profile could not be found.');
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [profileResult, mediaResult] = await Promise.all([
        getUserProfile(userId),
        getUserMedia(userId),
      ]);
      if (id !== requestId.current) return;
      setProfile(profileResult);
      setMedia(mediaResult.results);
      setNextPage(mediaResult.next);
    } catch (caught) {
      if (id === requestId.current) {
        setError(caught instanceof UserServiceError ? caught.message : 'Unable to load this profile.');
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [load]);

  const loadMore = async () => {
    if (!nextPage) return;
    try {
      const page = await getUserMedia(userId, nextPage);
      setMedia((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...page.results.filter((item) => !ids.has(item.id))];
      });
      setNextPage(page.next);
    } catch (caught) {
      setError(caught instanceof UserServiceError ? caught.message : 'Unable to load more posts.');
    }
  };

  const follow = async () => {
    if (!profile || following || profile.is_self) return;
    setFollowing(true);
    setError('');
    try {
      const result = await toggleFollow(profile.id);
      setProfile((current) => current ? {
        ...current,
        followers_count: result.followers_count,
        is_following: result.is_following,
      } : current);
    } catch (caught) {
      setError(caught instanceof UserServiceError ? caught.message : 'Unable to update this follow.');
    } finally {
      setFollowing(false);
    }
  };

  const contentWidth = Math.min(width, layout.feedMaxWidth);
  const tileSize = Math.floor((contentWidth - spacing.lg * 2 - spacing.sm * 2) / 3);
  const visibleMedia = useMemo(
    () => mediaFilter === 'all' ? media : media.filter((item) => item.media_type === mediaFilter),
    [media, mediaFilter],
  );

  const header = profile ? (
    <>
      <View style={styles.hero}>
        <View style={styles.heroActions}>
          <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.circleAction}>
            <Ionicons color={colors.text} name="arrow-back" size={22} />
          </Pressable>
          <View style={styles.circleActionPlaceholder} />
        </View>
        <View style={styles.identity}>
          <View style={styles.avatarRing}>
            <Avatar label={profile.full_name || profile.username} size={140} uri={profile.profile_picture} />
          </View>
          <Text numberOfLines={1} style={styles.name}>{profile.full_name || profile.username}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.stats}>
          {[
            ['Followers', profile.followers_count],
            ['Following', profile.following_count],
            [Number.isFinite(profile.likes_count) ? 'Likes' : 'Posts', Number.isFinite(profile.likes_count) ? profile.likes_count : profile.posts_count],
          ].map(([label, value], index) => (
            <View key={String(label)} style={[styles.stat, index > 0 && styles.statBorder]}>
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabs}>
          {([['all', 'All'], ['video', 'Videos'], ['image', 'Photos']] as const).map(([value, label]) => (
            <Pressable key={value} onPress={() => setMediaFilter(value)} style={[styles.tab, mediaFilter === value && styles.activeTab]}>
              <Text style={[styles.tabText, mediaFilter === value && styles.activeTabText]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {profile.is_self ? (
          <AppButton label="Open My Profile" onPress={() => router.replace('/profile')} variant="secondary" />
        ) : (
          <View style={styles.actions}>
            <AppButton
              label="Message"
              onPress={() => router.push({ pathname: '/messages', params: { user: profile.id } })}
              style={styles.actionButton}
              variant="dark"
            />
            <AppButton
              label={profile.is_following ? 'Following' : 'Follow'}
              loading={following}
              onPress={() => void follow()}
              style={styles.actionButton}
              variant="secondary"
            />
          </View>
        )}
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </View>
    </>
  ) : null;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.shell}>
        {loading ? (
          <View style={styles.stateWrap}><StatePanel title="Loading profile..." variant="loading" /></View>
        ) : !profile ? (
          <View style={styles.stateWrap}>
            <StatePanel actionLabel="Retry" onAction={() => void load()} title={error || 'Profile unavailable'} variant="error" />
          </View>
        ) : (
          <FlatList
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.content}
            data={visibleMedia}
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={<View style={styles.stateWrap}><StatePanel title="No media yet" variant="empty" /></View>}
            ListHeaderComponent={header}
            numColumns={3}
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={0.4}
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            renderItem={({ item }) => <MediaTile item={item} size={tileSize} />}
          />
        )}
      </View>
      {profile ? <BottomNav /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.surface, flex: 1 },
  shell: { alignSelf: 'center', flex: 1, maxWidth: layout.feedMaxWidth, width: '100%' },
  content: { flexGrow: 1, paddingBottom: bottomNavBaseHeight + spacing.xxxl },
  stateWrap: { padding: spacing.lg },
  hero: {
    backgroundColor: colors.profileHero,
    borderBottomLeftRadius: 150,
    borderBottomRightRadius: 150,
    minHeight: 350,
    overflow: 'hidden',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  heroActions: { flexDirection: 'row', justifyContent: 'space-between' },
  circleAction: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.round, height: 46, justifyContent: 'center', width: 46 },
  circleActionPlaceholder: { height: 46, width: 46 },
  identity: { alignItems: 'center', marginTop: -spacing.sm },
  avatarRing: { backgroundColor: colors.surface, borderColor: colors.white, borderRadius: radius.round, borderWidth: 5, padding: 2 },
  name: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: spacing.md },
  username: { color: colors.textSecondary, fontSize: fontSize.input, fontWeight: '600', marginTop: spacing.xs },
  bio: { color: colors.textMuted, fontSize: fontSize.body, lineHeight: 20, marginTop: spacing.sm, maxWidth: 320, textAlign: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  stats: { flexDirection: 'row', paddingVertical: spacing.sm },
  stat: { alignItems: 'center', flex: 1 },
  statBorder: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  statValue: { color: colors.text, fontSize: 21, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: fontSize.caption, marginTop: 2 },
  tabs: { backgroundColor: colors.surfaceStrong, borderRadius: radius.round, flexDirection: 'row', marginBottom: spacing.lg, marginTop: spacing.lg, padding: 4 },
  tab: { alignItems: 'center', borderRadius: radius.round, flex: 1, minHeight: 44, justifyContent: 'center' },
  activeTab: { backgroundColor: colors.ink },
  tabText: { color: colors.text, fontSize: fontSize.body, fontWeight: '700' },
  activeTabText: { color: colors.white },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  actionButton: { flex: 1 },
  inlineError: { color: colors.error, fontSize: fontSize.caption, marginBottom: spacing.md },
  gridRow: { gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  tile: { backgroundColor: colors.surfaceStrong, borderRadius: radius.media, overflow: 'hidden' },
  image: { height: '100%', width: '100%' },
  videoTile: { backgroundColor: colors.black, flex: 1, position: 'relative' },
  playBadge: { alignItems: 'center', backgroundColor: 'rgba(17,18,20,0.65)', borderRadius: radius.round, bottom: spacing.sm, height: 30, justifyContent: 'center', position: 'absolute', right: spacing.sm, width: 30 },
  textTile: { alignItems: 'center', backgroundColor: colors.surfaceStrong, flex: 1, justifyContent: 'center', padding: spacing.sm },
  textTileContent: { color: colors.textSecondary, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  unavailableTile: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
