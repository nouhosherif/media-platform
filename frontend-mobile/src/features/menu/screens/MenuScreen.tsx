import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomNav, { bottomNavBaseHeight } from '@/components/BottomNav';
import AppHeader from '@/components/ui/AppHeader';
import { colors, fontSize, layout, radius, semanticColors, spacing } from '@/constants/theme';

const options = [
  {
    icon: 'help-circle-outline',
    label: 'Help and Support',
    route: '/menu/help-support',
  },
  {
    icon: 'shield-checkmark-outline',
    label: 'Settings and Privacy',
    route: '/menu/settings-privacy',
  },
] as const;

export default function MenuScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader
        leftAction={{
          accessibilityLabel: 'Return home',
          label: 'Home',
          onPress: () => router.replace('/'),
        }}
        title="Menu"
      />

      <View style={styles.shell}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.route}
            onPress={() => router.push(option.route)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <View style={styles.optionIcon}>
              <Ionicons color={semanticColors.iconPrimary} name={option.icon} size={23} />
            </View>
            <Text style={styles.optionLabel}>{option.label}</Text>
            <Ionicons color={colors.textSubtle} name="chevron-forward" size={20} />
          </Pressable>
        ))}
      </View>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.feedBackground,
    flex: 1,
  },
  shell: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    maxWidth: layout.feedMaxWidth,
    paddingBottom: bottomNavBaseHeight,
    width: '100%',
  },
  option: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 68,
    paddingHorizontal: spacing.lg,
  },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.card,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  optionLabel: {
    color: colors.text,
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '700',
    marginHorizontal: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
