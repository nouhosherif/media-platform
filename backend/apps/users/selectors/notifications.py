from django.db.models import Count, Q

from ..models import Notification


def get_notifications(*, user):
    return Notification.objects.filter(recipient=user).select_related(
        'actor'
    ).order_by('-created_at', '-id')


def notification_counts(*, user):
    return Notification.objects.filter(recipient=user).aggregate(
        total_count=Count('id'), unread_count=Count('id', filter=Q(is_read=False)),
    )
