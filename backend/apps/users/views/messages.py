from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..selectors.messages import get_conversation, get_message_threads, get_unread_counts
from ..selectors.profiles import get_profile
from ..serializers import BasicUserSerializer, DirectMessageSerializer
from ..services.messages import mark_conversation_read, send_message
from ._pagination import optional_page
from ._serialization import participant_context


class MessageThreadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get(self, request):
        messages, page = optional_page(get_message_threads(user=request.user), request)
        context = participant_context(request, messages, ('sender', 'recipient'))
        peers = [
            message.recipient if message.sender_id == request.user.pk else message.sender
            for message in messages
        ]
        unread = get_unread_counts(user=request.user, peer_ids=[peer.pk for peer in peers])
        data = [{
            'user': BasicUserSerializer(peer, context=context).data,
            'last_message': DirectMessageSerializer(message, context=context).data,
            'unread_count': unread.get(peer.pk, 0),
        } for message, peer in zip(messages, peers)]
        return Response({'results': data, **page} if page else data)

    def post(self, request):
        message = send_message(
            sender=request.user, recipient_id=request.data.get('recipient_id'),
            text=request.data.get('text', ''),
            voice_file=request.FILES.get('voice_file') or request.FILES.get('voice') or request.FILES.get('file'),
            voice_duration=request.data.get('voice_duration'),
        )
        return Response(DirectMessageSerializer(
            message, context=participant_context(request, [message], ('sender', 'recipient'))
        ).data, status=status.HTTP_201_CREATED)


class MessageConversationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        other_user = get_profile(user_id)
        messages, page = optional_page(
            get_conversation(user=request.user, other_user=other_user), request
        )
        # Legacy callers mark the entire conversation read. Opt-in paged callers
        # acknowledge only messages actually returned, not unseen history.
        mark_conversation_read(
            recipient=request.user, sender=other_user,
            message_ids=[message.pk for message in messages] if page else None,
        )
        for message in messages:
            if message.recipient_id == request.user.pk:
                message.is_read = True
        context = participant_context(
            request, messages, ('sender', 'recipient'), extra_users=[other_user]
        )
        return Response({
            'user': BasicUserSerializer(other_user, context=context).data,
            'messages': DirectMessageSerializer(messages, many=True, context=context).data,
            **page,
        })
