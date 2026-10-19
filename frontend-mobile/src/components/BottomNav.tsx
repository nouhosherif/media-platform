import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/constants/theme';

const items = [
  { label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/' },
  { label: 'Videos', icon: 'videocam-outline', activeIcon: 'videocam', route: '/videos' },
  { label: 'Messages', icon: 'chatbubble-outline', activeIcon: 'chatbubble', route: '/messages' },
  { label: 'Notifications', icon: 'notifications-outline', activeIcon: 'notifications', route: '/notifications' },
  { label: 'Profile', icon: 'person-outline', activeIcon: 'person', route: '/profile' },
] as const;

export const bottomNavBaseHeight = 72;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = pathname === '/videos' || pathname.startsWith('/videos/') || pathname === '/messages';

  return (
    <View style={[
      styles.nav,
      dark && styles.navDark,
      { paddingBottom: Math.max(insets.bottom, spacing.sm) },
    ]}>
      {items.map((item) => {
        const isActive =
          item.route === '/'
            ? pathname === '/'
            : pathname === item.route || pathname.startsWith(`${item.route}/`);

        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="button"
            key={item.route}
            onPress={() => router.navigate(item.route as Href)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Ionicons
              color={isActive
                ? (dark ? colors.darkText : colors.text)
                : (dark ? colors.darkMuted : colors.textMuted)}
              name={isActive ? item.activeIcon : item.icon}
              size={layout.navIconSize}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: dark ? colors.darkMuted : colors.textMuted },
                isActive && { color: dark ? colors.darkText : colors.text },
              ]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    elevation: 12,
    flexDirection: 'row',
    left: 0,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    position: 'absolute',
    right: 0,
    shadowColor: colors.ink,
    shadowOffset: { height: -8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  navDark: {
    backgroundColor: 'rgba(17,18,20,0.94)',
    borderTopColor: colors.darkBorder,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    minHeight: 48,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    maxWidth: '100%',
  },
});
