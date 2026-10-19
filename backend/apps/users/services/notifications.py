from django.shortcuts import get_object_or_404

from ..models import Notification


def create_notification(*, recipient, actor, notification_type, message, target_url=''):
    """One local database record; no external delivery or synchronous fanout."""
    return Notification.objects.create(
        recipient=recipient, actor=actor, notification_type=notification_type,
        message=message, target_url=target_url,
    )


def mark_notification_read(*, user, notification_id):
    notification = get_object_or_404(
        Notification.objects.select_related('actor'),
        pk=notification_id, recipient=user,
    )
    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=['is_read'])
    return notification


def mark_all_notifications_read(*, user):
    return Notification.objects.filter(recipient=user, is_read=False).update(is_read=True)
