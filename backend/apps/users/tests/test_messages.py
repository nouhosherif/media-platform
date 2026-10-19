from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import DirectMessage, Follow, Notification, User
from ..serializers import RegisterSerializer
from .base import UserAPITestCase


class MessagesAPITests(UserAPITestCase):
    def test_message_payloads_do_not_expose_participant_email(self):
        viewer = self.create_user('messageviewer', 'messageviewer@example.com')
        sender = self.create_user('messagesender', 'hidden-message@example.com')
        DirectMessage.objects.create(sender=sender, recipient=viewer, text='Hello')
        self.client.force_authenticate(viewer)

        threads = self.client.get('/api/users/messages/')
        conversation = self.client.get(f'/api/users/messages/{sender.id}/')

        self.assertEqual(threads.status_code, status.HTTP_200_OK)
        self.assertNotIn('email', threads.data[0]['user'])
        self.assertNotIn('email', threads.data[0]['last_message']['sender'])
        self.assertNotIn('email', threads.data[0]['last_message']['recipient'])
        self.assertEqual(conversation.status_code, status.HTTP_200_OK)
        self.assertNotIn('email', conversation.data['user'])
        self.assertNotIn('email', conversation.data['messages'][0]['sender'])
        self.assertNotIn('email', conversation.data['messages'][0]['recipient'])
