import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/ui/AppButton';
import { colors, fontSize, radius, spacing } from '@/constants/theme';

type StatePanelVariant = 'loading' | 'empty' | 'error' | 'success';

interface StatePanelProps {
  title: string;
  message?: string;
  variant: StatePanelVariant;
  actionLabel?: string;
  onAction?: () => void;
  dark?: boolean;
}

export default function StatePanel({
  title,
  message,
  variant,
  actionLabel,
  onAction,
  dark = false,
}: StatePanelProps) {
  return (
    <View
      style={[
        styles.panel,
        dark && styles.darkPanel,
        variant === 'empty' && styles.emptyPanel,
        variant === 'error' && styles.errorPanel,
        variant === 'success' && styles.successPanel,
      ]}>
      {variant === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
      <Text
        accessibilityLiveRegion={variant === 'error' ? 'polite' : undefined}
        style={[
          styles.title,
          dark && styles.darkTitle,
          variant === 'error' && styles.errorText,
          variant === 'success' && styles.successText,
        ]}>
        {title}
      </Text>
      {message ? <Text style={[styles.message, dark && styles.darkMessage]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <AppButton
          compact
          label={actionLabel}
          onPress={onAction}
          style={styles.action}
          variant={variant === 'error' ? 'primary' : 'secondary'}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.xl,
  },
  emptyPanel: {
    borderStyle: 'dashed',
  },
  errorPanel: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.errorBorder,
  },
  successPanel: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successBorder,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    color: colors.error,
  },
  successText: {
    color: colors.success,
  },
  message: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.md,
  },
  darkPanel: { backgroundColor: colors.darkSurfaceRaised, borderColor: colors.darkBorder },
  darkTitle: { color: colors.darkText },
  darkMessage: { color: colors.darkMuted },
});
