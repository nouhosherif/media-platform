import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';

interface HeaderAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  emphasis?: boolean;
}

interface AppHeaderProps {
  title: string;
  leftAction?: HeaderAction;
  rightAction?: HeaderAction;
  dark?: boolean;
}

function HeaderActionButton({ action, dark = false }: { action?: HeaderAction; dark?: boolean }) {
  if (!action) {
    return <View style={styles.actionSlot} />;
  }

  return (
    <View style={styles.actionSlot}>
      <Pressable
        accessibilityLabel={action.accessibilityLabel}
        accessibilityRole="button"
        disabled={action.disabled}
        onPress={action.onPress}
        style={({ pressed }) => [
          styles.action,
          action.emphasis ? styles.emphasisAction : dark ? styles.darkAction : styles.neutralAction,
          pressed && !action.disabled && styles.actionPressed,
          action.disabled && styles.actionDisabled,
        ]}>
        <Text
          numberOfLines={1}
          style={[
            styles.actionText,
            action.emphasis ? styles.emphasisActionText : dark ? styles.darkActionText : styles.neutralActionText,
          ]}>
          {action.label}
        </Text>
      </Pressable>
    </View>
  );
}

export default function AppHeader({
  title,
  leftAction,
  rightAction,
  dark = false,
}: AppHeaderProps) {
  return (
    <View style={[styles.header, dark && styles.headerDark]}>
      <HeaderActionButton action={leftAction} dark={dark} />
      <Text numberOfLines={1} style={[styles.title, dark && styles.titleDark]}>
        {title}
      </Text>
      <HeaderActionButton action={rightAction} dark={dark} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: fontSize.screenTitle,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleDark: { color: colors.darkText },
  actionSlot: {
    alignItems: 'center',
    minWidth: 76,
  },
  action: {
    alignItems: 'center',
    borderRadius: radius.card,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 68,
    paddingHorizontal: spacing.sm,
  },
  neutralAction: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  darkAction: {
    backgroundColor: colors.darkSurfaceRaised,
    borderColor: colors.darkBorder,
    borderWidth: 1,
  },
  emphasisAction: {
    backgroundColor: colors.ink,
  },
  actionPressed: {
    opacity: 0.76,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionText: {
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  neutralActionText: {
    color: colors.textSecondary,
  },
  darkActionText: { color: colors.darkText },
  emphasisActionText: {
    color: colors.white,
  },
  headerDark: {
    backgroundColor: colors.darkSurface,
    borderBottomColor: colors.darkBorder,
  },
});
