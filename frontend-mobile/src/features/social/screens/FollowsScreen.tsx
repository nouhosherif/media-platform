import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import UserRow from '@/components/UserRow';
import AppHeader from '@/components/ui/AppHeader';
import StatePanel from '@/components/ui/StatePanel';
import { colors, fontSize, layout, radius, spacing } from '@/constants/theme';
import { getFollowDirectory, UserServiceError } from '@/services/users';
import type { FollowDirectory, FollowDirectoryTab } from '@/types/user';

const tabs: { label: string; value: FollowDirectoryTab }[] = [
  { label: 'Discover', value: 'discover' },
  { label: 'Followers', value: 'followers' },
  { label: 'Following', value: 'following' },
];

export default function FollowsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: FollowDirectoryTab }>();
  const requestId = useRef(0);
  const initialTab = tabs.some((item) => item.value === params.tab) ? params.tab : 'discover';
  const [tab, setTab] = useState<FollowDirectoryTab>(initialTab ?? 'discover');
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState<FollowDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    const id = ++requestId.current;
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const result = await getFollowDirectory(tab, query);
      if (id === requestId.current) setDirectory(result);
    } catch (caught) {
      if (id === requestId.current) {
        setError(caught instanceof UserServiceError ? caught.message : 'Unable to load people.');
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [query, tab]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <AppHeader leftAction={{ accessibilityLabel: 'Return to profile', label: 'Profile', onPress: () => router.back() }} title="People" />
      <View style={styles.shell}>
        <View style={styles.counts}>
          <Text style={styles.count}><Text style={styles.bold}>{directory?.followers_count ?? 0}</Text> followers</Text>
          <Text style={styles.count}><Text style={styles.bold}>{directory?.following_count ?? 0}</Text> following</Text>
        </View>
        <View style={styles.tabs}>
          {tabs.map((item) => (
            <Pressable key={item.value} onPress={() => setTab(item.value)} style={[styles.tab, tab === item.value && styles.activeTab]}>
              <Text style={[styles.tabText, tab === item.value && styles.activeTabText]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.searchBox}>
          <Ionicons color={colors.textMuted} name="search" size={18} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Search people"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={query}
          />
        </View>
        <FlatList
          contentContainerStyle={styles.content}
          data={directory?.results ?? []}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            loading ? <StatePanel title="Loading people..." variant="loading" /> :
              error ? <StatePanel actionLabel="Retry" onAction={() => void load()} title={error} variant="error" /> :
                <StatePanel title="No people found" variant="empty" />
          }
          onRefresh={() => void load(true)}
          refreshing={refreshing}
          renderItem={({ item }) => (
            <UserRow
              onFollowChanged={(updated) =>
                setDirectory((current) => {
                  if (!current) return current;
                  const previous = current.results.find((user) => user.id === updated.id);
                  const followingDelta = previous?.is_following === updated.is_following
                    ? 0
                    : updated.is_following ? 1 : -1;
                  return {
                    ...current,
                    following_count: Math.max(current.following_count + followingDelta, 0),
                    results: current.results.map((user) => user.id === updated.id ? updated : user),
                  };
                })
              }
              user={item}
            />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.feedBackground, flex: 1 },
  shell: { alignSelf: 'center', flex: 1, maxWidth: layout.feedMaxWidth, width: '100%' },
  counts: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center', padding: spacing.md },
  count: { color: colors.textMuted, fontSize: fontSize.body },
  bold: { color: colors.text, fontWeight: '800' },
  tabs: { backgroundColor: colors.surfaceStrong, borderRadius: radius.card, flexDirection: 'row', marginHorizontal: spacing.lg, padding: 3 },
  tab: { alignItems: 'center', borderRadius: radius.small, flex: 1, minHeight: 38, justifyContent: 'center' },
  activeTab: { backgroundColor: colors.surface },
  tabText: { color: colors.textMuted, fontSize: fontSize.caption, fontWeight: '700' },
  activeTabText: { color: colors.primary },
  searchBox: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', margin: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  input: { color: colors.text, flex: 1, fontSize: fontSize.body, minHeight: 44, paddingLeft: spacing.sm },
  content: { flexGrow: 1, paddingBottom: spacing.xxxl },
});
