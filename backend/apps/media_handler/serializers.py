from rest_framework import serializers
from .models import Media, Like, Comment


class CommentSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'user', 'text', 'created_at']


class MediaSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    likes_count = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Media
        fields = [
            'id',
            'user',
            'file',
            'media_type',
            'file_size',
            'uploaded_at',
            'likes_count',
            'comments',
        ]
        read_only_fields = ['user', 'media_type', 'file_size', 'uploaded_at']

    def validate_file(self, value):
        max_size = 5 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("File too large (max 5MB)")

        allowed_types = ['image/jpeg', 'image/png', 'video/mp4']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError("Unsupported file type")

        return value

    def get_likes_count(self, obj):
        return obj.likes.count()


class LikeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Like
        fields = '__all__'
