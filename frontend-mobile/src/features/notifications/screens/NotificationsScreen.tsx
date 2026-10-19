import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomNav, { bottomNavBaseHeight } from '@/components/BottomNav';
import AppHeader from '@/components/ui/AppHeader';
import Avatar from '@/components/ui/Avatar';
import StatePanel from '@/components/ui/StatePanel';
import { colors, fontSize, layout, radius, spacing } from '@/constants/theme';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationServiceError,
} from '@/services/notifications';
import type { AppNotification, NotificationPage } from '@/types/notifications';

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [page, setPage] = useState<NotificationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      setPage(await getNotifications());
    } catch (caught) {
      setError(caught instanceof NotificationServiceError ? caught.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const openNotification = async (item: AppNotification) => {
    if (!item.is_read) {
      try {
        const updated = await markNotificationRead(item.id);
        setPage((current) => current ? {
          ...current,
          unread_count: Math.max(current.unread_count - 1, 0),
          results: current.results.map((value) => value.id === item.id ? updated : value),
        } : current);
      } catch (caught) {
        setError(caught instanceof NotificationServiceError ? caught.message : 'Unable to update this notification.');
      }
    }

    const profileMatch = item.target_url.match(/^\/profile\/(\d+)/);
    const messageMatch = item.target_url.match(/^\/messages\?user=(\d+)/);
    if (profileMatch) {
      router.push({ pathname: '/profile/[userId]', params: { userId: profileMatch[1] } });
    } else if (messageMatch) {
      router.push({ pathname: '/messages', params: { user: messageMatch[1] } });
    } else if (item.actor) {
      router.push({ pathname: '/profile/[userId]', params: { userId: item.actor.id } });
    }
  };

  const markAll = async () => {
    if (!page?.unread_count || updating) return;
    setUpdating(true);
    setError('');
    try {
      await markAllNotificationsRead();
      setPage((current) => current ? { ...current, unread_count: 0, results: current.results.map((item) => ({ ...item, is_read: true })) } : current);
    } catch (caught) {
      setError(caught instanceof NotificationServiceError ? caught.message : 'Unable to update notifications.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader
        leftAction={{ accessibilityLabel: 'Return home', label: 'Home', onPress: () => router.back() }}
        rightAction={page?.unread_count ? { accessibilityLabel: 'Mark all read', disabled: updating, label: updating ? 'Wait' : 'Read all', onPress: () => void markAll() } : undefined}
        title="Notifications"
      />
      <View style={styles.shell}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          contentContainerStyle={styles.content}
          data={page?.results ?? []}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            loading ? <StatePanel title="Loading notifications..." variant="loading" /> :
              error ? <StatePanel actionLabel="Retry" onAction={() => void load()} title={error} variant="error" /> :
                <StatePanel message="New activity will appear here." title="No notifications" variant="empty" />
          }
          onRefresh={() => void load(true)}
          refreshing={refreshing}
          renderItem={({ item }) => (
            <Pressable onPress={() => void openNotification(item)} style={[styles.row, !item.is_read && styles.unread]}>
              <Avatar label={item.actor?.full_name || item.actor?.username || ''} size={46} uri={item.actor?.profile_picture} />
              <View style={styles.copy}>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>{formatTime(item.created_at)}</Text>
              </View>
              {!item.is_read ? <View accessibilityLabel="Unread" style={styles.dot} /> : <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />}
            </Pressable>
          )}
        />
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.feedBackground, flex: 1 },
  shell: { alignSelf: 'center', flex: 1, maxWidth: layout.feedMaxWidth, width: '100%' },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: bottomNavBaseHeight + spacing.xxxl },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.input, borderWidth: 1, flexDirection: 'row', marginBottom: spacing.sm, minHeight: 78, padding: spacing.md },
  unread: { backgroundColor: colors.surfaceStrong },
  copy: { flex: 1, marginHorizontal: spacing.md },
  message: { color: colors.text, fontSize: fontSize.body, lineHeight: 19 },
  time: { color: colors.textMuted, fontSize: fontSize.caption, marginTop: spacing.xs },
  dot: { backgroundColor: colors.primary, borderRadius: radius.round, height: 9, width: 9 },
  error: { backgroundColor: colors.errorSurface, color: colors.error, fontSize: fontSize.caption, padding: spacing.sm },
});
