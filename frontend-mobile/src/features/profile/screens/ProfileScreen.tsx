import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomNav, { bottomNavBaseHeight } from '@/components/BottomNav';
import AppButton from '@/components/ui/AppButton';
import Avatar from '@/components/ui/Avatar';
import StatePanel from '@/components/ui/StatePanel';
import { colors, fontSize, layout, radius, spacing } from '@/constants/theme';
import { hasStoredSession } from '@/services/auth';
import {
  getMyMedia,
  getMyProfile,
  updateMyProfile,
  uploadProfilePhoto,
  UserServiceError,
} from '@/services/users';
import type { MediaItem } from '@/types/media';
import type { ProfilePhotoSource, ProfileUpdate, UserProfile } from '@/types/user';
import { OwnerProfileBackground, OwnerProfileIcon } from '../OwnerProfileArtwork';

type ProfileState = 'loading' | 'ready' | 'error' | 'unauthenticated';
type MediaFilter = 'all' | 'video' | 'image';

interface ProfileStatProps {
  label: string;
  value: number;
}

interface ProfileMediaTileProps {
  item: MediaItem;
  size: number;
}

function ProfileStat({ label, value }: ProfileStatProps) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

function ProfileVideoTile({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);

  return (
    <View style={styles.videoTile}>
      <VideoView
        contentFit="cover"
        nativeControls={false}
        player={player}
        style={styles.tileVideo}
      />
      <View style={styles.playBadge}>
        <OwnerProfileIcon color={colors.white} name="play" size={22} />
      </View>
    </View>
  );
}

function ProfileMediaTile({ item, size }: ProfileMediaTileProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const fileUrl = item.file ?? '';
  const isImage = item.media_type === 'image' && Boolean(fileUrl) && !imageFailed;
  const accessibilityLabel = item.media_type === 'video'
    ? 'Video post'
    : item.media_type === 'text'
      ? 'Text post'
      : 'Image post';

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.mediaTile, { height: size, width: size }]}>
      {isImage ? (
        <Image
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          source={{ uri: fileUrl }}
          style={styles.mediaImage}
        />
      ) : item.media_type === 'video' && fileUrl ? (
        <ProfileVideoTile uri={fileUrl} />
      ) : item.media_type === 'text' ? (
        <View style={styles.textTile}>
          <Text numberOfLines={6} style={styles.textTileContent}>{item.caption}</Text>
        </View>
      ) : (
        <View style={styles.missingTile}>
          <Text style={styles.missingTileText}>Image unavailable</Text>
        </View>
      )}
    </View>
  );
}

function formatJoinedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function ProfileDetail({ icon, value, placeholder, onEdit, divided = false }: {
  icon: 'phone' | 'location' | 'calendar';
  value: string;
  placeholder: string;
  onEdit?: () => void;
  divided?: boolean;
}) {
  const editable = !value && Boolean(onEdit);
  return (
    <Pressable accessibilityRole={editable ? 'button' : undefined} disabled={!editable} onPress={onEdit} style={styles.detailRow}>
      {divided ? <View style={styles.detailRowBorder} /> : null}
      <View style={styles.detailIcon}><OwnerProfileIcon name={icon} size={18} /></View>
      <Text numberOfLines={1} style={[styles.detailText, !value && styles.detailPlaceholder]}>{value || placeholder}</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const requestId = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<ProfileState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [selectedProfilePhoto, setSelectedProfilePhoto] = useState<ProfilePhotoSource | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editError, setEditError] = useState('');
  const [editValues, setEditValues] = useState<ProfileUpdate>({
    first_name: '', last_name: '', bio: '', phone_number: '', location: '',
  });

  const loadProfile = useCallback(async (refreshing = false) => {
    const currentRequestId = ++requestId.current;

    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setProfileState('loading');
    }

    setErrorMessage('');
    setLoadMoreError('');

    try {
      const hasSession = await hasStoredSession();

      if (!hasSession) {
        if (currentRequestId === requestId.current) {
          setProfile(null);
          setMedia([]);
          setNextPageUrl(null);
          setProfileState('unauthenticated');
        }
        return;
      }

      const [profileResponse, mediaResponse] = await Promise.all([
        getMyProfile(),
        getMyMedia(),
      ]);

      if (currentRequestId !== requestId.current) {
        return;
      }

      setProfile(profileResponse);
      setMedia(mediaResponse.results);
      setNextPageUrl(mediaResponse.next);
      setProfileState('ready');
    } catch (error) {
      if (currentRequestId !== requestId.current) {
        return;
      }

      const message =
        error instanceof UserServiceError
          ? error.message
          : 'Unable to load your profile. Please try again.';

      setProfile(null);
      setMedia([]);
      setNextPageUrl(null);
      setErrorMessage(message);
      setProfileState(
        error instanceof UserServiceError && error.status === 401
          ? 'unauthenticated'
          : 'error',
      );
    } finally {
      if (currentRequestId === requestId.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextPageUrl || isLoadingMoreRef.current || profileState !== 'ready') {
      return;
    }

    const currentRequestId = requestId.current;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError('');

    try {
      const page = await getMyMedia(nextPageUrl);

      if (currentRequestId !== requestId.current) {
        return;
      }

      setMedia((currentMedia) => {
        const existingIds = new Set(currentMedia.map((item) => item.id));
        return [
          ...currentMedia,
          ...page.results.filter((item) => !existingIds.has(item.id)),
        ];
      });
      setNextPageUrl(page.next);
    } catch (error) {
      if (currentRequestId !== requestId.current) {
        return;
      }

      if (error instanceof UserServiceError && error.status === 401) {
        setProfile(null);
        setMedia([]);
        setNextPageUrl(null);
        setErrorMessage(error.message);
        setProfileState('unauthenticated');
      } else {
        setLoadMoreError(
          error instanceof UserServiceError
            ? error.message
            : 'Unable to load more media. Please try again.',
        );
      }
    } finally {
      isLoadingMoreRef.current = false;

      if (currentRequestId === requestId.current) {
        setIsLoadingMore(false);
      }
    }
  }, [nextPageUrl, profileState]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();

      return () => {
        requestId.current += 1;
        isLoadingMoreRef.current = false;
      };
    }, [loadProfile]),
  );

  const contentWidth = Math.min(width, layout.feedMaxWidth);
  const tileGap = spacing.xs;
  const gridPadding = spacing.lg;
  const tileSize = Math.floor((contentWidth - gridPadding * 2 - tileGap * 2) / 3);
  const avatarSize = Math.min(170, Math.max(128, contentWidth * 0.33));
  const displayName = profile?.full_name.trim() || profile?.username || 'Media user';
  const joined = profile?.date_joined ? formatJoinedDate(profile.date_joined) : '';
  const visibleMedia = useMemo(
    () => mediaFilter === 'all'
      ? media
      : media.filter((item) => item.media_type === mediaFilter),
    [media, mediaFilter],
  );

  const selectProfilePhoto = async () => {
    if (isUploadingPhoto) return;
    setPhotoError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Photo library permission is required to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: false,
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setSelectedProfilePhoto({
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
      uri: asset.uri,
    });
  };

  const saveProfilePhoto = async () => {
    if (!selectedProfilePhoto || isUploadingPhoto) return;
    setIsUploadingPhoto(true);
    try {
      const response = await uploadProfilePhoto(selectedProfilePhoto);
      setProfile((current) =>
        current ? { ...current, profile_picture: response.profile_picture } : current,
      );
      setSelectedProfilePhoto(null);
    } catch (error) {
      setPhotoError(
        error instanceof UserServiceError
          ? error.message
          : 'Unable to update your profile photo.',
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const beginEditingProfile = () => {
    if (!profile) return;
    setEditValues({
      first_name: profile.first_name,
      last_name: profile.last_name,
      bio: profile.bio,
      phone_number: profile.phone_number,
      location: profile.location,
    });
    setEditError('');
    setIsEditingProfile(true);
  };

  const saveProfileDetails = async () => {
    if (isSavingProfile) return;
    setIsSavingProfile(true);
    setEditError('');
    try {
      setProfile(await updateMyProfile(editValues));
      setIsEditingProfile(false);
    } catch (error) {
      setEditError(error instanceof UserServiceError ? error.message : 'Unable to update your profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const updateEditValue = (field: keyof ProfileUpdate, value: string) => {
    setEditValues((current) => ({ ...current, [field]: value }));
  };

  const profileHeader = (
    <>
      {profileState === 'loading' ? (
        <View style={styles.stateContainer}>
          <StatePanel title="Loading profile..." variant="loading" />
        </View>
      ) : profileState === 'unauthenticated' ? (
        <View style={styles.stateContainer}>
          <StatePanel
            actionLabel="Login"
            message={errorMessage || 'Sign in to view your profile and uploads.'}
            onAction={() => router.replace('/login')}
            title="Login required"
            variant="error"
          />
        </View>
      ) : profileState === 'error' ? (
        <View style={styles.stateContainer}>
          <StatePanel
            actionLabel="Retry"
            message={errorMessage}
            onAction={() => void loadProfile()}
            title="Could not load profile"
            variant="error"
          />
        </View>
      ) : profile ? (
        <>
          <View style={styles.hero}>
            <OwnerProfileBackground />
            <View style={styles.heroActions}>
              <Pressable
                accessibilityLabel="Open menu"
                accessibilityRole="button"
                hitSlop={6}
                onPress={() => router.push('/menu')}
                style={({ pressed }) => [styles.circleAction, pressed && styles.actionPressed]}>
                <OwnerProfileIcon name="menu" size={22} />
              </Pressable>
              <Pressable
                accessibilityLabel="Edit profile"
                accessibilityRole="button"
                hitSlop={6}
                disabled={isSavingProfile}
                onPress={beginEditingProfile}
                style={({ pressed }) => [styles.circleAction, pressed && styles.actionPressed]}>
                <OwnerProfileIcon name="edit" size={22} />
              </Pressable>
            </View>

            <View style={styles.identityBlock}>
              <Pressable
                accessibilityLabel="Change profile photo"
                disabled={isUploadingPhoto}
                onPress={() => void selectProfilePhoto()}
                style={styles.avatarRing}>
                <Avatar label={profile.username} size={avatarSize - 8} uri={selectedProfilePhoto?.uri || profile.profile_picture} />
                {isUploadingPhoto ? (
                  <View style={styles.photoUploadOverlay}>
                    <ActivityIndicator color={colors.white} size="small" />
                  </View>
                ) : null}
              </Pressable>
              <Text numberOfLines={1} style={styles.displayName}>{displayName}</Text>
              <Text numberOfLines={1} style={styles.handle}>@{profile.username}</Text>
              {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            </View>
          </View>

          <View style={styles.profileBody}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/follows')}
              style={styles.statsRow}>
              <ProfileStat label="Followers" value={profile.followers_count} />
              <View style={styles.statDivider} />
              <ProfileStat label="Following" value={profile.following_count} />
              <View style={styles.statDivider} />
              <ProfileStat label="Likes" value={profile.likes_count} />
            </Pressable>

            <View accessibilityRole="tablist" style={styles.filterTabs}>
              {([
                ['all', 'All'],
                ['video', 'Video'],
                ['image', 'Photos'],
              ] as const).map(([value, label]) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mediaFilter === value }}
                  key={value}
                  onPress={() => setMediaFilter(value)}
                  style={[styles.filterTab, mediaFilter === value && styles.filterTabActive]}>
                  <Text style={[styles.filterTabText, mediaFilter === value && styles.filterTabTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.detailsCard}>
              <ProfileDetail icon="phone" value={profile.phone_number} placeholder="Add phone number" onEdit={beginEditingProfile} />
              <ProfileDetail divided icon="location" value={profile.location} placeholder="Add location" onEdit={beginEditingProfile} />
              <ProfileDetail divided icon="calendar" value={joined ? `Joined ${joined}` : ''} placeholder="Join date unavailable" />
            </View>

            {isEditingProfile ? (
              <View style={styles.editorCard}>
                <View style={styles.nameInputs}>
                  <TextInput
                    accessibilityLabel="First name"
                    onChangeText={(value) => updateEditValue('first_name', value)}
                    placeholder="First name"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.editorInput, styles.nameInput]}
                    value={editValues.first_name}
                  />
                  <TextInput
                    accessibilityLabel="Last name"
                    onChangeText={(value) => updateEditValue('last_name', value)}
                    placeholder="Last name"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.editorInput, styles.nameInput]}
                    value={editValues.last_name}
                  />
                </View>
                <TextInput
                  accessibilityLabel="Bio"
                  multiline
                  onChangeText={(value) => updateEditValue('bio', value)}
                  placeholder="Bio"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.editorInput, styles.bioInput]}
                  value={editValues.bio}
                />
                <TextInput
                  accessibilityLabel="Phone number"
                  keyboardType="phone-pad"
                  onChangeText={(value) => updateEditValue('phone_number', value)}
                  placeholder="Phone number"
                  placeholderTextColor={colors.textMuted}
                  style={styles.editorInput}
                  value={editValues.phone_number}
                />
                <TextInput
                  accessibilityLabel="Location"
                  onChangeText={(value) => updateEditValue('location', value)}
                  placeholder="Location"
                  placeholderTextColor={colors.textMuted}
                  style={styles.editorInput}
                  value={editValues.location}
                />
                {editError ? <Text style={styles.photoError}>{editError}</Text> : null}
                <View style={styles.photoActions}>
                  <AppButton
                    label="Save profile"
                    loading={isSavingProfile}
                    onPress={() => void saveProfileDetails()}
                    style={styles.photoAction}
                  />
                  <AppButton
                    disabled={isSavingProfile}
                    label="Cancel"
                    onPress={() => setIsEditingProfile(false)}
                    style={styles.photoAction}
                    variant="secondary"
                  />
                </View>
              </View>
            ) : null}

            {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
            {selectedProfilePhoto ? (
              <View style={styles.photoActions}>
                <AppButton
                  label="Save photo"
                  loading={isUploadingPhoto}
                  onPress={() => void saveProfilePhoto()}
                  style={styles.photoAction}
                />
                <AppButton
                  disabled={isUploadingPhoto}
                  label="Cancel"
                  onPress={() => setSelectedProfilePhoto(null)}
                  style={styles.photoAction}
                  variant="secondary"
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={beginEditingProfile}
                style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}>
                <OwnerProfileIcon color={colors.white} name="pencil" size={22} />
                <Text style={styles.editButtonText}>Edit profile</Text>
              </Pressable>
            )}
          </View>
        </>
      ) : null}
    </>
  );

  const listEmpty =
    profileState === 'ready' ? (
      <View style={styles.emptyContainer}>
        <StatePanel
          actionLabel="Upload Media"
          message={mediaFilter === 'all' ? 'Your uploaded media will appear here.' : `Your ${mediaFilter === 'video' ? 'videos' : 'photos'} will appear here.`}
          onAction={() => router.push('/upload')}
          title={mediaFilter === 'all' ? 'No posts yet' : `No ${mediaFilter === 'video' ? 'videos' : 'photos'} yet`}
          variant="empty"
        />
      </View>
    ) : null;

  const listFooter = (
    <View style={styles.footer}>
      {isLoadingMore ? (
        <ActivityIndicator
          accessibilityLabel="Loading more profile media"
          color={colors.primary}
          style={styles.loadingMore}
        />
      ) : null}
      {loadMoreError ? (
        <StatePanel
          actionLabel="Retry"
          onAction={() => void loadMore()}
          title={loadMoreError}
          variant="error"
        />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.contentShell}>
        <FlatList
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          data={profileState === 'ready' ? visibleMedia : []}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          ListHeaderComponent={profileHeader}
          numColumns={3}
          onEndReached={profileState === 'ready' ? loadMore : undefined}
          onEndReachedThreshold={0.4}
          onRefresh={
            profileState === 'ready' ? () => void loadProfile(true) : undefined
          }
          refreshing={profileState === 'ready' ? isRefreshing : false}
          renderItem={({ item }) => (
            <ProfileMediaTile item={item} size={tileSize} />
          )}
          style={styles.list}
        />
      </View>
      {profileState === 'ready' ? <BottomNav /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  contentShell: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: layout.feedMaxWidth,
    width: '100%',
  },
  list: {
    backgroundColor: colors.surface,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: bottomNavBaseHeight + spacing.xxxl,
  },
  stateContainer: {
    padding: spacing.lg,
  },
  hero: {
    overflow: 'hidden',
    paddingBottom: 14,
    paddingTop: 20,
  },
  heroActions: {
    position: 'absolute',
    top: 14,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.round,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  actionPressed: { opacity: 0.7 },
  identityBlock: {
    alignItems: 'center',
  },
  profileBody: {
    paddingHorizontal: spacing.lg,
  },
  profileSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xl,
  },
  avatarRing: {
    backgroundColor: colors.surface,
    borderColor: colors.white,
    borderRadius: radius.round,
    borderWidth: 4,
    position: 'relative',
    shadowColor: '#aeb5db',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 11,
  },
  photoUploadOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: '#0008',
    borderRadius: radius.round,
    justifyContent: 'center',
  },
  statsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 14,
  },
  statDivider: { backgroundColor: '#e6e6eb', height: 30, width: 1 },
  stat: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  statLabel: {
    color: '#81818d',
    fontSize: 12,
    marginTop: 4,
  },
  profileCopy: {
    marginTop: spacing.lg,
  },
  displayName: {
    color: '#10111d',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    marginTop: 10,
    maxWidth: '90%',
    letterSpacing: -0.6,
  },
  handle: {
    color: '#5b49ed',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 3,
  },
  email: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    marginTop: 2,
  },
  bio: {
    color: '#81818d',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
    maxWidth: '76%',
    textAlign: 'center',
  },
  photoError: { color: colors.error, fontSize: fontSize.caption, marginTop: spacing.sm },
  photoActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  photoAction: { flex: 1 },
  filterTabs: {
    backgroundColor: '#f5f5f8',
    borderRadius: radius.round,
    flexDirection: 'row',
    marginBottom: 10,
    marginTop: 6,
    padding: 4,
  },
  filterTab: {
    alignItems: 'center',
    borderRadius: radius.round,
    flex: 1,
    minHeight: 35,
    justifyContent: 'center',
  },
  filterTabActive: { backgroundColor: '#1b1c1e' },
  filterTabText: { color: '#10111d', fontSize: 15, fontWeight: '600' },
  filterTabTextActive: { color: colors.white },
  detailsCard: {
    backgroundColor: colors.surface,
    borderColor: '#fafafd',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: 'hidden',
    shadowColor: colors.text,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 9,
  },
  detailRow: { alignItems: 'center', flexDirection: 'row', minHeight: 38 },
  detailRowBorder: { position: 'absolute', top: 0, left: 46, right: 0, height: 1, backgroundColor: '#f0f0f4' },
  detailIcon: {
    alignItems: 'center',
    backgroundColor: '#f2f2f6',
    borderRadius: radius.round,
    height: 30,
    justifyContent: 'center',
    marginRight: 16,
    width: 30,
  },
  detailText: { color: '#10111d', flex: 1, fontSize: 14, fontWeight: '500' },
  detailPlaceholder: { color: '#81818d', fontWeight: '400' },
  editButton: {
    alignItems: 'center',
    backgroundColor: '#1b1c1e',
    borderRadius: radius.round,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 44,
  },
  editButtonPressed: { opacity: 0.82 },
  editButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  editorCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.authCard,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  editorInput: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.text,
    fontSize: fontSize.body,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  bioInput: { minHeight: 82, paddingTop: spacing.md, textAlignVertical: 'top' },
  nameInputs: { flexDirection: 'row', gap: spacing.sm },
  nameInput: { flex: 1 },
  findPeople: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 38,
  },
  findPeopleText: { color: colors.textSecondary, fontSize: fontSize.body, fontWeight: '700' },
  gridHeader: {
    alignItems: 'center',
    borderBottomColor: colors.text,
    borderBottomWidth: 2,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 48,
  },
  gridTitle: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  gridCount: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.round,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '700',
    marginLeft: spacing.sm,
    minWidth: 24,
    overflow: 'hidden',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    textAlign: 'center',
  },
  gridRow: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  mediaTile: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 11,
    overflow: 'hidden',
  },
  mediaImage: {
    height: '100%',
    width: '100%',
  },
  videoTile: {
    alignItems: 'center',
    backgroundColor: colors.black,
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  tileVideo: { height: '100%', width: '100%' },
  playBadge: {
    alignItems: 'center',
    bottom: spacing.sm,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.sm,
    width: 22,
  },
  videoBadge: {
    borderColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  videoBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  missingTile: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.sm,
  },
  textTile: {
    alignItems: 'center',
    backgroundColor: colors.skySurface,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.sm,
  },
  textTileContent: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  missingTileText: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
  },
  loadingMore: {
    marginVertical: spacing.lg,
  },
});
