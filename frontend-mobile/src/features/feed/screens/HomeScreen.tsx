import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bottomNavBaseHeight } from '@/components/BottomNav';
import FeedBottomNav from '../FeedBottomNav';
import FeedIcon from '../FeedIcon';
import MediaCard from '@/components/MediaCard';
import AppButton from '@/components/ui/AppButton';
import Avatar from '@/components/ui/Avatar';
import StatePanel from '@/components/ui/StatePanel';
import { colors, fontSize, layout, radius, spacing } from '@/constants/theme';
import { getCurrentUser, hasStoredSession, logout } from '@/services/auth';
import {
  feedPaths,
  type FeedKind,
  getFeed,
  MediaFeedError,
} from '@/services/media';
import type { MediaItem } from '@/types/media';
import type { CurrentUser } from '@/types/user';

type FeedState = 'idle' | 'loading' | 'ready' | 'error';

const feedTabs: readonly [FeedKind, string][] = [
  ['all', 'All'],
  ['following', 'Following'],
  ['personalized', 'For You'],
  ['explore', 'Popular'],
];

export default function HomeScreen() {
  const router = useRouter();
  const feedRequestId = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sessionMessage, setSessionMessage] = useState('');
  const [feedItems, setFeedItems] = useState<MediaItem[]>([]);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [feedState, setFeedState] = useState<FeedState>('idle');
  const [feedError, setFeedError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedKind, setFeedKind] = useState<FeedKind>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const clearFeed = useCallback(() => {
    feedRequestId.current += 1;
    isLoadingMoreRef.current = false;
    setFeedItems([]);
    setNextPageUrl(null);
    setFeedState('idle');
    setFeedError('');
    setIsRefreshing(false);
    setIsLoadingMore(false);
  }, []);

  const loadFeed = useCallback(async (refreshing = false) => {
    const requestId = ++feedRequestId.current;

    if (refreshing) setIsRefreshing(true);
    else setFeedState('loading');
    setFeedError('');

    try {
      const page = await getFeed(feedPaths[feedKind]);
      if (requestId !== feedRequestId.current) return;

      setFeedItems(page.results);
      setNextPageUrl(page.next);
      setFeedState('ready');
    } catch (error) {
      if (requestId !== feedRequestId.current) return;

      const message = error instanceof MediaFeedError
        ? error.message
        : 'Unable to load the feed. Please try again.';
      setFeedError(message);
      setFeedState('error');

      if (error instanceof MediaFeedError && error.status === 401) {
        clearFeed();
        setCurrentUser(null);
        setSessionMessage(message);
      }
    } finally {
      if (requestId === feedRequestId.current) setIsRefreshing(false);
    }
  }, [clearFeed, feedKind]);

  const loadMore = useCallback(async () => {
    if (!nextPageUrl || isLoadingMoreRef.current || feedState !== 'ready') return;

    const requestId = feedRequestId.current;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setFeedError('');

    try {
      const page = await getFeed(nextPageUrl);
      if (requestId !== feedRequestId.current) return;

      setFeedItems((currentItems) => {
        const existingIds = new Set(currentItems.map((item) => item.id));
        return [
          ...currentItems,
          ...page.results.filter((item) => !existingIds.has(item.id)),
        ];
      });
      setNextPageUrl(page.next);
    } catch (error) {
      if (requestId !== feedRequestId.current) return;

      const message = error instanceof MediaFeedError
        ? error.message
        : 'Unable to load more media. Please try again.';

      if (error instanceof MediaFeedError && error.status === 401) {
        clearFeed();
        setCurrentUser(null);
        setSessionMessage(message);
      } else {
        setFeedError(message);
      }
    } finally {
      isLoadingMoreRef.current = false;
      if (requestId === feedRequestId.current) setIsLoadingMore(false);
    }
  }, [clearFeed, feedState, nextPageUrl]);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        if (!(await hasStoredSession())) return;
        const user = await getCurrentUser();
        if (isMounted) setCurrentUser(user);
      } catch (error) {
        if (isMounted) {
          setSessionMessage(
            error instanceof Error ? error.message : 'Unable to restore the saved session.',
          );
        }
      } finally {
        if (isMounted) setIsCheckingSession(false);
      }
    };

    void restoreSession();
    return () => {
      isMounted = false;
      feedRequestId.current += 1;
    };
  }, []);

  useEffect(() => {
    if (isCheckingSession || !currentUser) return;
    const timer = setTimeout(() => void loadFeed(), 0);
    return () => clearTimeout(timer);
  }, [currentUser, isCheckingSession, loadFeed]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setSessionMessage('');

    try {
      await logout();
      clearFeed();
      setCurrentUser(null);
      setSessionMessage('You have been logged out.');
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : 'Unable to log out.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const retryFeed = () => {
    if (feedItems.length > 0 && nextPageUrl) void loadMore();
    else void loadFeed();
  };

  const visibleFeedItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return feedItems;

    return feedItems.filter((item) =>
      [item.user, item.user_full_name, item.media_type, item.caption, item.title]
        .some((value) => String(value || '').toLowerCase().includes(query)),
    );
  }, [feedItems, searchQuery]);

  const selectFeed = (kind: FeedKind) => {
    if (kind === feedKind) return;
    setFeedKind(kind);
    setSearchQuery('');
  };

  const fullName = currentUser?.full_name.trim() || currentUser?.username || '';
  const listHeader = (
    <View style={styles.headerContent}>
      {isCheckingSession ? (
        <StatePanel title="Checking saved session..." variant="loading" />
      ) : currentUser ? (
        <>
          {menuOpen ? <>
          <View style={styles.accountBar}>
            <Pressable
              accessibilityLabel="Open profile"
              accessibilityRole="button"
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [styles.accountIdentity, pressed && styles.pressed]}>
              <Avatar label={fullName} size={40} uri={currentUser.profile_picture} />
              <View style={styles.accountText}>
                <Text numberOfLines={1} style={styles.userName}>{fullName}</Text>
                <Text numberOfLines={1} style={styles.userMeta}>@{currentUser.username}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel="Search people"
              accessibilityRole="button"
              onPress={() => router.push('/search')}
              style={({ pressed }) => [styles.iconAction, pressed && styles.iconActionPressed]}>
              <Ionicons color={colors.text} name="people-outline" size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel="Log out"
              accessibilityRole="button"
              disabled={isLoggingOut}
              onPress={() => void handleLogout()}
              style={({ pressed }) => [
                styles.iconAction,
                isLoggingOut && styles.disabled,
                pressed && styles.iconActionPressed,
              ]}>
              <Ionicons
                color={colors.text}
                name={isLoggingOut ? 'hourglass-outline' : 'log-out-outline'}
                size={20}
              />
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" onPress={() => router.push('/menu')} style={styles.menuLink}>
            <Text style={styles.menuLinkText}>More settings and support</Text><FeedIcon name="chevron" size={16} />
          </Pressable>
          </> : null}

          <View style={styles.searchBox}>
            <FeedIcon color="#5e646f" name="search" size={22} />
            <TextInput
              accessibilityLabel="Filter loaded feed"
              autoCapitalize="none"
              onChangeText={setSearchQuery}
              placeholder="Search"
              placeholderTextColor="#777c86"
              style={styles.searchInput}
              value={searchQuery}
            />
          </View>

          {menuOpen ? <View accessibilityRole="tablist" style={styles.feedTabs}>
            {feedTabs.map(([kind, label]) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: feedKind === kind }}
                key={kind}
                onPress={() => selectFeed(kind)}
                style={[styles.feedTab, feedKind === kind && styles.feedTabActive]}>
                <Text
                  numberOfLines={1}
                  style={[styles.feedTabText, feedKind === kind && styles.feedTabTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View> : null}

          {feedItems.length > 0 && feedError ? (
            <StatePanel actionLabel="Retry" onAction={retryFeed} title={feedError} variant="error" />
          ) : null}
        </>
      ) : (
        <View style={styles.loggedOutCard}>
          <View style={styles.loggedOutIcon}>
            <Ionicons color={colors.text} name="images-outline" size={28} />
          </View>
          <Text style={styles.loggedOutTitle}>Welcome to Media</Text>
          <Text style={styles.loggedOutText}>
            Sign in to view and share photos, videos, and stories from the community.
          </Text>
          <AppButton label="Login" onPress={() => router.push('/login')} />
          <AppButton label="Create Account" onPress={() => router.push('/register')} variant="secondary" />
        </View>
      )}

      {sessionMessage ? (
        <Text accessibilityLiveRegion="polite" style={styles.sessionMessage}>{sessionMessage}</Text>
      ) : null}
    </View>
  );

  const listEmpty = currentUser ? (
    <View style={styles.emptyState}>
      {feedState === 'loading' ? (
        <StatePanel title="Loading feed..." variant="loading" />
      ) : feedState === 'error' ? (
        <StatePanel actionLabel="Retry" onAction={retryFeed} title={feedError} variant="error" />
      ) : feedState === 'ready' ? (
        <StatePanel
          actionLabel="Upload Media"
          message="Share your first photo, video, or post."
          onAction={() => router.push('/upload')}
          title={searchQuery.trim() ? 'No matching posts' : 'No posts yet'}
          variant="empty"
        />
      ) : null}
    </View>
  ) : null;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.appHeader}>
        <View style={styles.appHeaderInner}>
          {currentUser ? (
            <Pressable
              accessibilityLabel="Feed options"
              accessibilityRole="button"
              accessibilityState={{ expanded: menuOpen }}
              onPress={() => setMenuOpen((value) => !value)}
              style={({ pressed }) => [styles.headerAction, pressed && styles.iconActionPressed]}>
              <FeedIcon name="menu" />
            </Pressable>
          ) : <View style={styles.headerActionPlaceholder} />}

          <Text style={styles.appTitle}>Media</Text>

          {currentUser ? (
            <Pressable
              accessibilityLabel="Create a post"
              accessibilityRole="button"
              onPress={() => router.push('/upload')}
              style={({ pressed }) => [styles.createAction, pressed && styles.createActionPressed]}>
              <FeedIcon color="#fff" name="plus" />
            </Pressable>
          ) : <View style={styles.headerActionPlaceholder} />}
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.container}
        data={currentUser ? visibleFeedItems : []}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={isLoadingMore ? (
          <ActivityIndicator accessibilityLabel="Loading more media" color={colors.primary} style={styles.loadMoreIndicator} />
        ) : null}
        ListHeaderComponent={listHeader}
        onEndReached={currentUser ? loadMore : undefined}
        onEndReachedThreshold={0.4}
        onRefresh={currentUser ? () => void loadFeed(true) : undefined}
        refreshing={currentUser ? isRefreshing : false}
        renderItem={({ item }) => <MediaCard media={item} />}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
      {currentUser ? <FeedBottomNav /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#fafbfc', flex: 1 },
  list: { backgroundColor: '#fafbfc', alignSelf: 'center', width: '100%', maxWidth: layout.feedMaxWidth },
  appHeader: {
    backgroundColor: '#fafbfc',
    zIndex: 2,
  },
  appHeaderInner: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: layout.feedMaxWidth,
    paddingHorizontal: 17,
    paddingTop: 20,
    paddingBottom: 16,
    width: '100%',
  },
  appTitle: { color: '#101114', fontSize: 27, fontWeight: '700', letterSpacing: -1 },
  headerAction: {
    alignItems: 'center',
    backgroundColor: '#fcfcfd',
    borderRadius: 12,
    shadowColor: '#202330', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 7,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  createAction: {
    alignItems: 'center',
    backgroundColor: '#262729',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  createActionPressed: { backgroundColor: colors.primaryPressed },
  headerActionPlaceholder: { height: 44, width: 44 },
  container: {
    flexGrow: 1,
    paddingBottom: bottomNavBaseHeight + spacing.xxxl,
    paddingHorizontal: 13,
  },
  headerContent: { alignSelf: 'center', maxWidth: layout.feedMaxWidth, width: '100%' },
  accountBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
    padding: spacing.md,
    shadowColor: colors.ink,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  accountIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', minWidth: 0 },
  accountText: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  userName: { color: colors.text, fontSize: fontSize.body, fontWeight: '800' },
  userMeta: { color: colors.textMuted, fontSize: fontSize.caption, marginTop: 2 },
  iconAction: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.small,
    height: 40,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: 40,
  },
  iconActionPressed: { opacity: 0.65 },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#eff0f4',
    borderRadius: 18,
    flexDirection: 'row',
    marginHorizontal: 4,
    marginBottom: 16,
    minHeight: 42,
    paddingHorizontal: spacing.lg,
  },
  searchInput: { color: '#101114', flex: 1, fontSize: 16, paddingLeft: 12, minHeight: 42 },
  menuLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, marginBottom: 12 },
  menuLinkText: { color: '#101114', fontSize: 14 },
  feedTabs: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.round,
    flexDirection: 'row',
    marginBottom: spacing.xl,
    padding: spacing.xs,
  },
  feedTab: {
    alignItems: 'center',
    borderRadius: radius.round,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 2,
  },
  feedTabActive: { backgroundColor: colors.ink },
  feedTabText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  feedTabTextActive: { color: colors.white },
  loggedOutCard: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.authCard,
    borderWidth: 1,
    gap: spacing.md,
    maxWidth: layout.contentMaxWidth,
    padding: spacing.xxl,
    width: '100%',
  },
  loggedOutIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.input,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  loggedOutTitle: { color: colors.text, fontSize: fontSize.section, fontWeight: '900', textAlign: 'center' },
  loggedOutText: { color: colors.textMuted, fontSize: fontSize.body, lineHeight: 21, marginBottom: spacing.sm, textAlign: 'center' },
  sessionMessage: { color: colors.textSecondary, fontSize: fontSize.body, marginBottom: spacing.lg, marginTop: spacing.md, textAlign: 'center' },
  emptyState: { alignSelf: 'center', maxWidth: layout.feedMaxWidth, minHeight: 190, width: '100%' },
  loadMoreIndicator: { marginBottom: spacing.lg },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
