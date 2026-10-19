from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import CallSession
from ..selectors.messages import get_call, get_calls
from ..serializers import CallSessionSerializer
from ..services.calls import start_call, update_call
from ._pagination import optional_page
from ._serialization import participant_context


class CallSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        calls, page = optional_page(get_calls(
            user=request.user, active_only=request.query_params.get('active') == '1'
        ), request, legacy_limit=20)
        data = CallSessionSerializer(
            calls, many=True, context=participant_context(request, calls, ('caller', 'recipient'))
        ).data
        return Response({'results': data, **page} if page else data)

    def post(self, request):
        call = start_call(
            caller=request.user, recipient_id=request.data.get('recipient_id'),
            call_type=request.data.get('call_type', CallSession.AUDIO),
            offer=request.data.get('offer'),
        )
        return Response(CallSessionSerializer(
            call, context=participant_context(request, [call], ('caller', 'recipient'))
        ).data, status=status.HTTP_201_CREATED)


class CallSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_call(self, request, call_id):
        return get_call(user=request.user, call_id=call_id)

    def get(self, request, call_id):
        call = self.get_call(request, call_id)
        return Response(CallSessionSerializer(
            call, context=participant_context(request, [call], ('caller', 'recipient'))
        ).data)

    def post(self, request, call_id):
        call = update_call(user=request.user, call_id=call_id, data=request.data)
        return Response(CallSessionSerializer(
            call, context=participant_context(request, [call], ('caller', 'recipient'))
        ).data)
