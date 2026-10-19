import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StatePanel from '@/components/ui/StatePanel';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { addMediaComment, MediaInteractionError } from '@/services/media';
import type { MediaComment } from '@/types/media';

interface CommentModalProps {
  comments: MediaComment[];
  mediaId: number;
  onClose: () => void;
  onCommentAdded: (comment: MediaComment) => void;
  visible: boolean;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
      });
}

export default function CommentModal({
  comments,
  mediaId,
  onClose,
  onCommentAdded,
  visible,
}: CommentModalProps) {
  const [draft, setDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const close = () => {
    setDraft('');
    setErrorMessage('');
    onClose();
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const comment = await addMediaComment(mediaId, text);
      onCommentAdded(comment);
      setDraft('');
    } catch (error) {
      setErrorMessage(
        error instanceof MediaInteractionError
          ? error.message
          : 'Unable to add this comment. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={close} visible={visible}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Comments</Text>
          <Pressable
            accessibilityLabel="Close comments"
            accessibilityRole="button"
            onPress={close}
            style={styles.iconButton}>
            <Ionicons color={colors.text} name="close" size={24} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.body}>
          <FlatList
            contentContainerStyle={styles.listContent}
            data={comments}
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={
              <StatePanel
                message="Start the conversation on this post."
                title="No comments yet"
                variant="empty"
              />
            }
            renderItem={({ item }) => (
              <View style={styles.comment}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentInitial}>
                    {item.user.charAt(0).toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.commentCopy}>
                  <View style={styles.commentMeta}>
                    <Text numberOfLines={1} style={styles.commentUser}>
                      {item.user}
                    </Text>
                    <Text style={styles.commentTime}>{formatTime(item.created_at)}</Text>
                  </View>
                  <Text style={styles.commentText}>{item.text}</Text>
                </View>
              </View>
            )}
          />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Comment"
              editable={!isSubmitting}
              maxLength={1000}
              multiline
              onChangeText={setDraft}
              placeholder="Add a comment"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              value={draft}
            />
            <Pressable
              accessibilityLabel="Post comment"
              accessibilityRole="button"
              disabled={!draft.trim() || isSubmitting}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.sendButton,
                (!draft.trim() || isSubmitting) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Ionicons color={colors.white} name="send" size={20} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.surface, flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingHorizontal: spacing.lg,
  },
  title: { color: colors.text, fontSize: fontSize.section, fontWeight: '800' },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  body: { flex: 1 },
  listContent: { flexGrow: 1, gap: spacing.md, padding: spacing.lg },
  comment: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  commentAvatar: {
    alignItems: 'center',
    backgroundColor: colors.skySurface,
    borderRadius: radius.round,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  commentInitial: { color: colors.skyText, fontWeight: '800' },
  commentCopy: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.card,
    flex: 1,
    padding: spacing.md,
  },
  commentMeta: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  commentUser: { color: colors.text, flex: 1, fontSize: fontSize.body, fontWeight: '700' },
  commentTime: { color: colors.textSubtle, fontSize: 10 },
  commentText: { color: colors.textSecondary, fontSize: fontSize.body, marginTop: spacing.xs },
  error: {
    backgroundColor: colors.errorSurface,
    color: colors.error,
    fontSize: fontSize.caption,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  composer: {
    alignItems: 'flex-end',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
    borderRadius: radius.button,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: fontSize.input,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.round,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
});
