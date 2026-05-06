from django.urls import path
from .views import UploadMediaView, UserMediaListView, DeleteMediaView
from .views import FeedView, ToggleLikeView, AddCommentView,PersonalizedFeedView
from .views import LikeView, TrackView, WatchTimeView, ClickView

urlpatterns = [
    path('upload/', UploadMediaView.as_view()),
    path('my-media/', UserMediaListView.as_view()),  # ✅ correct name
    path('delete/<int:pk>/', DeleteMediaView.as_view()),
    path('feed/', FeedView.as_view()),
    path('like/<int:media_id>/', ToggleLikeView.as_view()),
    path('comment/<int:media_id>/', AddCommentView.as_view()),
    path('feed/', PersonalizedFeedView.as_view()),
    path('like/<int:media_id>/', LikeView.as_view()),
    path('view/<int:media_id>/', TrackView.as_view()),
    path('watch/<int:media_id>/', WatchTimeView.as_view()),
    path('click/<int:media_id>/', ClickView.as_view()),
]
