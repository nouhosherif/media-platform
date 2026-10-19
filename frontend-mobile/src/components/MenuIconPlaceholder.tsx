import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

interface MenuIconPlaceholderProps {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function MenuIconPlaceholder({
  accessibilityLabel,
  icon,
}: MenuIconPlaceholderProps) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View accessible accessibilityLabel={accessibilityLabel} style={styles.iconShell}>
        <Ionicons color={colors.primary} name={icon} size={96} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.feedBackground,
    flex: 1,
  },
  iconShell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
