from django.db import connection
from django.test.utils import CaptureQueriesContext

from ..models import CallSession, DirectMessage, Follow, Notification
from ..selectors.messages import get_message_threads
from ..selectors.profiles import get_user_summaries
from .base import UserAPITestCase


class UserQueryTests(UserAPITestCase):
    def setUp(self):
        super().setUp()
        self.viewer = self.create_user('viewer', 'viewer@example.com')
        self.peers = [
            self.create_user(f'peer{index}', f'peer{index}@example.com')
            for index in range(5)
        ]
        self.client.force_authenticate(self.viewer)

    def test_summaries_do_not_multiply_related_counts(self):
        from apps.media_handler.models import Like, Media

        target = self.peers[0]
        Follow.objects.create(follower=self.viewer, following=target)
        Follow.objects.create(follower=self.peers[1], following=target)
        Follow.objects.create(follower=target, following=self.peers[2])
        posts = [Media.objects.create(user=target, caption=f'post {index}', media_type='text') for index in range(3)]
        Like.objects.create(user=self.viewer, media=posts[0])
        Like.objects.create(user=self.peers[1], media=posts[0])
        with self.assertNumQueries(1):
            summary = get_user_summaries([target.pk], self.viewer)[target.pk]
        self.assertEqual(summary['followers_count'], 2)
        self.assertEqual(summary['following_count'], 1)
        self.assertEqual(summary['posts_count'], 3)
        self.assertEqual(summary['likes_count'], 2)
        self.assertTrue(summary['is_following'])

    def test_search_batches_social_summaries(self):
        with self.assertNumQueries(2):
            response = self.client.get('/api/users/search/')
        self.assertEqual(len(response.data), 5)

    def test_follow_directory_batches_viewer_and_results(self):
        with self.assertNumQueries(2):
            response = self.client.get('/api/users/follows/')
        self.assertEqual(len(response.data['results']), 5)

    def test_conversation_query_count_does_not_grow_with_messages(self):
        peer = self.peers[0]
        DirectMessage.objects.bulk_create([
            DirectMessage(sender=peer, recipient=self.viewer, text=str(index))
            for index in range(30)
        ])
        with self.assertNumQueries(4):
            response = self.client.get(f'/api/users/messages/{peer.pk}/')
        self.assertEqual(len(response.data['messages']), 30)
        self.assertTrue(all(item['is_read'] for item in response.data['messages']))

    def test_thread_list_fetches_only_latest_messages_and_groups_unread(self):
        for peer in self.peers:
            DirectMessage.objects.bulk_create([
                DirectMessage(sender=peer, recipient=self.viewer, text=str(index))
                for index in range(10)
            ])
        with self.assertNumQueries(1):
            latest = list(get_message_threads(user=self.viewer))
        self.assertEqual(len(latest), 5)
        with self.assertNumQueries(3):
            response = self.client.get('/api/users/messages/')
        self.assertEqual(len(response.data), 5)
        self.assertTrue(all(item['unread_count'] == 10 for item in response.data))
        self.assertTrue(all(item['last_message']['text'] == '9' for item in response.data))

    def test_notification_query_count_is_constant(self):
        Notification.objects.bulk_create([
            Notification(
                recipient=self.viewer, actor=peer, notification_type=Notification.FOLLOW,
                message='followed you',
            ) for peer in self.peers
        ])
        with self.assertNumQueries(3):
            response = self.client.get('/api/users/notifications/')
        self.assertEqual(response.data['total_count'], 5)

    def test_calls_batch_repeated_participants(self):
        CallSession.objects.bulk_create([
            CallSession(caller=peer, recipient=self.viewer, call_type=CallSession.AUDIO)
            for peer in self.peers
        ])
        with self.assertNumQueries(2):
            response = self.client.get('/api/users/calls/?active=1')
        self.assertEqual(len(response.data), 5)

    def test_thread_tie_uses_latest_id_without_duplicate_peer(self):
        first = DirectMessage.objects.create(sender=self.viewer, recipient=self.peers[0], text='first')
        second = DirectMessage.objects.create(sender=self.peers[0], recipient=self.viewer, text='second')
        DirectMessage.objects.filter(pk=second.pk).update(created_at=first.created_at)
        response = self.client.get('/api/users/messages/')
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['last_message']['id'], second.pk)
