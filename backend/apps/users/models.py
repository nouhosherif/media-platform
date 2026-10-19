from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
import os
import uuid


def message_voice_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join(f"messages/user_{instance.sender_id}", filename)


class User(AbstractUser):
    profile_picture = models.ImageField(upload_to='profiles/', null=True, blank=True)
    bio = models.TextField(blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    location = models.CharField(max_length=120, blank=True)


class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='following'
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='followers'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower} follows {self.following}"


class DirectMessage(models.Model):
    TEXT = 'text'
    VOICE = 'voice'

    MESSAGE_TYPES = (
        (TEXT, 'Text'),
        (VOICE, 'Voice'),
    )

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_messages'
    )
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default=TEXT)
    text = models.TextField(blank=True)
    voice_file = models.FileField(upload_to=message_voice_path, null=True, blank=True)
    voice_duration = models.FloatField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

        indexes = [
            models.Index(fields=['sender', 'recipient', 'created_at', 'id'], name='users_msg_pair_created'),
            models.Index(fields=['recipient', 'is_read', 'sender'], name='users_msg_unread_sender'),
        ]

    def __str__(self):
        return f"{self.sender} to {self.recipient}"


class CallSession(models.Model):
    AUDIO = 'audio'
    VIDEO = 'video'

    RINGING = 'ringing'
    ACCEPTED = 'accepted'
    ENDED = 'ended'
    DECLINED = 'declined'
    MISSED = 'missed'
    CANCELED = 'canceled'

    CALL_TYPES = (
        (AUDIO, 'Audio'),
        (VIDEO, 'Video'),
    )

    CALL_STATUSES = (
        (RINGING, 'Ringing'),
        (ACCEPTED, 'Accepted'),
        (ENDED, 'Ended'),
        (DECLINED, 'Declined'),
        (MISSED, 'Missed'),
        (CANCELED, 'Canceled'),
    )

    caller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='started_calls'
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_calls'
    )
    call_type = models.CharField(max_length=20, choices=CALL_TYPES)
    status = models.CharField(max_length=20, choices=CALL_STATUSES, default=RINGING)
    offer = models.JSONField(null=True, blank=True)
    answer = models.JSONField(null=True, blank=True)
    caller_ice = models.JSONField(default=list, blank=True)
    recipient_ice = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

        indexes = [
            models.Index(fields=['caller', 'status', '-created_at'], name='users_call_caller_state'),
            models.Index(fields=['recipient', 'status', '-created_at'], name='users_call_recipient_state'),
        ]

    def __str__(self):
        return f"{self.caller} {self.call_type} call to {self.recipient}"


class Notification(models.Model):
    MESSAGE = 'message'
    FOLLOW = 'follow'
    CALL = 'call'
    SYSTEM = 'system'

    NOTIFICATION_TYPES = (
        (MESSAGE, 'Message'),
        (FOLLOW, 'Follow'),
        (CALL, 'Call'),
        (SYSTEM, 'System'),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='triggered_notifications',
        null=True,
        blank=True
    )
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    message = models.CharField(max_length=255)
    target_url = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

        indexes = [
            models.Index(fields=['recipient', '-created_at', '-id'], name='users_note_created'),
        ]

    def __str__(self):
        return self.message
