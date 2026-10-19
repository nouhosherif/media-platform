from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import DirectMessage, Follow, Notification, User
from ..serializers import RegisterSerializer
from .base import UserAPITestCase


class AuthenticationAPITests(UserAPITestCase):
    def test_user_registration(self):
        response = self.client.post(
            self.registration_url,
            {
                'email': 'registered@example.com',
                'password': self.password,
                'first_name': 'Registered',
                'last_name': 'User',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            set(response.data),
            {
                'id',
                'username',
                'email',
                'first_name',
                'last_name',
                'access',
                'refresh',
            },
        )
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

        user = User.objects.get(email='registered@example.com')
        self.assertEqual(user.username, 'registered@example.com')
        self.assertTrue(user.check_password(self.password))

    def test_duplicate_email_returns_email_error(self):
        self.create_user(email='duplicate@example.com')

        response = self.client.post(
            self.registration_url,
            {
                'username': 'newusername',
                'email': 'DUPLICATE@example.com',
                'password': self.password,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertNotIn('username', response.data)

    def test_duplicate_email_without_username_returns_only_email_error(self):
        self.create_user(
            username='duplicate@example.com',
            email='duplicate@example.com',
        )

        response = self.client.post(
            self.registration_url,
            {
                'email': 'DUPLICATE@example.com',
                'password': self.password,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertNotIn('username', response.data)

    def test_duplicate_username_returns_username_error(self):
        self.create_user(username='takenusername', email='original@example.com')

        response = self.client.post(
            self.registration_url,
            {
                'username': 'TakenUsername',
                'email': 'new@example.com',
                'password': self.password,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)
        self.assertNotIn('email', response.data)

    def test_save_time_username_collision_returns_validation_error(self):
        serializer = RegisterSerializer(data={
            'username': 'raceusername',
            'email': 'race@example.com',
            'password': self.password,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.create_user(username='raceusername', email='other@example.com')

        with self.assertRaises(ValidationError) as error:
            serializer.save()

        self.assertIn('username', error.exception.detail)

    def test_invalid_email_returns_email_error(self):
        response = self.client.post(
            self.registration_url,
            {
                'username': 'invalidemailuser',
                'email': 'not-an-email',
                'password': self.password,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_common_password_returns_password_error(self):
        response = self.client.post(
            self.registration_url,
            {
                'username': 'commonpassworduser',
                'email': 'common@example.com',
                'password': 'password',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
        self.assertIn('This password is too common.', response.data['password'])

    def test_numeric_password_returns_password_error(self):
        response = self.client.post(
            self.registration_url,
            {
                'username': 'numericpassworduser',
                'email': 'numeric@example.com',
                'password': '123456789',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
        self.assertIn('This password is entirely numeric.', response.data['password'])

    def test_valid_strong_password_succeeds(self):
        response = self.client.post(
            self.registration_url,
            {
                'username': 'strongpassworduser',
                'email': 'strong@example.com',
                'password': 'StrongRegistration!927',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='strongpassworduser').exists())

    def test_newly_registered_user_can_login(self):
        registration = self.client.post(
            self.registration_url,
            {
                'username': 'newloginuser',
                'email': 'newlogin@example.com',
                'password': self.password,
            },
            format='json',
        )

        self.assertEqual(registration.status_code, status.HTTP_201_CREATED)

        login = self.client.post(
            self.login_url,
            {
                'username': 'newlogin@example.com',
                'password': self.password,
            },
            format='json',
        )

        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertIn('access', login.data)
        self.assertIn('refresh', login.data)

    def test_user_login(self):
        user = self.create_user(email='login@example.com')

        response = self.client.post(
            self.login_url,
            {
                'username': user.email,
                'password': self.password,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['username'], user.username)

    def test_jwt_token_refresh(self):
        user = self.create_user(email='refresh@example.com')
        refresh = RefreshToken.for_user(user)

        response = self.client.post(
            self.refresh_url,
            {'refresh': str(refresh)},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_profile_without_authentication_returns_401(self):
        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
