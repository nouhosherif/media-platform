from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.generics import ListAPIView, DestroyAPIView
from rest_framework import generics

from .models import Media
from django.db.models import Count, Sum
from .serializers import MediaSerializer
from .models import Media, Like, Comment
from .serializers import MediaSerializer, CommentSerializer
from apps.users.models import Follow
from django.db.models import Count, F,FloatField, ExpressionWrapper
from django.utils.timezone import now
from .pagination import FeedPagination
from .models import MediaView





#  Upload
class UploadMediaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get('file')

        if not file:
            return Response({"error": "No file uploaded"}, status=400)

        if file.content_type.startswith('image'):
            media_type = 'image'
        elif file.content_type.startswith('video'):
            media_type = 'video'
        else:
            return Response({"error": "Unsupported file type"}, status=400)

        media = Media.objects.create(
            user=request.user,
            file=file,
            media_type=media_type
        )

        serializer = MediaSerializer(media, context={'request': request})
        return Response(serializer.data, status=201)


#  List user media
class UserMediaListView(ListAPIView):
    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = FeedPagination

    def get_queryset(self):
        return Media.objects.filter(user=self.request.user).order_by('-uploaded_at')


#  Delete media
class DeleteMediaView(DestroyAPIView):
    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Media.objects.filter(user=self.request.user)

    # FEED (Instagram Home)
class FeedView(ListAPIView):
    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = FeedPagination

    def get_queryset(self):
        return Media.objects.all().order_by('-uploaded_at')


#  LIKE / UNLIKE
class ToggleLikeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = Media.objects.get(id=media_id)
        like, created = Like.objects.get_or_create(user=request.user, media=media)

        if not created:
            like.delete()
            return Response({"message": "Unliked"})

        return Response({"message": "Liked"})


# 💬 ADD COMMENT
class AddCommentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = Media.objects.get(id=media_id)
        text = request.data.get('text')

        if not text:
            return Response({"error": "Comment cannot be empty"}, status=400)

        comment = Comment.objects.create(
            user=request.user,
            media=media,
            text=text
        )

        return Response(CommentSerializer(comment).data, status=201)
    
class FollowingFeedView(ListAPIView):

    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        following_ids = Follow.objects.filter(
            follower=self.request.user
        ).values_list('following_id', flat=True)

        return Media.objects.filter(
            user__id__in=following_ids
        ).order_by('-uploaded_at')
    
class PersonalizedFeedView(ListAPIView):
    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        following_ids = Follow.objects.filter(
            follower=self.request.user
        ).values_list('following_id', flat=True)

        queryset = Media.objects.filter(
            user__id__in=following_ids
        ).annotate(
            likes_count=Count('likes'),
            comments_count=Count('comments')
        )

        # Simple ranking formula
        # score = likes * 2 + comments * 3
        queryset = queryset.annotate(
            score=F('likes_count') * 2 + F('comments_count') * 3
        ).order_by('-score', '-uploaded_at')

        return queryset

class TrackEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = Media.objects.get(id=media_id)

        watch_time = float(request.data.get("watch_time", 0))
        clicked = request.data.get("clicked", False)

        engagement, _ = MediaView.objects.get_or_create(
            user=request.user,
            media=media
        )

        engagement.view_count += 1
        engagement.total_watch_time += watch_time
        engagement.last_watch_time = watch_time
        engagement.clicked = clicked or engagement.clicked
        engagement.save()

        # aggregate update (fast access)
        media.views_count += 1
        media.total_watch_time += watch_time
        if clicked:
            media.clicks_count += 1
        media.save()

        return Response({"status": "tracked"})

class PersonalizedFeedView(generics.ListAPIView):
    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = FeedPagination

    def get_queryset(self):
        user = self.request.user

        following_ids = Follow.objects.filter(
            follower=user
        ).values_list('following_id', flat=True)

        media = Media.objects.filter(user__id__in=following_ids)

        # ML ranking
        media = sorted(media, key=lambda m: predict_score(m), reverse=True)

        return media

class ExploreView(generics.ListAPIView):
    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = FeedPagination

    def get_queryset(self):
        # trending score formula
        hours_since_post = ExpressionWrapper(
            (now() - F('uploaded_at')) / 3600,
            output_field=FloatField()
        )

        return Media.objects.annotate(
            engagement_score=(
                F('views_count') * 0.3 +
                F('clicks_count') * 0.5 +
                F('total_watch_time') * 0.2
            ) / (hours_since_post + 1)
        ).order_by('-engagement_score')

class LikeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = Media.objects.get(id=media_id)

        like, created = Like.objects.get_or_create(
            user=request.user,
            media=media
        )

        if created:
            #  TRAIN MODEL (positive signal)
            update_model(media, label=1)

            return Response({"message": "Liked"})
        else:
            like.delete()

            #  NEGATIVE SIGNAL
            update_model(media, label=0)

            return Response({"message": "Unliked"})
class TrackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = Media.objects.get(id=media_id)

        MediaView.objects.create(
            user=request.user,
            media=media
        )

        #  light positive signal
        update_model(media, label=0.5)

        return Response({"message": "View recorded"})

class WatchTimeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = Media.objects.get(id=media_id)
        duration = float(request.data.get("watch_time", 0))

        if duration > 5:
            update_model(media, label=1)
        else:
            update_model(media, label=0)

        return Response({"message": "Watch time recorded"})

class ClickView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, media_id):
        media = Media.objects.get(id=media_id)

        update_model(media, label=0.7)

        return Response({"message": "Click tracked"})
