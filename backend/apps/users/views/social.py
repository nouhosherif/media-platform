from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..selectors.profiles import follow_directory, user_summary_context
from ..serializers import BasicUserSerializer
from ..services.social import toggle_follow
from ._pagination import optional_page


class FollowDirectoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tab = request.query_params.get('tab', 'discover')
        users, page = optional_page(follow_directory(
            viewer=request.user, tab=tab, query=request.query_params.get('q', '').strip()
        ), request, legacy_limit=50)
        context = user_summary_context(request, [request.user, *users])
        summary = context['user_summaries'][request.user.pk]
        return Response({
            'tab': tab,
            'results': BasicUserSerializer(users, many=True, context=context).data,
            'followers_count': summary['followers_count'],
            'following_count': summary['following_count'],
            **page,
        })


class ToggleFollowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        return Response(toggle_follow(user=request.user, target_id=user_id))
