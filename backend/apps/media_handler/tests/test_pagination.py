from urllib.parse import parse_qs, urlsplit

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import Comment, Like, Media, MediaView
from ..selectors import explore_feed


User = get_user_model()


class MediaPaginationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='paging-owner')
        self.reader = User.objects.create_user(username='paging-reader')
        self.client = APIClient()
        self.client.force_authenticate(self.reader)

    def create_posts(self, count):
        return Media.objects.bulk_create([
            Media(user=self.user, caption=f'Page post {index}', media_type='text')
            for index in range(count)
        ])

    def test_explore_ranking_forward_and_backward_with_ties(self):
        items = self.create_posts(25)
        for index, item in enumerate(items):
            if index % 2:
                Like.objects.create(user=self.reader, media=item)
            if index % 3:
                Comment.objects.create(user=self.reader, media=item, text='Rank comment')
            MediaView.objects.create(
                user=self.reader, media=item, view_count=index % 4, total_watch_time=index / 2,
            )
        expected = list(explore_feed().values_list('id', flat=True))
        first = self.client.get('/api/media/explore/')
        self.assertEqual(first.status_code, 200)
        self.assertEqual([item['id'] for item in first.data['results']], expected[:10])
        token = parse_qs(urlsplit(first.data['next']).query)['cursor'][0]
        self.assertTrue(token.startswith('e1.'))
        second = self.client.get(first.data['next'])
        third = self.client.get(second.data['next'])
        self.assertEqual([item['id'] for item in second.data['results']], expected[10:20])
        self.assertEqual([item['id'] for item in third.data['results']], expected[20:])
        self.assertIsNone(third.data['next'])
        back = self.client.get(third.data['previous'])
        self.assertEqual([item['id'] for item in back.data['results']], expected[10:20])
        start = self.client.get(back.data['previous'])
        self.assertEqual([item['id'] for item in start.data['results']], expected[:10])
        self.assertIsNone(start.data['previous'])

    def test_more_than_one_thousand_identical_rank_rows_do_not_stall(self):
        items = self.create_posts(1005)
        Media.objects.update(uploaded_at=timezone.now())
        seen = []
        url = '/api/media/explore/?page_size=100'
        for _ in range(12):
            if url is None:
                break
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            seen.extend(item['id'] for item in response.data['results'])
            url = response.data['next']
        self.assertIsNone(url)
        self.assertEqual(seen, [item.id for item in reversed(items)])
        self.assertEqual(len(seen), len(set(seen)))

    def test_legacy_chronological_cursor_remains_usable(self):
        self.create_posts(25)
        first = self.client.get('/api/media/feed/')
        chronological_next = self.client.get(first.data['next'])
        legacy_explore_url = first.data['next'].replace('/feed/', '/explore/')
        response = self.client.get(legacy_explore_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item['id'] for item in response.data['results']],
            [item['id'] for item in chronological_next.data['results']],
        )

    def test_ranked_cursor_still_works_when_boundary_row_is_deleted(self):
        self.create_posts(15)
        first = self.client.get('/api/media/explore/')
        boundary = first.data['results'][-1]['id']
        Media.objects.filter(pk=boundary).delete()
        response = self.client.get(first.data['next'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 5)

    def test_tampered_ranked_cursor_returns_404(self):
        self.create_posts(11)
        first = self.client.get('/api/media/explore/')
        response = self.client.get(first.data['next'] + 'corrupted')
        self.assertEqual(response.status_code, 404)

    def test_page_size_is_optional_and_capped(self):
        self.create_posts(105)
        for endpoint in ('feed', 'explore'):
            with self.subTest(endpoint=endpoint):
                default = self.client.get(f'/api/media/{endpoint}/')
                small = self.client.get(f'/api/media/{endpoint}/?page_size=3')
                capped = self.client.get(f'/api/media/{endpoint}/?page_size=9999')
                self.assertEqual(len(default.data['results']), 10)
                self.assertEqual(len(small.data['results']), 3)
                self.assertEqual(len(capped.data['results']), 100)
