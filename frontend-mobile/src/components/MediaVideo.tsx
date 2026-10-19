import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { colors } from '@/constants/theme';

interface MediaVideoProps {
  uri: string;
  active?: boolean;
  immersive?: boolean;
  loop?: boolean;
  nativeControls?: boolean;
  aspectRatio?: number;
}

export default function MediaVideo({
  uri,
  active,
  immersive = false,
  loop = false,
  nativeControls = true,
  aspectRatio = 4 / 5,
}: MediaVideoProps) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = loop;
  });

  useEffect(() => {
    if (active === undefined) {
      return;
    }

    if (active) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, player]);

  return (
    <VideoView
      contentFit={immersive ? 'cover' : 'contain'}
      fullscreenOptions={{ enable: true }}
      nativeControls={nativeControls}
      player={player}
      style={immersive ? styles.immersiveVideo : [styles.video, { aspectRatio }]}
      surfaceType={immersive ? 'textureView' : undefined}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    aspectRatio: 4 / 5,
    backgroundColor: colors.black,
    width: '100%',
  },
  immersiveVideo: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.black,
  },
});
