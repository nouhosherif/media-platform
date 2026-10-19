import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '@/components/ui/AppButton';
import AppHeader from '@/components/ui/AppHeader';
import StatePanel from '@/components/ui/StatePanel';
import { colors, fontSize, layout, radius, spacing } from '@/constants/theme';
import {
  maxMediaUploadBytes,
  maxMediaUploadCount,
  MediaUploadError,
  uploadMedia,
} from '@/services/media';

const maxCaptionLength = 2200;

function formatFileSize(value?: number) {
  if (!value) {
    return 'Size unavailable';
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.ceil(value / 1024)} KB`;
}

function isImage(asset: ImagePicker.ImagePickerAsset) {
  return asset.type === 'image' || asset.mimeType?.startsWith('image/') === true;
}

function isVideo(asset: ImagePicker.ImagePickerAsset) {
  return asset.type === 'video' || asset.mimeType?.startsWith('video/') === true;
}

export default function UploadScreen() {
  const router = useRouter();
  const [selectedAssets, setSelectedAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [caption, setCaption] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const selectMedia = async () => {
    if (isPicking || isUploading) {
      return;
    }

    setIsPicking(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setErrorMessage('Photo and video access is required to select media.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        mediaTypes: ['images', 'videos'],
        quality: 1,
        selectionLimit: maxMediaUploadCount,
      });

      if (result.canceled) {
        return;
      }

      if (result.assets.length > 1 && result.assets.some((asset) => !isImage(asset))) {
        setErrorMessage('Multiple selection supports photos only.');
        return;
      }

      const oversizedAsset = result.assets.find(
        (asset) => asset.fileSize && asset.fileSize > maxMediaUploadBytes,
      );
      if (oversizedAsset) {
        setErrorMessage(`${oversizedAsset.fileName || 'A selected file'} is larger than 5 MB.`);
        return;
      }

      setSelectedAssets(result.assets);
    } catch {
      setErrorMessage('Unable to open your media library. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  const resetComposer = () => {
    if (isUploading) {
      return;
    }

    setSelectedAssets([]);
    setCaption('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const submitUpload = async () => {
    if (isUploading || (!caption.trim() && selectedAssets.length === 0)) {
      setErrorMessage('Write something or select media to publish.');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const createdItems = await uploadMedia({
        caption,
        sources: selectedAssets.map((asset) => ({
          uri: asset.uri,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          file: asset.file,
        })),
      });
      setSelectedAssets([]);
      setCaption('');
      setSuccessMessage(
        createdItems.length === 1
          ? 'Your post was published successfully.'
          : `${createdItems.length} photo posts were published successfully.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof MediaUploadError
          ? error.message
          : 'Unable to publish this post. Please try again.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader
        leftAction={{ label: 'Back', onPress: () => router.back() }}
        title="Create post"
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {errorMessage ? <StatePanel title={errorMessage} variant="error" /> : null}

        {successMessage ? (
          <StatePanel
            actionLabel="Return Home"
            message="The new content is ready in your feed."
            onAction={() => router.replace('/')}
            title={successMessage}
            variant="success"
          />
        ) : (
          <View style={styles.composerCard}>
            <View style={styles.captionArea}>
              <Text style={styles.label}>Text or caption</Text>
              <TextInput
                accessibilityLabel="Post text or caption"
                editable={!isUploading}
                maxLength={maxCaptionLength}
                multiline
                onChangeText={(value) => {
                  setCaption(value);
                  setErrorMessage('');
                }}
                placeholder="Write something or add a caption"
                placeholderTextColor={colors.textMuted}
                style={styles.captionInput}
                textAlignVertical="top"
                value={caption}
              />
              <Text style={styles.characterCount}>{caption.length}/{maxCaptionLength}</Text>
            </View>

            {selectedAssets.length > 0 ? (
              <View style={styles.previewGrid}>
                {selectedAssets.map((asset) => (
                  <View key={asset.assetId || asset.uri} style={styles.previewTile}>
                    {isImage(asset) ? (
                      <Image
                        accessibilityLabel="Selected photo preview"
                        resizeMode="cover"
                        source={{ uri: asset.uri }}
                        style={styles.previewImage}
                      />
                    ) : isVideo(asset) ? (
                      <View style={styles.videoPreview}>
                        <Text style={styles.videoLabel}>Video selected</Text>
                      </View>
                    ) : null}
                    <View style={styles.fileInfo}>
                      <Text numberOfLines={1} style={styles.fileName}>
                        {asset.fileName || 'Selected media'}
                      </Text>
                      <Text style={styles.fileMeta}>{formatFileSize(asset.fileSize)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.unselectedState}>
                <Text style={styles.unselectedTitle}>Text, photos, or video</Text>
                <Text style={styles.unselectedText}>
                  Select up to 10 photos, one video, or publish text on its own.
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              <AppButton
                label={selectedAssets.length ? 'Change Selection' : 'Select Photos or Video'}
                loading={isPicking}
                onPress={() => void selectMedia()}
                variant="secondary"
              />
              <AppButton
                disabled={!caption.trim() && selectedAssets.length === 0}
                label="Publish"
                loading={isUploading}
                onPress={() => void submitUpload()}
                variant="dark"
              />
              {selectedAssets.length > 0 || caption ? (
                <AppButton
                  disabled={isUploading}
                  label="Cancel"
                  onPress={resetComposer}
                  variant="secondary"
                />
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: {
    alignSelf: 'center',
    maxWidth: layout.feedMaxWidth,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    width: '100%',
  },
  composerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  captionArea: { borderBottomColor: colors.border, borderBottomWidth: 1, padding: spacing.lg },
  label: { color: colors.text, fontSize: fontSize.body, fontWeight: '700' },
  captionInput: {
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    color: colors.text,
    fontSize: fontSize.body,
    marginTop: spacing.sm,
    minHeight: 120,
    padding: spacing.md,
  },
  characterCount: { color: colors.textMuted, fontSize: fontSize.caption, marginTop: spacing.xs, textAlign: 'right' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.lg },
  previewTile: { backgroundColor: colors.surfaceStrong, borderRadius: radius.card, overflow: 'hidden', width: '48%' },
  previewImage: { aspectRatio: 1, backgroundColor: colors.surfaceStrong, width: '100%' },
  videoPreview: { alignItems: 'center', aspectRatio: 1, backgroundColor: colors.black, justifyContent: 'center', padding: spacing.lg, width: '100%' },
  videoLabel: { color: colors.white, fontSize: fontSize.body, fontWeight: '800' },
  fileInfo: { padding: spacing.sm },
  fileName: { color: colors.text, fontSize: fontSize.caption, fontWeight: '700' },
  fileMeta: { color: colors.textMuted, fontSize: fontSize.caption, marginTop: 2 },
  unselectedState: { alignItems: 'center', justifyContent: 'center', minHeight: 180, padding: spacing.xxl },
  unselectedTitle: { color: colors.text, fontSize: fontSize.input, fontWeight: '700' },
  unselectedText: { color: colors.textMuted, fontSize: fontSize.body, marginTop: spacing.xs, textAlign: 'center' },
  actions: { gap: spacing.sm, padding: spacing.lg },
});
