from rest_framework import serializers
from .models import Media, Like, Comment


class CommentSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'user', 'text', 'created_at']


class MediaSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_profile_picture = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Media
        fields = [
            'id',
            'user',
            'user_id',
            'user_full_name',
            'user_profile_picture',
            'title',
            'content_type',
            'file',
            'caption',
            'media_type',
            'file_size',
            'uploaded_at',
            'likes_count',
            'comments',
        ]
        read_only_fields = ['user', 'media_type', 'file_size', 'uploaded_at']

    def validate_caption(self, value):
        return value.strip()

    def validate_title(self, value):
        return value.strip()

    def validate_file(self, value):
        max_size = 5 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("File too large (max 5MB)")

        allowed_types = ['image/jpeg', 'image/png', 'video/mp4']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError("Unsupported file type")

        return value

    def validate(self, attrs):
        if not attrs.get('file') and not attrs.get('caption'):
            raise serializers.ValidationError(
                {'non_field_errors': ['Add text or select a media file.']}
            )

        if attrs.get('content_type', 'post') == 'news':
            if not attrs.get('title'):
                raise serializers.ValidationError(
                    {'title': ['Add a headline for the news article.']}
                )
            if len(attrs.get('caption', '')) < 40:
                raise serializers.ValidationError(
                    {'caption': ['News articles must contain at least 40 characters.']}
                )

        return attrs

    def get_likes_count(self, obj):
        if hasattr(obj, 'likes_total'):
            return obj.likes_total
        return obj.likes.count()

    def get_user_profile_picture(self, obj):
        if not obj.user.profile_picture:
            return None

        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.user.profile_picture.url)

        return obj.user.profile_picture.url

class LikeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Like
        fields = '__all__'


def validated_upload_items(*, data, files, context, max_batch_size=10):
    """Validate the entire batch before any file or database write occurs."""
    if len(files) > max_batch_size:
        raise serializers.ValidationError(
            {'files': [f'Select no more than {max_batch_size} photos.']}
        )
    attributes = {
        'caption': data.get('caption', '').strip(),
        'title': data.get('title', '').strip(),
        'content_type': data.get('content_type', 'post').strip().lower(),
    }
    if attributes['content_type'] == 'news' and len(files) > 1:
        raise serializers.ValidationError({'files': ['A news article can include one media file.']})
    payloads = [dict(attributes, file=file) for file in files] or [attributes]
    validators = [MediaSerializer(data=payload, context=context) for payload in payloads]
    for validator in validators:
        validator.is_valid(raise_exception=True)
    if len(files) > 1 and any(not file.content_type.startswith('image/') for file in files):
        raise serializers.ValidationError({'files': ['Multiple selection supports photos only.']})
    return [validator.validated_data for validator in validators]
