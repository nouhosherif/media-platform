import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '@/components/ui/AppButton';
import AppInput from '@/components/ui/AppInput';
import { colors, fontSize, layout, radius, spacing } from '@/constants/theme';
import { AuthenticationError, login } from '@/services/auth';

interface ValidationErrors {
  identifier?: string;
  password?: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [backendError, setBackendError] = useState('');

  const submitLogin = async () => {
    const errors: ValidationErrors = {};

    if (!identifier.trim()) {
      errors.identifier = 'Enter your username or email.';
    }

    if (!password) {
      errors.password = 'Enter your password.';
    }

    setValidationErrors(errors);
    setBackendError('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ username: identifier, password });
      router.replace('/');
    } catch (error) {
      setBackendError(
        error instanceof AuthenticationError
          ? error.message
          : 'Unable to sign in. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.authCard}>
            <Text style={styles.brand}>Media Platform</Text>
            <Text style={styles.title}>Welcome Back</Text>

            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              error={validationErrors.identifier}
              label="Email or username"
              onChangeText={setIdentifier}
              placeholder="Enter email or username"
              returnKeyType="next"
              textContentType="username"
              value={identifier}
            />

            <AppInput
              editable={!isSubmitting}
              error={validationErrors.password}
              label="Password"
              onChangeText={setPassword}
              onSubmitEditing={() => void submitLogin()}
              onRightAction={() => setShowPassword((currentValue) => !currentValue)}
              placeholder="Enter password"
              returnKeyType="done"
              rightActionLabel={showPassword ? 'Hide' : 'Show'}
              secureTextEntry={!showPassword}
              textContentType="password"
              value={password}
            />

            {backendError ? (
              <View style={styles.errorPanel}>
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                  {backendError}
                </Text>
              </View>
            ) : null}

            <AppButton
              label="Login"
              loading={isSubmitting}
              onPress={() => void submitLogin()}
              style={styles.submitButton}
            />

            <View style={styles.accountPrompt}>
              <Text style={styles.accountPromptText}>Don&apos;t have an account?</Text>
              <Pressable
                accessibilityRole="link"
                disabled={isSubmitting}
                onPress={() => router.push('/register')}>
                <Text style={styles.accountLink}>Sign up</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  authCard: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.authCard,
    elevation: 4,
    maxWidth: layout.contentMaxWidth,
    padding: spacing.xxl,
    shadowColor: '#0f172a',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    width: '100%',
  },
  brand: {
    color: colors.primary,
    fontSize: fontSize.body,
    fontWeight: '800',
    textAlign: 'center',
  },
  title: {
    color: colors.text,
    fontSize: fontSize.authTitle,
    fontWeight: '800',
    marginBottom: spacing.xxl,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  errorPanel: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.errorBorder,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: spacing.lg,
  },
  accountPrompt: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  accountPromptText: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
  },
  accountLink: {
    color: colors.primary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});
