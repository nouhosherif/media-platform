from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import Comment, Like, Media


User = get_user_model()


class MediaUploadAndInteractionAPITests(TestCase):
    upload_url = '/api/media/upload/'
    user_media_url = '/api/media/my-media/'
    feed_url = '/api/media/feed/'

    def setUp(self):
        self.temporary_media = TemporaryDirectory()
        self.addCleanup(self.temporary_media.cleanup)
        self.settings_override = override_settings(
            MEDIA_ROOT=self.temporary_media.name,
            PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'],
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='media-owner',
            email='owner@example.com',
            password='test-password',
        )
        self.other_user = User.objects.create_user(
            username='other-user',
            email='other@example.com',
            password='test-password',
        )

    def authenticate(self, user):
        access_token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

    def image_file(self, name='test-image.png'):
        return SimpleUploadedFile(
            name,
            b'\x89PNG\r\n\x1a\n' + (b'\x00' * 32),
            content_type='image/png',
        )

    def upload_image(self):
        self.authenticate(self.owner)
        response = self.client.post(
            self.upload_url,
            {'file': self.image_file()},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response, Media.objects.get(pk=response.data['id'])

    def test_unauthenticated_media_upload_returns_401(self):
        response = self.client.post(
            self.upload_url,
            {'file': self.image_file()},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(Media.objects.exists())

    def test_authenticated_user_can_upload_valid_image(self):
        response, media = self.upload_image()

        self.assertEqual(response.data['user_id'], self.owner.id)
        self.assertEqual(media.user, self.owner)
        self.assertEqual(media.media_type, 'image')
        self.assertTrue(media.file.storage.exists(media.file.name))

    def test_authenticated_user_can_upload_image_with_caption(self):
        self.authenticate(self.owner)

        response = self.client.post(
            self.upload_url,
            {'file': self.image_file(), 'caption': 'A photo caption'},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['caption'], 'A photo caption')
        self.assertEqual(Media.objects.get(pk=response.data['id']).caption, 'A photo caption')

    def test_authenticated_user_can_create_text_post(self):
        self.authenticate(self.owner)

        response = self.client.post(
            self.upload_url,
            {'caption': 'A text-only post'},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['media_type'], 'text')
        self.assertEqual(response.data['caption'], 'A text-only post')
        self.assertIsNone(response.data['file'])

    def test_upload_requires_text_or_file(self):
        self.authenticate(self.owner)

        response = self.client.post(self.upload_url, {}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', response.data)
        self.assertFalse(Media.objects.exists())

    def test_authenticated_user_can_upload_multiple_photos(self):
        self.authenticate(self.owner)

        response = self.client.post(
            self.upload_url,
            {
                'files': [
                    self.image_file('first.png'),
                    self.image_file('second.png'),
                ],
                'caption': 'Shared batch caption',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 2)
        self.assertEqual(Media.objects.count(), 2)
        self.assertTrue(
            all(item['caption'] == 'Shared batch caption' for item in response.data['results'])
        )

    def test_multiple_selection_rejects_non_image_without_creating_posts(self):
        self.authenticate(self.owner)
        video = SimpleUploadedFile(
            'clip.mp4',
            b'video-content',
            content_type='video/mp4',
        )

        response = self.client.post(
            self.upload_url,
            {'files': [self.image_file(), video]},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('files', response.data)
        self.assertFalse(Media.objects.exists())

    def test_uploaded_media_appears_in_user_media_list(self):
        _, media = self.upload_image()

        response = self.client.get(self.user_media_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(media.id, [item['id'] for item in response.data['results']])

    def test_uploaded_media_appears_in_feed(self):
        _, media = self.upload_image()

        response = self.client.get(self.feed_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(media.id, [item['id'] for item in response.data['results']])

    def test_unsupported_file_upload_is_rejected(self):
        self.authenticate(self.owner)
        unsupported_file = SimpleUploadedFile(
            'unsupported.txt',
            b'not a supported media file',
            content_type='text/plain',
        )

        response = self.client.post(
            self.upload_url,
            {'file': unsupported_file},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('file', response.data)
        self.assertFalse(Media.objects.exists())

    def test_media_owner_can_delete_their_upload(self):
        _, media = self.upload_image()

        response = self.client.delete(f'/api/media/delete/{media.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Media.objects.filter(pk=media.id).exists())

    def test_another_user_cannot_delete_media_they_do_not_own(self):
        _, media = self.upload_image()
        self.authenticate(self.other_user)

        response = self.client.delete(f'/api/media/delete/{media.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Media.objects.filter(pk=media.id).exists())

    def test_authenticated_user_can_like_media(self):
        _, media = self.upload_image()
        self.authenticate(self.other_user)

        response = self.client.post(f'/api/media/like/{media.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Liked')
        self.assertTrue(
            Like.objects.filter(user=self.other_user, media=media).exists()
        )

    def test_repeated_like_request_toggles_like_off(self):
        _, media = self.upload_image()
        self.authenticate(self.other_user)
        like_url = f'/api/media/like/{media.id}/'

        first_response = self.client.post(like_url)
        second_response = self.client.post(like_url)

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data['message'], 'Unliked')
        self.assertFalse(
            Like.objects.filter(user=self.other_user, media=media).exists()
        )

    def test_authenticated_user_can_add_comment(self):
        _, media = self.upload_image()
        self.authenticate(self.other_user)

        response = self.client.post(
            f'/api/media/comment/{media.id}/',
            {'text': 'A useful comment'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['text'], 'A useful comment')
        self.assertEqual(response.data['user'], str(self.other_user))

    def test_created_comment_is_linked_to_correct_user_and_media(self):
        _, media = self.upload_image()
        self.authenticate(self.other_user)

        response = self.client.post(
            f'/api/media/comment/{media.id}/',
            {'text': 'Linked comment'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        comment = Comment.objects.get(pk=response.data['id'])
        self.assertEqual(comment.user, self.other_user)
        self.assertEqual(comment.media, media)
        self.assertEqual(comment.text, 'Linked comment')


class MediaFeedAPITests(TestCase):
    feed_url = '/api/media/feed/'

    def setUp(self):
        self.client = APIClient()

    def test_media_feed_without_authentication_returns_401(self):
        response = self.client.get(self.feed_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
