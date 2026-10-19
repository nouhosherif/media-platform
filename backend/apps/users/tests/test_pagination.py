from urllib.parse import urlsplit

from ..models import DirectMessage, Notification
from .base import UserAPITestCase


def relative_url(url):
    parts = urlsplit(url)
    return parts.path + ('?' + parts.query if parts.query else '')


class CommunicationPaginationTests(UserAPITestCase):
    def setUp(self):
        super().setUp()
        self.viewer = self.create_user('viewer', 'viewer@example.com')
        self.peer = self.create_user('peer', 'peer@example.com')
        self.client.force_authenticate(self.viewer)

    def test_legacy_conversation_is_not_silently_truncated(self):
        DirectMessage.objects.bulk_create([
            DirectMessage(sender=self.peer, recipient=self.viewer, text=str(index))
            for index in range(25)
        ])
        response = self.client.get(f'/api/users/messages/{self.peer.pk}/')
        self.assertEqual(set(response.data), {'user', 'messages'})
        self.assertEqual(len(response.data['messages']), 25)

    def test_latest_page_is_chronological_and_only_returned_messages_are_read(self):
        messages = [DirectMessage.objects.create(
            sender=self.peer, recipient=self.viewer, text=str(index)
        ) for index in range(5)]
        response = self.client.get(
            f'/api/users/messages/{self.peer.pk}/?page=last&page_size=2'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 5)
        self.assertEqual([item['id'] for item in response.data['messages']], [messages[4].pk])
        self.assertIsNone(response.data['next'])
        self.assertIsNotNone(response.data['previous'])
        self.assertEqual(DirectMessage.objects.filter(is_read=False).count(), 4)

        older = self.client.get(relative_url(response.data['previous']))
        self.assertEqual([item['id'] for item in older.data['messages']], [messages[2].pk, messages[3].pk])
        self.assertEqual(DirectMessage.objects.filter(is_read=False).count(), 2)

    def test_opt_in_thread_response_has_navigation_and_keeps_legacy_list(self):
        third = self.create_user('third', 'third@example.com')
        DirectMessage.objects.create(sender=self.peer, recipient=self.viewer, text='one')
        DirectMessage.objects.create(sender=third, recipient=self.viewer, text='two')
        self.assertIsInstance(self.client.get('/api/users/messages/').data, list)
        response = self.client.get('/api/users/messages/?page=1&page_size=1')
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIsNotNone(response.data['next'])

    def test_notifications_page_keeps_global_counts_and_owner_scope(self):
        Notification.objects.bulk_create([
            Notification(recipient=self.viewer, actor=self.peer,
                         notification_type=Notification.MESSAGE, message=str(index))
            for index in range(5)
        ])
        Notification.objects.create(recipient=self.peer, notification_type=Notification.SYSTEM,
                                    message='private other account')
        response = self.client.get('/api/users/notifications/?page=1&page_size=2')
        self.assertEqual(response.data['count'], 5)
        self.assertEqual(response.data['total_count'], 5)
        self.assertEqual(response.data['unread_count'], 5)
        self.assertEqual(len(response.data['results']), 2)
        self.assertIsNotNone(response.data['next'])
        self.assertTrue(all(item['message'] != 'private other account' for item in response.data['results']))

    def test_search_and_follows_opt_in_metadata_preserve_existing_fields(self):
        response = self.client.get('/api/users/search/?page=1&page_size=1')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], self.peer.pk)
        response = self.client.get('/api/users/follows/?page=1&page_size=1')
        self.assertEqual(response.data['tab'], 'discover')
        self.assertIn('followers_count', response.data)
        self.assertIn('following_count', response.data)
        self.assertEqual(response.data['count'], 1)

    def test_invalid_page_does_not_mark_messages_read(self):
        DirectMessage.objects.create(sender=self.peer, recipient=self.viewer, text='unseen')
        response = self.client.get(f'/api/users/messages/{self.peer.pk}/?page=999')
        self.assertEqual(response.status_code, 404)
        self.assertFalse(DirectMessage.objects.get().is_read)

    def test_page_size_is_bounded(self):
        DirectMessage.objects.bulk_create([
            DirectMessage(sender=self.peer, recipient=self.viewer, text=str(index))
            for index in range(105)
        ])
        response = self.client.get(f'/api/users/messages/{self.peer.pk}/?page_size=10000')
        self.assertEqual(len(response.data['messages']), 100)
        self.assertEqual(response.data['count'], 105)
