from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..selectors.notifications import get_notifications, notification_counts
from ..serializers import NotificationSerializer
from ..services.notifications import mark_all_notifications_read, mark_notification_read
from ._pagination import optional_page
from ._serialization import participant_context


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications, page = optional_page(get_notifications(user=request.user), request)
        return Response({
            **notification_counts(user=request.user),
            'results': NotificationSerializer(
                notifications, many=True,
                context=participant_context(request, notifications, ('actor',)),
            ).data,
            **page,
        })


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        notification = mark_notification_read(
            user=request.user, notification_id=notification_id
        )
        return Response(NotificationSerializer(
            notification, context=participant_context(request, [notification], ('actor',))
        ).data)


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        mark_all_notifications_read(user=request.user)
        return Response({'message': "Notifications marked as read"})
