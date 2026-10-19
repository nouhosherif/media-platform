from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import DirectMessage, Follow, Notification, User
from ..serializers import RegisterSerializer
from .base import UserAPITestCase


class SocialAPITests(UserAPITestCase):
    def test_follow_directory_does_not_expose_email(self):
        viewer = self.create_user('followviewer', 'followviewer@example.com')
        self.create_user('followtarget', 'hidden-follow@example.com')
        self.client.force_authenticate(viewer)

        response = self.client.get('/api/users/follows/?tab=discover')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['results'])
        self.assertNotIn('email', response.data['results'][0])
