from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile

from ..models import CallSession, DirectMessage, Follow, Notification
from ..services.messages import send_message
from ..services.social import toggle_follow
from .base import UserAPITestCase


class CommunicationOperationTests(UserAPITestCase):
    def setUp(self):
        super().setUp()
        self.viewer = self.create_user('viewer', 'viewer@example.com')
        self.peer = self.create_user('peer', 'peer@example.com')
        self.client.force_authenticate(self.viewer)

    def test_message_and_notification_are_created_together(self):
        response = self.client.post('/api/users/messages/', {
            'recipient_id': self.peer.pk, 'text': '  hello  ',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['text'], 'hello')
        notification = Notification.objects.get()
        self.assertEqual(notification.recipient_id, self.peer.pk)
        self.assertEqual(notification.actor_id, self.viewer.pk)
        self.assertEqual(notification.target_url, f'/messages?user={self.viewer.pk}')

    def test_message_rolls_back_when_notification_fails(self):
        with patch('apps.users.services.messages.create_notification', side_effect=RuntimeError('test')):
            with self.assertRaises(RuntimeError):
                send_message(sender=self.viewer, recipient_id=self.peer.pk, text='hello')
        self.assertFalse(DirectMessage.objects.exists())

    def test_failed_voice_operation_cleans_its_new_upload(self):
        storage = DirectMessage._meta.get_field('voice_file').storage
        with patch('apps.users.services.messages.create_notification', side_effect=RuntimeError('test')):
            with patch.object(storage, 'delete', wraps=storage.delete) as delete:
                with self.assertRaises(RuntimeError):
                    send_message(
                        sender=self.viewer, recipient_id=self.peer.pk,
                        voice_file=SimpleUploadedFile('voice.webm', b'audio', content_type='audio/webm'),
                    )
        delete.assert_called_once()
        self.assertFalse(DirectMessage.objects.exists())

    def test_follow_notification_failure_rolls_back_relationship(self):
        with patch('apps.users.services.social.create_notification', side_effect=RuntimeError('test')):
            with self.assertRaises(RuntimeError):
                toggle_follow(user=self.viewer, target_id=self.peer.pk)
        self.assertFalse(Follow.objects.exists())

    def test_follow_unfollow_preserve_response_contract(self):
        first = self.client.post(f'/api/users/follow/{self.peer.pk}/')
        self.assertEqual(first.data, {
            'message': 'Followed', 'is_following': True,
            'followers_count': 1, 'following_count': 1,
        })
        second = self.client.post(f'/api/users/follow/{self.peer.pk}/')
        self.assertFalse(second.data['is_following'])
        self.assertEqual(second.data['followers_count'], 0)
        self.assertEqual(Notification.objects.count(), 1)

    def test_self_follow_and_self_message_are_rejected(self):
        response = self.client.post(f'/api/users/follow/{self.viewer.pk}/')
        self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/users/messages/', {
            'recipient_id': self.viewer.pk, 'text': 'hello',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(DirectMessage.objects.exists())

    def test_invalid_recipient_and_message_type_are_validation_errors(self):
        for payload in [
            {'recipient_id': 'invalid', 'text': 'hello'},
            {'recipient_id': self.peer.pk, 'text': {'bad': 'type'}},
        ]:
            response = self.client.post('/api/users/messages/', payload, format='json')
            self.assertEqual(response.status_code, 400)
            self.assertIn('error', response.data)

    def test_notification_read_is_recipient_scoped(self):
        other = Notification.objects.create(recipient=self.peer,
            notification_type=Notification.SYSTEM, message='private')
        response = self.client.post(f'/api/users/notifications/{other.pk}/read/')
        self.assertEqual(response.status_code, 404)
        other.refresh_from_db()
        self.assertFalse(other.is_read)

    def test_mark_all_notifications_read_does_not_affect_other_recipient(self):
        own = Notification.objects.create(recipient=self.viewer,
            notification_type=Notification.SYSTEM, message='own')
        other = Notification.objects.create(recipient=self.peer,
            notification_type=Notification.SYSTEM, message='other')
        response = self.client.post('/api/users/notifications/mark-all-read/')
        self.assertEqual(response.status_code, 200)
        own.refresh_from_db()
        other.refresh_from_db()
        self.assertTrue(own.is_read)
        self.assertFalse(other.is_read)

    def test_unrelated_user_cannot_read_or_update_call(self):
        third = self.create_user('third', 'third@example.com')
        call = CallSession.objects.create(caller=self.peer, recipient=third, call_type=CallSession.AUDIO)
        self.assertEqual(self.client.get(f'/api/users/calls/{call.pk}/').status_code, 404)
        response = self.client.post(f'/api/users/calls/{call.pk}/', {'action': 'end'}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_only_recipient_can_accept_and_ice_arrays_are_preserved(self):
        call = CallSession.objects.create(caller=self.viewer, recipient=self.peer, call_type=CallSession.VIDEO)
        url = f'/api/users/calls/{call.pk}/'
        response = self.client.post(url, {'action': 'accept'}, format='json')
        self.assertEqual(response.status_code, 403)
        for candidate in ['one', 'two']:
            response = self.client.post(url, {
                'action': 'signal', 'ice_candidate': {'candidate': candidate},
            }, format='json')
            self.assertEqual(response.status_code, 200)
        self.client.force_authenticate(self.peer)
        response = self.client.post(url, {
            'action': 'accept', 'answer': {'type': 'answer', 'sdp': 'example'},
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], CallSession.ACCEPTED)
        self.assertEqual(len(response.data['caller_ice']), 2)
        self.assertNotIn('email', response.data['caller'])
        self.assertNotIn('email', response.data['recipient'])

    def test_voice_duration_non_finite_is_not_persisted(self):
        message = send_message(sender=self.viewer, recipient_id=self.peer.pk, text='hello',
                               voice_duration='Infinity')
        self.assertIsNone(message.voice_duration)


class PublicAuthenticationTests(UserAPITestCase):
    def test_signup_ignores_an_expired_or_invalid_bearer_token(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer expired.invalid.token')
        response = self.client.post(self.registration_url, {
            'email': 'new@example.com', 'password': self.password,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertIn('access', response.data)

    def test_login_ignores_stale_authorization_but_validates_password(self):
        user = self.create_user()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer expired.invalid.token')
        response = self.client.post(self.login_url, {
            'username': user.email, 'password': self.password,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        invalid = self.client.post(self.login_url, {
            'username': user.email, 'password': 'wrong',
        }, format='json')
        self.assertEqual(invalid.status_code, 401)
