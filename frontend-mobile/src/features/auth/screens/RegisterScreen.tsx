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
import {
  register,
  RegistrationError,
  RegistrationFieldErrors,
} from '@/services/auth';

interface ClientValidationErrors extends RegistrationFieldErrors {
  confirmPassword?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] =
    useState<ClientValidationErrors>({});
  const [backendError, setBackendError] = useState('');

  const submitRegistration = async () => {
    const errors: ClientValidationErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = 'Enter your email address.';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Enter a password.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setValidationErrors(errors);
    setBackendError('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        username: username.trim() || undefined,
        email: trimmedEmail,
        password,
      });
      router.replace('/');
    } catch (error) {
      if (error instanceof RegistrationError) {
        setValidationErrors(error.fieldErrors);

        if (Object.keys(error.fieldErrors).length === 0) {
          setBackendError(error.message);
        }
      } else {
        setBackendError('Unable to create the account. Please try again.');
      }
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
            <Text style={styles.title}>Sign up to create account</Text>

            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              error={validationErrors.username}
              label="Username (optional)"
              onChangeText={setUsername}
              placeholder="Choose a username"
              textContentType="username"
              value={username}
            />

            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              error={validationErrors.email}
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              placeholder="Enter your email"
              textContentType="emailAddress"
              value={email}
            />

            <AppInput
              editable={!isSubmitting}
              error={validationErrors.password}
              label="Create Password"
              onChangeText={setPassword}
              onRightAction={() => setShowPassword((currentValue) => !currentValue)}
              placeholder="Enter a password"
              rightActionLabel={showPassword ? 'Hide' : 'Show'}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              value={password}
            />

            <AppInput
              editable={!isSubmitting}
              error={validationErrors.confirmPassword}
              label="Confirm Password"
              onChangeText={setConfirmPassword}
              onSubmitEditing={() => void submitRegistration()}
              placeholder="Re-enter your password"
              returnKeyType="done"
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              value={confirmPassword}
            />

            {backendError ? (
              <View style={styles.errorPanel}>
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                  {backendError}
                </Text>
              </View>
            ) : null}

            <AppButton
              label="Sign Up"
              loading={isSubmitting}
              onPress={() => void submitRegistration()}
              style={styles.submitButton}
            />

            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptText}>Already have an account?</Text>
              <Pressable
                accessibilityRole="link"
                disabled={isSubmitting}
                onPress={() => router.replace('/login')}>
                <Text style={styles.loginLink}>Login</Text>
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
  loginPrompt: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  loginPromptText: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
  },
  loginLink: {
    color: colors.primary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});
