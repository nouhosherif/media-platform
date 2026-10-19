from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import DestroyAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User

from . import selectors, services
from .models import Media
from .pagination import ExplorePagination, FeedPagination
from .serializers import CommentSerializer, MediaSerializer, validated_upload_items

# Compatibility for any internal import of the historical helper.
get_or_create_engagement = services.get_or_create_engagement


def request_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    return bool(value)


class UploadMediaView(APIView):
    permission_classes = [IsAuthenticated]
    max_batch_size = 10

    def post(self, request):
        context = {'request': request}
        items = validated_upload_items(
            data=request.data,
            files=request.FILES.getlist('files') or request.FILES.getlist('file'),
            context=context,
            max_batch_size=self.max_batch_size,
        )
        media_items = services.create_media_batch(user=request.user, validated_items=items)
        response_data = MediaSerializer(media_items, many=True, context=context).data
        if len(response_data) == 1:
            return Response(response_data[0], status=status.HTTP_201_CREATED)
        return Response(
            {'count': len(response_data), 'results': response_data},
            status=status.HTTP_201_CREATED,
        )


class FeedView(ListAPIView):
    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = FeedPagination

    def get_queryset(self):
        return selectors.chronological_feed()


class UserMediaListView(FeedView):
    def get_queryset(self):
        return selectors.chronological_feed(user=self.request.user)


class PublicUserMediaListView(FeedView):
    def get_queryset(self):
        user = get_object_or_404(User, id=self.kwargs['user_id'])
        return selectors.chronological_feed(user=user)


class DeleteMediaView(DestroyAPIView):
    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Media.objects.filter(user=self.request.user)

    def perform_destroy(self, instance):
        services.delete_media(media=instance)


class ToggleLikeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = get_object_or_404(Media, id=media_id)
        liked = services.toggle_like(user=request.user, media=media)
        return Response({'message': 'Liked' if liked else 'Unliked'})


class AddCommentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = get_object_or_404(Media, id=media_id)
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'error': 'Comment cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)
        comment = services.add_comment(user=request.user, media=media, text=text)
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class FollowingFeedView(FeedView):
    def get_queryset(self):
        return selectors.following_feed(user=self.request.user)


class PersonalizedFeedView(FeedView):
    def get_queryset(self):
        return selectors.following_feed(user=self.request.user, fallback=True)


class ExploreView(FeedView):
    pagination_class = ExplorePagination

    def get_queryset(self):
        return selectors.explore_feed()


class TrackEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = get_object_or_404(Media, id=media_id)
        services.record_engagement(
            user=request.user, media=media, viewed=True,
            watch_time=request.data.get('watch_time', 0) or 0,
            clicked=request_bool(request.data.get('clicked', False)),
        )
        return Response({'status': 'tracked'})


class LikeView(ToggleLikeView):
    pass


class TrackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = get_object_or_404(Media, id=media_id)
        services.record_engagement(user=request.user, media=media, viewed=True)
        return Response({'message': 'View recorded'})


class WatchTimeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = get_object_or_404(Media, id=media_id)
        services.record_engagement(
            user=request.user, media=media, watch_time=request.data.get('watch_time', 0) or 0,
        )
        return Response({'message': 'Watch time recorded'})


class ClickView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = get_object_or_404(Media, id=media_id)
        services.record_engagement(user=request.user, media=media, clicked=True)
        return Response({'message': 'Click tracked'})
