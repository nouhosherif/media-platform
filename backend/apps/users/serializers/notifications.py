from rest_framework import serializers

from ..models import Notification
from .profiles import BasicUserSerializer


class NotificationSerializer(serializers.ModelSerializer):
    actor = BasicUserSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'actor',
            'notification_type',
            'message',
            'target_url',
            'is_read',
            'created_at',
        ]
