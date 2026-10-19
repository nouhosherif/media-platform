from common.files import file_url
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..selectors.profiles import get_profile, search_users, user_summary_context
from ..serializers import BasicUserSerializer, ProfileSerializer, ProfileUpdateSerializer, PublicProfileSerializer
from ..services.profiles import update_profile_details, update_profile_photo
from ._pagination import optional_page


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ProfileSerializer(
            request.user, context=user_summary_context(request, [request.user])
        ).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = update_profile_details(user=request.user, **serializer.validated_data)
        return Response(ProfileSerializer(
            user, context=user_summary_context(request, [user])
        ).data)


class PublicProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        user = get_profile(user_id)
        return Response(PublicProfileSerializer(
            user, context=user_summary_context(request, [user])
        ).data)


class ProfilePhotoUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = update_profile_photo(
            user=request.user,
            profile_picture=request.FILES.get('profile_picture') or request.FILES.get('file'),
        )
        return Response({'profile_picture': file_url(user.profile_picture, request)})


class UserSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users, page = optional_page(search_users(
            viewer=request.user, query=request.query_params.get('q', '').strip()
        ), request, legacy_limit=20)
        data = BasicUserSerializer(
            users, many=True, context=user_summary_context(request, users)
        ).data
        return Response({'results': data, **page} if page else data)
