from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import DirectMessage, Follow, Notification, User
from ..serializers import RegisterSerializer
from .base import UserAPITestCase


class ProfilesAPITests(UserAPITestCase):
    def test_profile_with_jwt_authentication(self):
        user = self.create_user(email='profile@example.com')
        access_token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data),
            {
                'id',
                'username',
                'email',
                'full_name',
                'bio',
                'profile_picture',
                'posts_count',
                'likes_count',
                'followers_count',
                'following_count',
                'is_following',
                'first_name',
                'last_name',
                'phone_number',
                'location',
                'date_joined',
                'is_self',
            },
        )
        self.assertEqual(response.data['id'], user.id)
        self.assertEqual(response.data['email'], user.email)
        self.assertEqual(response.data['first_name'], user.first_name)
        self.assertEqual(response.data['last_name'], user.last_name)
        self.assertTrue(response.data['is_self'])

    def test_profile_contact_fields_can_be_updated_without_changing_identity(self):
        user = self.create_user(username='profile-owner', email='owner@example.com')
        self.client.force_authenticate(user)

        response = self.client.patch(
            self.profile_url,
            {
                'first_name': '  Profile ',
                'last_name': ' Owner  ',
                'bio': '  Building useful things. ',
                'phone_number': '  +231 77 123 456  ',
                'location': '  Monrovia  ',
                'username': 'attempted-change',
                'email': 'attempted@example.com',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, 'Profile')
        self.assertEqual(user.last_name, 'Owner')
        self.assertEqual(user.bio, 'Building useful things.')
        self.assertEqual(user.phone_number, '+231 77 123 456')
        self.assertEqual(user.location, 'Monrovia')
        self.assertEqual(user.username, 'profile-owner')
        self.assertEqual(user.email, 'owner@example.com')
        self.assertIn('date_joined', response.data)

    def test_other_user_public_profile_hides_email_and_preserves_social_fields(self):
        viewer = self.create_user(
            username='viewer',
            email='viewer@example.com',
        )
        target = self.create_user(
            username='publicuser',
            email='private@example.com',
        )
        target.bio = 'Public profile bio'
        target.save(update_fields=['bio'])
        followed_user = self.create_user(
            username='followeduser',
            email='followed@example.com',
        )
        Follow.objects.create(follower=viewer, following=target)
        Follow.objects.create(follower=target, following=followed_user)
        access_token = RefreshToken.for_user(viewer).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

        response = self.client.get(f'/api/users/profile/{target.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data),
            {
                'id',
                'username',
                'full_name',
                'bio',
                'profile_picture',
                'posts_count',
                'likes_count',
                'followers_count',
                'following_count',
                'is_following',
                'first_name',
                'last_name',
                'is_self',
            },
        )
        self.assertEqual(response.data['username'], target.username)
        self.assertEqual(response.data['full_name'], target.get_full_name())
        self.assertEqual(response.data['bio'], target.bio)
        self.assertEqual(response.data['followers_count'], 1)
        self.assertEqual(response.data['following_count'], 1)
        self.assertTrue(response.data['is_following'])
        self.assertFalse(response.data['is_self'])
        self.assertNotIn('phone_number', response.data)
        self.assertNotIn('location', response.data)
        self.assertNotIn('date_joined', response.data)
        self.assertEqual(response.data['first_name'], target.first_name)
        self.assertEqual(response.data['last_name'], target.last_name)

    def test_own_profile_by_id_includes_private_fields(self):
        user = self.create_user(
            username='selfprofile',
            email='self@example.com',
        )
        access_token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

        response = self.client.get(f'/api/users/profile/{user.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('email', response.data)
        self.assertEqual(response.data['email'], user.email)
        self.assertEqual(response.data['first_name'], user.first_name)
        self.assertEqual(response.data['last_name'], user.last_name)
        self.assertTrue(response.data['is_self'])

    def test_user_search_does_not_expose_or_search_email(self):
        viewer = self.create_user('searchviewer', 'searchviewer@example.com')
        target = self.create_user('searchtarget', 'hidden-search@example.com')
        self.client.force_authenticate(viewer)

        username_response = self.client.get('/api/users/search/?q=searchtarget')
        email_response = self.client.get('/api/users/search/?q=hidden-search@example.com')

        self.assertEqual(username_response.status_code, status.HTTP_200_OK)
        self.assertEqual(username_response.data[0]['id'], target.id)
        self.assertNotIn('email', username_response.data[0])
        self.assertEqual(email_response.status_code, status.HTTP_200_OK)
        self.assertEqual(email_response.data, [])
