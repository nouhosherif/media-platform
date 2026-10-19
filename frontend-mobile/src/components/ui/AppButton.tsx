import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';

type AppButtonVariant = 'primary' | 'dark' | 'secondary';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: AppButtonVariant;
}

export default function AppButton({
  label,
  onPress,
  accessibilityLabel,
  compact = false,
  disabled = false,
  loading = false,
  style,
  variant = 'primary',
}: AppButtonProps) {
  const selectedVariant = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        selectedVariant.button,
        compact ? styles.compactButton : styles.fullButton,
        pressed && !isDisabled && selectedVariant.pressed,
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={selectedVariant.indicator} />
      ) : (
        <Text numberOfLines={1} style={[styles.label, selectedVariant.text]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.button,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  fullButton: {
    alignSelf: 'stretch',
  },
  compactButton: {
    alignSelf: 'center',
    minWidth: 108,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  darkButton: {
    backgroundColor: colors.ink,
  },
  darkPressed: {
    backgroundColor: colors.charcoal,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceStrong,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  lightText: {
    color: colors.white,
  },
  secondaryText: {
    color: colors.textSecondary,
  },
});

const variantStyles = {
  primary: {
    button: styles.primaryButton,
    pressed: styles.primaryPressed,
    text: styles.lightText,
    indicator: colors.white,
  },
  dark: {
    button: styles.darkButton,
    pressed: styles.darkPressed,
    text: styles.lightText,
    indicator: colors.white,
  },
  secondary: {
    button: styles.secondaryButton,
    pressed: styles.secondaryPressed,
    text: styles.secondaryText,
    indicator: colors.text,
  },
} as const;
