from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import DirectMessage, Follow, Notification, User
from ..serializers import RegisterSerializer
from .base import UserAPITestCase


class NotificationsAPITests(UserAPITestCase):
    def test_notification_actor_does_not_expose_email(self):
        viewer = self.create_user('notifyviewer', 'notifyviewer@example.com')
        actor = self.create_user('notifyactor', 'hidden-notify@example.com')
        Notification.objects.create(
            recipient=viewer,
            actor=actor,
            notification_type=Notification.FOLLOW,
            message='notifyactor followed you',
        )
        self.client.force_authenticate(viewer)

        response = self.client.get('/api/users/notifications/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('email', response.data['results'][0]['actor'])
