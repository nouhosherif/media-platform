import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';

interface AppInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  rightActionLabel?: string;
  onRightAction?: () => void;
}

export default function AppInput({
  label,
  error,
  rightActionLabel,
  onRightAction,
  editable = true,
  onBlur,
  onFocus,
  ...inputProps
}: AppInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          isFocused && styles.inputShellFocused,
          error && styles.inputShellError,
          !editable && styles.disabled,
        ]}>
        <TextInput
          {...inputProps}
          editable={editable}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
        />
        {rightActionLabel && onRightAction ? (
          <Pressable
            accessibilityRole="button"
            disabled={!editable}
            onPress={onRightAction}
            style={styles.rightAction}>
            <Text style={styles.rightActionText}>{rightActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radius.input,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
  },
  inputShellFocused: {
    borderColor: colors.primary,
  },
  inputShellError: {
    borderColor: colors.error,
  },
  disabled: {
    opacity: 0.6,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: fontSize.input,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rightAction: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  rightActionText: {
    color: colors.primary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  error: {
    color: colors.error,
    fontSize: fontSize.caption,
    marginTop: spacing.xs,
  },
});
