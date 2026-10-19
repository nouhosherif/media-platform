from django.urls import path

from .views import (
    AddCommentView,
    ClickView,
    DeleteMediaView,
    ExploreView,
    FeedView,
    FollowingFeedView,
    LikeView,
    PersonalizedFeedView,
    PublicUserMediaListView,
    ToggleLikeView,
    TrackEngagementView,
    TrackView,
    UploadMediaView,
    UserMediaListView,
    WatchTimeView,
)

urlpatterns = [
    path('upload/', UploadMediaView.as_view()),
    path('my-media/', UserMediaListView.as_view()),
    path('user/<int:user_id>/', PublicUserMediaListView.as_view()),
    path('delete/<int:pk>/', DeleteMediaView.as_view()),
    path('feed/', FeedView.as_view()),
    path('following/', FollowingFeedView.as_view()),
    path('personalized/', PersonalizedFeedView.as_view()),
    path('explore/', ExploreView.as_view()),
    path('like/<int:media_id>/', ToggleLikeView.as_view()),
    path('comment/<int:media_id>/', AddCommentView.as_view()),
    path('engagement/<int:media_id>/', TrackEngagementView.as_view()),
    path('like-signal/<int:media_id>/', LikeView.as_view()),
    path('view/<int:media_id>/', TrackView.as_view()),
    path('watch/<int:media_id>/', WatchTimeView.as_view()),
    path('click/<int:media_id>/', ClickView.as_view()),
]
