import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

interface AvatarProps {
  label: string;
  uri?: string | null;
  size?: number;
}

export default function Avatar({ label, uri, size = 44 }: AvatarProps) {
  const normalizedUri = uri?.trim() || null;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = normalizedUri && normalizedUri !== failedUri;
  const initial = label.trim().charAt(0).toUpperCase();

  if (showImage) {
    return (
      <Image
        accessibilityLabel={`${label} profile photo`}
        onError={() => setFailedUri(normalizedUri)}
        source={{ uri: normalizedUri }}
        style={{ borderRadius: size / 2, height: size, width: size }}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { borderRadius: size / 2, height: size, width: size },
      ]}>
      {initial ? (
        <Text style={[styles.initial, { fontSize: Math.max(size * 0.38, 14) }]}>
          {initial}
        </Text>
      ) : (
        <Ionicons color={colors.textMuted} name="person-outline" size={size * 0.45} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: colors.skySurface,
    justifyContent: 'center',
  },
  initial: {
    color: colors.skyText,
    fontWeight: '800',
  },
});
