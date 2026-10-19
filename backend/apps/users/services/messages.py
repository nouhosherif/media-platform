import logging
import math

from django.db import transaction

from ..models import DirectMessage, Notification
from ..selectors.profiles import get_profile
from .errors import invalid
from .notifications import create_notification

logger = logging.getLogger(__name__)


def send_message(*, sender, recipient_id, text='', voice_file=None, voice_duration=None):
    if not recipient_id:
        invalid("Recipient is required")
    if not isinstance(text, str):
        invalid("Message text must be a string")
    text = text.strip()
    if not text and not voice_file:
        invalid("Message cannot be empty")
    try:
        recipient_id = int(recipient_id)
    except (TypeError, ValueError):
        invalid("Recipient must be a user ID")
    recipient = get_profile(recipient_id)
    if recipient.pk == sender.pk:
        invalid("You cannot message yourself")

    message_type = DirectMessage.TEXT
    if voice_file:
        if voice_file.size > 10 * 1024 * 1024:
            invalid("Voice message too large (max 10MB)")
        allowed_extensions = ('.webm', '.ogg', '.mp3', '.wav', '.m4a', '.mp4')
        if not (voice_file.content_type or '').startswith('audio/') and not voice_file.name.lower().endswith(allowed_extensions):
            invalid("Voice message must be an audio file")
        message_type = DirectMessage.VOICE

    duration = None
    if voice_duration:
        try:
            parsed = float(voice_duration)
            if math.isfinite(parsed):
                duration = max(parsed, 0)
        except (TypeError, ValueError):
            pass

    message = DirectMessage(
        sender=sender, recipient=recipient, text=text, message_type=message_type,
        voice_file=voice_file, voice_duration=duration,
    )
    try:
        with transaction.atomic():
            message.save()
            description = 'voice message' if voice_file else 'message'
            create_notification(
                recipient=recipient, actor=sender,
                notification_type=Notification.MESSAGE,
                message=f"{sender.username} sent you a {description}",
                target_url=f"/messages?user={sender.pk}",
            )
    except Exception:
        # Storage writes are not transactional. Remove only this failed new upload.
        if message.voice_file and message.voice_file._committed:
            try:
                message.voice_file.delete(save=False)
            except Exception:
                logger.warning("Unable to clean up a failed voice upload", exc_info=True)
        raise
    return message


def mark_conversation_read(*, recipient, sender, message_ids=None):
    messages = DirectMessage.objects.filter(
        sender=sender, recipient=recipient, is_read=False
    )
    if message_ids is not None:
        messages = messages.filter(pk__in=message_ids)
    return messages.update(is_read=True)
