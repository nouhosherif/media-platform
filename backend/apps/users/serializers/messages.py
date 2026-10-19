from rest_framework import serializers

from ..models import CallSession, DirectMessage
from .profiles import BasicUserSerializer


class DirectMessageSerializer(serializers.ModelSerializer):
    sender = BasicUserSerializer(read_only=True)
    recipient = BasicUserSerializer(read_only=True)
    voice_file = serializers.SerializerMethodField()

    class Meta:
        model = DirectMessage
        fields = [
            'id',
            'sender',
            'recipient',
            'message_type',
            'text',
            'voice_file',
            'voice_duration',
            'is_read',
            'created_at',
        ]

    def get_voice_file(self, obj):
        if not obj.voice_file:
            return None

        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.voice_file.url)

        return obj.voice_file.url


class CallSessionSerializer(serializers.ModelSerializer):
    caller = BasicUserSerializer(read_only=True)
    recipient = BasicUserSerializer(read_only=True)
    other_user = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = CallSession
        fields = [
            'id',
            'caller',
            'recipient',
            'other_user',
            'role',
            'call_type',
            'status',
            'offer',
            'answer',
            'caller_ice',
            'recipient_ice',
            'created_at',
            'answered_at',
            'ended_at',
        ]

    def get_other_user(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        other_user = obj.recipient if obj.caller_id == request.user.id else obj.caller
        return BasicUserSerializer(other_user, context=self.context).data

    def get_role(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        return 'caller' if obj.caller_id == request.user.id else 'recipient'
