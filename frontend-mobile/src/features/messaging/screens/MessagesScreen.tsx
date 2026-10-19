import Ionicons from '@expo/vector-icons/Ionicons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomNav, { bottomNavBaseHeight } from '@/components/BottomNav';
import UserRow from '@/components/UserRow';
import VoiceMessagePlayer from '@/components/VoiceMessagePlayer';
import AppHeader from '@/components/ui/AppHeader';
import Avatar from '@/components/ui/Avatar';
import StatePanel from '@/components/ui/StatePanel';
import { colors, fontSize, layout, radius, spacing } from '@/constants/theme';
import { getCurrentUser } from '@/services/auth';
import {
  getConversation,
  getMessageThreads,
  MessageServiceError,
  sendTextMessage,
  sendVoiceMessage,
} from '@/services/messages';
import { getUserProfile, searchUsers, UserServiceError } from '@/services/users';
import type { DirectMessage, MessageThread } from '@/types/messages';
import type { CurrentUser, SocialUser } from '@/types/user';

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function MessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user?: string }>();
  const messageList = useRef<FlatList<DirectMessage>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedUser, setSelectedUser] = useState<SocialUser | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadThreads = useCallback(async () => {
    setError('');
    try {
      const [user, result] = await Promise.all([getCurrentUser(), getMessageThreads()]);
      setCurrentUser(user);
      setThreads(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (user: SocialUser, silent = false) => {
    if (!silent) setConversationLoading(true);
    try {
      const result = await getConversation(user.id);
      setSelectedUser(result.user);
      setMessages(result.messages);
    } catch (caught) {
      if (!silent) {
        setError(caught instanceof MessageServiceError ? caught.message : 'Unable to load this conversation.');
      }
    } finally {
      if (!silent) setConversationLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadThreads(), 0);
    return () => clearTimeout(timer);
  }, [loadThreads]);

  useEffect(() => {
    const userId = Number(params.user);
    if (!Number.isInteger(userId) || userId <= 0) return;
    let active = true;
    const open = async () => {
      try {
        const profile = await getUserProfile(userId);
        if (active) void loadConversation(profile);
      } catch (caught) {
        if (active) setError(caught instanceof UserServiceError ? caught.message : 'Unable to open this conversation.');
      }
    };
    void open();
    return () => { active = false; };
  }, [loadConversation, params.user]);

  useEffect(() => {
    if (!selectedUser) return;
    const timer = setInterval(() => void loadConversation(selectedUser, true), 3500);
    return () => clearInterval(timer);
  }, [loadConversation, selectedUser]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsers(trimmed);
        if (active) setSearchResults(results);
      } catch (caught) {
        if (active) setError(caught instanceof UserServiceError ? caught.message : 'Unable to search people.');
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const sendText = async () => {
    const text = draft.trim();
    if (!selectedUser || !text || sending) return;
    setSending(true);
    setError('');
    try {
      const message = await sendTextMessage(selectedUser.id, text);
      setMessages((current) => [...current, message]);
      setDraft('');
    } catch (caught) {
      setError(caught instanceof MessageServiceError ? caught.message : 'Unable to send this message.');
    } finally {
      setSending(false);
    }
  };

  const toggleRecording = async () => {
    if (!selectedUser || sending) return;
    setError('');
    if (recorderState.isRecording) {
      const durationSeconds = Math.max(recorderState.durationMillis / 1000, 0);
      await recorder.stop();
      if (!recorder.uri || durationSeconds < 0.4) {
        setError('Hold the microphone a little longer to record a voice message.');
        return;
      }
      setSending(true);
      try {
        const message = await sendVoiceMessage(selectedUser.id, { durationSeconds, uri: recorder.uri });
        setMessages((current) => [...current, message]);
      } catch (caught) {
        setError(caught instanceof MessageServiceError ? caught.message : 'Unable to send this voice message.');
      } finally {
        setSending(false);
      }
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission is required to record a voice message.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: 120 });
    } catch {
      setError('Unable to start voice recording. Please try again.');
    }
  };

  const cancelRecording = async () => {
    if (!recorderState.isRecording) return;
    try {
      await recorder.stop();
      setError('Voice recording canceled.');
    } catch {
      setError('Unable to cancel the recording. Please try again.');
    }
  };

  const showCallRequirement = (kind: 'audio' | 'video') => {
    Alert.alert(
      `${kind === 'video' ? 'Video' : 'Voice'} calling requires a development build`,
      'Live calls use native WebRTC and cannot run inside Expo Go. Messaging and voice notes remain available.',
    );
  };

  const openConversation = (user: SocialUser) => {
    setQuery('');
    setSelectedUser(user);
    void loadConversation(user);
  };

  const closeConversation = () => {
    setSelectedUser(null);
    setMessages([]);
    void loadThreads();
  };

  if (selectedUser) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <AppHeader
          leftAction={{ accessibilityLabel: 'Back to messages', label: 'Back', onPress: closeConversation }}
          rightAction={{ accessibilityLabel: 'Open profile', label: 'Profile', onPress: () => router.push({ pathname: '/profile/[userId]', params: { userId: selectedUser.id } }) }}
          title={selectedUser.full_name || selectedUser.username}
        />
        <View style={styles.callBar}>
          <Pressable onPress={() => showCallRequirement('audio')} style={styles.callButton}>
            <Ionicons color={colors.textSecondary} name="call-outline" size={20} /><Text style={styles.callText}>Voice call</Text>
          </Pressable>
          <Pressable onPress={() => showCallRequirement('video')} style={styles.callButton}>
            <Ionicons color={colors.textSecondary} name="videocam-outline" size={21} /><Text style={styles.callText}>Video call</Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.conversation}>
          {conversationLoading && messages.length === 0 ? (
            <StatePanel title="Loading conversation..." variant="loading" />
          ) : (
            <FlatList
              contentContainerStyle={styles.messageContent}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={<StatePanel message="Send a message to start the conversation." title="No messages yet" variant="empty" />}
              onContentSizeChange={() => messageList.current?.scrollToEnd({ animated: true })}
              ref={messageList}
              renderItem={({ item }) => {
                const own = item.sender.id === currentUser?.id;
                return (
                  <View style={[styles.messageRow, own && styles.messageRowOwn]}>
                    <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                      {item.message_type === 'voice' && item.voice_file ? (
                        <VoiceMessagePlayer duration={item.voice_duration} uri={item.voice_file} />
                      ) : (
                        <Text style={[styles.messageText, own && styles.messageTextOwn]}>{item.text}</Text>
                      )}
                      <Text style={[styles.messageTime, own && styles.messageTimeOwn]}>{formatTime(item.created_at)}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {recorderState.isRecording ? (
            <View style={styles.recordingRow}>
              <Text accessibilityLiveRegion="polite" style={styles.recording}>Recording {Math.round(recorderState.durationMillis / 1000)}s. Tap stop to send.</Text>
              <Pressable accessibilityLabel="Cancel voice recording" onPress={() => void cancelRecording()} style={styles.cancelRecording}>
                <Text style={styles.cancelRecordingText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              editable={!sending && !recorderState.isRecording}
              multiline
              onChangeText={setDraft}
              placeholder="Message"
              placeholderTextColor={colors.textSubtle}
              style={styles.composerInput}
              value={draft}
            />
            {draft.trim() ? (
              <Pressable disabled={sending} onPress={() => void sendText()} style={styles.sendButton}>
                <Ionicons color={colors.white} name="send" size={20} />
              </Pressable>
            ) : (
              <Pressable disabled={sending} onPress={() => void toggleRecording()} style={[styles.sendButton, recorderState.isRecording && styles.stopButton]}>
                <Ionicons color={colors.white} name={recorderState.isRecording ? 'stop' : 'mic'} size={21} />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const people = query.trim() ? searchResults : [];

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader title="Messages" />
      <View style={styles.shell}>
        <View style={styles.searchBox}>
          <Ionicons color={colors.textMuted} name="search" size={18} />
          <TextInput
            autoCapitalize="none"
            onChangeText={(value) => {
              setQuery(value);
              if (!value.trim()) setSearchResults([]);
            }}
            placeholder="Search people"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            value={query}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {query.trim() ? (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={people}
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={<StatePanel title="No people found" variant="empty" />}
            renderItem={({ item }) => (
              <UserRow onPress={() => openConversation(item)} showFollow={false} user={item} />
            )}
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={threads}
            keyExtractor={(item) => String(item.user.id)}
            ListEmptyComponent={loading ? <StatePanel title="Loading messages..." variant="loading" /> : <StatePanel message="Search for someone to start a conversation." title="No conversations" variant="empty" />}
            onRefresh={() => void loadThreads()}
            refreshing={loading}
            renderItem={({ item }) => (
              <Pressable onPress={() => openConversation(item.user)} style={styles.thread}>
                <Avatar label={item.user.full_name || item.user.username} size={52} uri={item.user.profile_picture} />
                <View style={styles.threadCopy}>
                  <Text numberOfLines={1} style={styles.threadName}>{item.user.full_name || item.user.username}</Text>
                  <Text numberOfLines={1} style={styles.threadPreview}>{item.last_message.message_type === 'voice' ? 'Voice message' : item.last_message.text}</Text>
                </View>
                {item.unread_count ? <Text style={styles.unread}>{item.unread_count}</Text> : null}
              </Pressable>
            )}
          />
        )}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.feedBackground, flex: 1 },
  shell: { alignSelf: 'center', flex: 1, maxWidth: layout.feedMaxWidth, width: '100%' },
  listContent: { flexGrow: 1, paddingBottom: bottomNavBaseHeight + spacing.xxl },
  searchBox: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', margin: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  searchInput: { color: colors.text, flex: 1, fontSize: fontSize.body, minHeight: 44, paddingLeft: spacing.sm },
  thread: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', padding: spacing.md },
  threadCopy: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  threadName: { color: colors.text, fontSize: fontSize.body, fontWeight: '700' },
  threadPreview: { color: colors.textMuted, fontSize: fontSize.caption, marginTop: 3 },
  unread: { backgroundColor: colors.primary, borderRadius: radius.round, color: colors.white, fontSize: 11, fontWeight: '800', minWidth: 22, overflow: 'hidden', padding: 4, textAlign: 'center' },
  callBar: { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'center' },
  callButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 42, paddingHorizontal: spacing.lg },
  callText: { color: colors.textSecondary, fontSize: fontSize.caption, fontWeight: '700' },
  conversation: { flex: 1 },
  messageContent: { flexGrow: 1, gap: spacing.sm, padding: spacing.lg },
  messageRow: { alignItems: 'flex-start' },
  messageRowOwn: { alignItems: 'flex-end' },
  bubble: { borderRadius: radius.button, maxWidth: '82%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleOwn: { backgroundColor: colors.primary },
  bubbleOther: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  messageText: { color: colors.text, fontSize: fontSize.body, lineHeight: 20 },
  messageTextOwn: { color: colors.white },
  messageTime: { color: colors.textMuted, fontSize: 10, marginTop: spacing.xs, textAlign: 'right' },
  messageTimeOwn: { color: '#dbeafe' },
  composer: { alignItems: 'flex-end', backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  composerInput: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderRadius: radius.button, borderWidth: 1, color: colors.text, flex: 1, fontSize: fontSize.input, maxHeight: 110, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.round, height: 44, justifyContent: 'center', width: 44 },
  stopButton: { backgroundColor: colors.error },
  recordingRow: { alignItems: 'center', backgroundColor: colors.errorSurface, flexDirection: 'row', paddingHorizontal: spacing.md },
  recording: { color: colors.error, flex: 1, fontSize: fontSize.caption, paddingVertical: spacing.sm, textAlign: 'center' },
  cancelRecording: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  cancelRecordingText: { color: colors.error, fontSize: fontSize.caption, fontWeight: '800' },
  error: { backgroundColor: colors.errorSurface, color: colors.error, fontSize: fontSize.caption, padding: spacing.sm },
});
