from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import Follow

from ..models import Comment, Like, Media, MediaView
from ..selectors import chronological_feed, explore_feed, following_feed
from ..serializers import MediaSerializer


User = get_user_model()


class MediaQueryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(username='query-owner')
        cls.reader = User.objects.create_user(username='query-reader')
        cls.items = Media.objects.bulk_create([
            Media(user=cls.owner, caption=f'Post {index}', media_type='text')
            for index in range(10)
        ])
        Like.objects.bulk_create([Like(user=cls.reader, media=item) for item in cls.items])
        Comment.objects.bulk_create([
            Comment(user=cls.reader, media=item, text=f'Comment {index}')
            for item in cls.items for index in range(3)
        ])

    def test_ten_posts_and_thirty_nested_comments_use_two_queries(self):
        with self.assertNumQueries(2):
            data = MediaSerializer(chronological_feed()[:10], many=True).data
        self.assertEqual(len(data), 10)
        self.assertTrue(all(row['likes_count'] == 1 for row in data))
        self.assertEqual(sum(len(row['comments']) for row in data), 30)
        self.assertEqual(data[0]['comments'][0]['user'], str(self.reader))

    def test_explore_serialization_also_uses_two_queries(self):
        with self.assertNumQueries(2):
            data = MediaSerializer(explore_feed()[:10], many=True).data
        self.assertEqual(len(data), 10)

    def test_joined_likes_and_comments_do_not_multiply_engagement_totals(self):
        item = self.items[0]
        Like.objects.create(user=self.owner, media=item)
        MediaView.objects.create(user=self.reader, media=item, view_count=1, total_watch_time=2)
        MediaView.objects.create(user=self.owner, media=item, view_count=2, total_watch_time=4)
        ranked = explore_feed().get(pk=item.pk)
        self.assertEqual(ranked.likes_total, 2)
        self.assertEqual(ranked.comments_total, 3)
        self.assertEqual(ranked.views_total, 3)
        self.assertEqual(ranked.watch_total, 6)

    def test_following_feed_filters_and_personalized_fallback_is_preserved(self):
        self.assertFalse(following_feed(user=self.reader).exists())
        self.assertEqual(following_feed(user=self.reader, fallback=True).count(), 10)
        Follow.objects.create(follower=self.reader, following=self.owner)
        unrelated = Media.objects.create(user=self.reader, caption='Not followed')
        ids = list(following_feed(user=self.reader).values_list('id', flat=True))
        self.assertEqual(set(ids), {item.id for item in self.items})
        self.assertNotIn(unrelated.id, ids)

    def test_author_filter_and_feed_indexes_match_query_shape(self):
        self.assertIn('media_feed_time_idx', chronological_feed().explain())
        self.assertIn('media_author_time_idx', chronological_feed(user=self.owner).explain())
        self.assertEqual(chronological_feed(user=self.reader).count(), 0)

    def test_feed_api_query_count_and_response_contract(self):
        client = APIClient()
        client.force_authenticate(self.reader)
        with self.assertNumQueries(2):
            response = client.get('/api/media/feed/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), {'next', 'previous', 'results'})
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(len(response.data['results'][0]['comments']), 3)
