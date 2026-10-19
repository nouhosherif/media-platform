from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .. import services
from ..models import Comment, Like, Media, MediaView


User = get_user_model()


class MediaServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='service-owner')
        self.media = Media.objects.create(user=self.user, caption='Service fixture')

    def test_toggle_like_keeps_engagement_state_in_sync(self):
        self.assertTrue(services.toggle_like(user=self.user, media=self.media))
        self.assertTrue(MediaView.objects.get().liked)
        self.assertFalse(services.toggle_like(user=self.user, media=self.media))
        self.assertFalse(MediaView.objects.get().liked)
        self.assertFalse(Like.objects.exists())

    def test_social_writes_roll_back_if_engagement_update_fails(self):
        with patch.object(services, 'get_or_create_engagement', side_effect=RuntimeError('Failure')):
            with self.assertRaises(RuntimeError):
                services.toggle_like(user=self.user, media=self.media)
            with self.assertRaises(RuntimeError):
                services.add_comment(user=self.user, media=self.media, text='Rollback')
        self.assertFalse(Like.objects.exists())
        self.assertFalse(Comment.objects.exists())

    def test_engagement_accumulates_without_losing_other_flags(self):
        services.record_engagement(user=self.user, media=self.media, viewed=True, watch_time=2, clicked=True)
        services.record_engagement(user=self.user, media=self.media, viewed=True, watch_time=3)
        services.record_engagement(user=self.user, media=self.media, watch_time=4)
        row = MediaView.objects.get()
        self.assertEqual(row.view_count, 2)
        self.assertEqual(row.total_watch_time, 9)
        self.assertEqual(row.last_watch_time, 4)
        self.assertTrue(row.clicked)

    def test_invalid_or_nonfinite_duration_is_normalized(self):
        for value in ('nonsense', -3, 'nan', 'inf', '-inf', ''):
            with self.subTest(value=value):
                services.record_engagement(user=self.user, media=self.media, watch_time=value)
                row = MediaView.objects.get()
                self.assertEqual(row.total_watch_time, 0)
                self.assertEqual(row.last_watch_time, 0)

    def test_historical_duplicate_engagement_rows_are_not_deleted(self):
        first = MediaView.objects.create(user=self.user, media=self.media, view_count=4)
        latest = MediaView.objects.create(user=self.user, media=self.media, view_count=7)
        services.record_engagement(user=self.user, media=self.media, viewed=True)
        first.refresh_from_db()
        latest.refresh_from_db()
        self.assertEqual(first.view_count, 4)
        self.assertEqual(latest.view_count, 8)
        self.assertEqual(MediaView.objects.count(), 2)

    def test_upload_batch_failure_cleans_new_files_and_preserves_existing_file(self):
        with TemporaryDirectory() as directory, override_settings(
            MEDIA_ROOT=directory,
            STORAGES={
                'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
                'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
            },
        ):
            existing = Media.objects.create(
                user=self.user,
                file=SimpleUploadedFile('existing.png', b'existing', content_type='image/png'),
            )
            original_save = Media.save
            saves = 0

            def fail_after_second_file(instance, *args, **kwargs):
                nonlocal saves
                original_save(instance, *args, **kwargs)
                saves += 1
                if saves == 2:
                    raise RuntimeError('Simulated database failure after storage write')

            with patch.object(Media, 'save', new=fail_after_second_file):
                with self.assertRaises(RuntimeError):
                    services.create_media_batch(user=self.user, validated_items=[
                        {'file': SimpleUploadedFile('first.png', b'first', content_type='image/png')},
                        {'file': SimpleUploadedFile('second.png', b'second', content_type='image/png')},
                    ])
            self.assertEqual(Media.objects.count(), 2)
            self.assertTrue(existing.file.storage.exists(existing.file.name))
            self.assertEqual(len([path for path in Path(directory).rglob('*') if path.is_file()]), 1)

    def test_delete_preserves_existing_storage_retention_semantics(self):
        item = Media.objects.create(
            user=self.user, file=SimpleUploadedFile('retained.png', b'image', content_type='image/png'),
        )
        storage, name = item.file.storage, item.file.name
        services.delete_media(media=item)
        self.assertFalse(Media.objects.filter(pk=item.pk).exists())
        self.assertTrue(storage.exists(name))


class MediaValidationCompatibilityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='validation-owner')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_news_contract_and_text_normalization_are_preserved(self):
        response = self.client.post('/api/media/upload/', {
            'content_type': ' NEWS ', 'title': ' Headline ', 'caption': ' Article body. ' * 5,
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['content_type'], 'news')
        self.assertEqual(response.data['title'], 'Headline')
        self.assertEqual(response.data['media_type'], 'text')
        self.assertNotIn('results', response.data)

    def test_news_requires_headline_and_minimum_body(self):
        for data, field in (
            ({'content_type': 'news', 'caption': 'Long body' * 10}, 'title'),
            ({'content_type': 'news', 'title': 'Headline', 'caption': 'Too short'}, 'caption'),
        ):
            response = self.client.post('/api/media/upload/', data)
            self.assertEqual(response.status_code, 400)
            self.assertIn(field, response.data)
        self.assertFalse(Media.objects.exists())

    def test_batch_limit_and_news_single_file_limit_are_preserved(self):
        def photo():
            return SimpleUploadedFile('image.png', b'image', content_type='image/png')
        too_many = self.client.post('/api/media/upload/', {'files': [photo() for _ in range(11)]})
        self.assertEqual(too_many.status_code, 400)
        self.assertIn('files', too_many.data)
        news = self.client.post('/api/media/upload/', {
            'files': [photo(), photo()], 'content_type': 'news',
            'title': 'Headline', 'caption': 'Long body' * 10,
        })
        self.assertEqual(news.status_code, 400)
        self.assertIn('files', news.data)
        self.assertFalse(Media.objects.exists())

    def test_null_watch_time_retains_zero_duration_behavior(self):
        item = Media.objects.create(user=self.user, caption='Watch fixture')
        MediaView.objects.create(user=self.user, media=item, last_watch_time=10, total_watch_time=10)
        response = self.client.post(f'/api/media/watch/{item.id}/', {'watch_time': None}, format='json')
        self.assertEqual(response.status_code, 200)
        row = MediaView.objects.get()
        self.assertEqual(row.total_watch_time, 10)
        self.assertEqual(row.last_watch_time, 0)
