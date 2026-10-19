import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedIcon from './FeedIcon';

const items = [
  ['Home', '/', 'home'], ['Videos', '/videos', 'video'], ['Message', '/messages', 'message'],
  ['Notification', '/notifications', 'notification'], ['Profile', '/profile', 'user'],
] as const;

export default function FeedBottomNav() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  return <View style={[styles.nav, { paddingBottom: Math.max(bottom, 12) }]}>
    {items.map(([label, route, icon]) => <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ selected: route === '/' }} key={route} onPress={() => router.navigate(route as Href)} style={styles.item}>
      <FeedIcon name={icon} color={route === '/' ? '#08090b' : '#565e68'} />
      <Text style={[styles.label, route === '/' && styles.activeLabel]}>{label}</Text>
      {route === '/' ? <View style={styles.indicator} /> : null}
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  nav: { position: 'absolute', bottom: 0, alignSelf: 'center', width: '100%', maxWidth: 640, flexDirection: 'row', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 8, shadowColor: '#242735', shadowOffset: { width: 0, height: -3 }, shadowRadius: 11, shadowOpacity: 0.04, elevation: 8 },
  item: { flex: 1, alignItems: 'center', gap: 5, paddingBottom: 10 },
  label: { fontSize: 11, lineHeight: 14, color: '#737983' },
  activeLabel: { color: '#08090b', fontWeight: '700' },
  indicator: { position: 'absolute', bottom: 0, width: 22, height: 4, borderRadius: 3, backgroundColor: '#08090b' },
});
