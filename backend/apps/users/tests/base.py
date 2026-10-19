from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from ..models import User


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class UserAPITestCase(TestCase):
    registration_url = '/api/users/register/'
    login_url = '/api/users/login/'
    refresh_url = '/api/users/token/refresh/'
    profile_url = '/api/users/profile/'
    password = 'TestPassword!123'

    def setUp(self):
        self.client = APIClient()

    def create_user(self, username='testuser', email='testuser@example.com'):
        return User.objects.create_user(
            username=username, email=email, password=self.password,
            first_name='Test', last_name='User',
        )
