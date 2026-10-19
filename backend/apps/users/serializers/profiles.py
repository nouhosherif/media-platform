from rest_framework import serializers

from ..models import User
from ..selectors.profiles import get_user_summaries


class BasicUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    profile_picture = serializers.SerializerMethodField()
    posts_count = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
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
        ]

    def get_profile_picture(self, obj):
        if not obj.profile_picture:
            return None

        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.profile_picture.url)

        return obj.profile_picture.url

    def get_summary(self, obj):
        summaries = self.context.setdefault('user_summaries', {})
        if obj.pk not in summaries:
            request = self.context.get('request')
            viewer = request.user if request else None
            summaries.update(get_user_summaries([obj.pk], viewer))
        return summaries[obj.pk]

    def get_followers_count(self, obj):
        return self.get_summary(obj)['followers_count']

    def get_following_count(self, obj):
        return self.get_summary(obj)['following_count']

    def get_posts_count(self, obj):
        return self.get_summary(obj)['posts_count']

    def get_likes_count(self, obj):
        return self.get_summary(obj)['likes_count']

    def get_is_following(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False

        return self.get_summary(obj)['is_following']


class ProfileSerializer(BasicUserSerializer):
    is_self = serializers.SerializerMethodField()

    class Meta(BasicUserSerializer.Meta):
        fields = [
            *BasicUserSerializer.Meta.fields,
            'email',
            'first_name',
            'last_name',
            'phone_number',
            'location',
            'date_joined',
            'is_self',
        ]
        read_only_fields = ['date_joined']

    def get_is_self(self, obj):
        request = self.context.get('request')
        return bool(
            request
            and request.user.is_authenticated
            and obj.pk == request.user.pk
        )


class PublicProfileSerializer(ProfileSerializer):
    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')
        profile_user = self.instance
        is_self = bool(
            request
            and request.user.is_authenticated
            and isinstance(profile_user, User)
            and profile_user.pk == request.user.pk
        )

        if not is_self:
            fields.pop('email', None)
            fields.pop('phone_number', None)
            fields.pop('location', None)
            fields.pop('date_joined', None)
        return fields


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'bio', 'phone_number', 'location']

    def validate(self, attrs):
        return {
            key: value.strip() if isinstance(value, str) else value
            for key, value in attrs.items()
        }
