import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';

function formatSeconds(value: number) {
  const total = Math.max(0, Math.round(value));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function VoiceMessagePlayer({ duration, uri }: { duration: number | null; uri: string }) {
  const player = useAudioPlayer(uri, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) {
      await player.seekTo(0);
    }
    player.play();
  };

  return (
    <View style={styles.player}>
      <Pressable accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'} onPress={() => void toggle()} style={styles.button}>
        <Ionicons color={colors.primary} name={status.playing ? 'pause' : 'play'} size={20} />
      </Pressable>
      <View style={styles.track}><View style={[styles.progress, { width: `${status.duration ? Math.min(status.currentTime / status.duration, 1) * 100 : 0}%` }]} /></View>
      <Text style={styles.duration}>{formatSeconds(status.duration || duration || 0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  player: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minWidth: 190 },
  button: { alignItems: 'center', backgroundColor: colors.skySurface, borderRadius: radius.round, height: 36, justifyContent: 'center', width: 36 },
  track: { backgroundColor: colors.borderStrong, borderRadius: radius.round, flex: 1, height: 4, overflow: 'hidden' },
  progress: { backgroundColor: colors.primary, height: '100%' },
  duration: { color: colors.textMuted, fontSize: fontSize.caption },
});
