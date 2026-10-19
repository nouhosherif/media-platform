from django.db.models import Case, Count, F, Q, When, Window
from django.db.models.functions import RowNumber
from django.shortcuts import get_object_or_404

from ..models import CallSession, DirectMessage


def get_conversation(*, user, other_user):
    return DirectMessage.objects.filter(
        Q(sender=user, recipient=other_user) | Q(sender=other_user, recipient=user)
    ).select_related('sender', 'recipient').order_by('created_at', 'id')


def get_message_threads(*, user):
    """Return only the latest row per peer, rather than materializing all history."""
    return DirectMessage.objects.filter(
        Q(sender=user) | Q(recipient=user)
    ).annotate(
        peer_id=Case(When(sender=user, then=F('recipient_id')), default=F('sender_id')),
    ).annotate(
        thread_position=Window(
            expression=RowNumber(), partition_by=[F('peer_id')],
            order_by=[F('created_at').desc(), F('pk').desc()],
        ),
    ).filter(thread_position=1).select_related(
        'sender', 'recipient'
    ).order_by('-created_at', '-id')


def get_unread_counts(*, user, peer_ids):
    rows = DirectMessage.objects.filter(
        recipient=user, sender_id__in=peer_ids, is_read=False,
    ).order_by().values('sender_id').annotate(total=Count('pk'))
    return {row['sender_id']: row['total'] for row in rows}


def get_calls(*, user, active_only=False):
    calls = CallSession.objects.filter(
        Q(caller=user) | Q(recipient=user)
    ).select_related('caller', 'recipient').order_by('-created_at', '-id')
    if active_only:
        calls = calls.filter(status__in=[CallSession.RINGING, CallSession.ACCEPTED])
    return calls


def get_call(*, user, call_id, for_update=False):
    calls = get_calls(user=user)
    if for_update:
        calls = calls.select_for_update()
    return get_object_or_404(calls, pk=call_id)
