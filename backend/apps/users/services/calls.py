from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from ..models import CallSession, Notification
from ..selectors.messages import get_call
from ..selectors.profiles import get_profile
from .errors import invalid
from .notifications import create_notification


@transaction.atomic
def start_call(*, caller, recipient_id, call_type=CallSession.AUDIO, offer=None):
    if not recipient_id:
        invalid("Recipient is required")
    if call_type not in [CallSession.AUDIO, CallSession.VIDEO]:
        invalid("Call type must be audio or video")
    try:
        recipient_id = int(recipient_id)
    except (TypeError, ValueError):
        invalid("Recipient must be a user ID")
    recipient = get_profile(recipient_id)
    if recipient.pk == caller.pk:
        invalid("You cannot call yourself")
    call = CallSession.objects.create(
        caller=caller, recipient=recipient, call_type=call_type, offer=offer,
    )
    create_notification(
        recipient=recipient, actor=caller, notification_type=Notification.CALL,
        message=f"{caller.username} started a {call_type} call",
        target_url=f"/messages?user={caller.pk}",
    )
    return call


@transaction.atomic
def update_call(*, user, call_id, data):
    call = get_call(user=user, call_id=call_id, for_update=True)
    action = data.get('action')
    if action == 'accept':
        if user.pk != call.recipient_id:
            raise PermissionDenied({'error': "Only the recipient can accept this call"})
        call.status = CallSession.ACCEPTED
        call.answered_at = timezone.now()
        if 'answer' in data:
            call.answer = data.get('answer')
        call.save(update_fields=['status', 'answered_at', 'answer'])
    elif action in ['decline', 'end', 'cancel', 'missed']:
        call.status = {
            'decline': CallSession.DECLINED, 'end': CallSession.ENDED,
            'cancel': CallSession.CANCELED, 'missed': CallSession.MISSED,
        }[action]
        call.ended_at = timezone.now()
        call.save(update_fields=['status', 'ended_at'])
    elif action == 'signal':
        fields = []
        if 'offer' in data:
            call.offer = data.get('offer')
            fields.append('offer')
        if 'answer' in data:
            call.answer = data.get('answer')
            fields.append('answer')
            if call.status == CallSession.RINGING:
                call.status = CallSession.ACCEPTED
                call.answered_at = timezone.now()
                fields.extend(['status', 'answered_at'])
        if 'ice_candidate' in data:
            if user.pk == call.caller_id:
                call.caller_ice = [*call.caller_ice, data.get('ice_candidate')]
                fields.append('caller_ice')
            else:
                call.recipient_ice = [*call.recipient_ice, data.get('ice_candidate')]
                fields.append('recipient_ice')
        if fields:
            call.save(update_fields=list(dict.fromkeys(fields)))
    else:
        invalid("Unknown call action")
    return call
