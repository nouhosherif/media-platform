import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import UserRow from '@/components/UserRow';
import AppHeader from '@/components/ui/AppHeader';
import StatePanel from '@/components/ui/StatePanel';
import { colors, fontSize, layout, radius, spacing } from '@/constants/theme';
import { searchUsers, UserServiceError } from '@/services/users';
import type { SocialUser } from '@/types/user';

export default function SearchScreen() {
  const router = useRouter();
  const requestId = useRef(0);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const results = await searchUsers(query);
        if (id === requestId.current) setUsers(results);
      } catch (caught) {
        if (id === requestId.current) {
          setError(caught instanceof UserServiceError ? caught.message : 'Unable to search users.');
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, retryKey]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <AppHeader
        leftAction={{ accessibilityLabel: 'Return home', label: 'Home', onPress: () => router.back() }}
        rightAction={{ accessibilityLabel: 'Open follows', label: 'Follows', onPress: () => router.push('/follows') }}
        title="Find People"
      />
      <View style={styles.shell}>
        <View style={styles.searchBox}>
          <Ionicons color={colors.textMuted} name="search" size={19} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Search username or name"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
        </View>
        <FlatList
          contentContainerStyle={styles.content}
          data={users}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loading ? (
              <StatePanel title="Searching people..." variant="loading" />
            ) : error ? (
              <StatePanel actionLabel="Retry" onAction={() => setRetryKey((value) => value + 1)} title={error} variant="error" />
            ) : (
              <StatePanel message="Try another username or name." title="No people found" variant="empty" />
            )
          }
          renderItem={({ item }) => <UserRow user={item} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.feedBackground, flex: 1 },
  shell: { alignSelf: 'center', flex: 1, maxWidth: layout.feedMaxWidth, width: '100%' },
  searchBox: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', margin: spacing.lg, paddingHorizontal: spacing.md },
  input: { color: colors.text, flex: 1, fontSize: fontSize.input, minHeight: 46, paddingLeft: spacing.sm },
  content: { flexGrow: 1, paddingBottom: spacing.xxxl },
});
