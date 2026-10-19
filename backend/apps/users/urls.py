from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CallSessionDetailView,
    CallSessionView,
    LoginView,
    FollowDirectoryView,
    MessageConversationView,
    MessageThreadView,
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationReadView,
    ProfilePhotoUploadView,
    ProfileView,
    PublicProfileView,
    RegisterView,
    ToggleFollowView,
    UserSearchView,
)

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view(), name="login"),
    path('token/refresh/', TokenRefreshView.as_view(), name="token_refresh"),
    path('profile/', ProfileView.as_view()),
    path('profile/<int:user_id>/', PublicProfileView.as_view(), name="public_profile"),
    path('profile/photo/', ProfilePhotoUploadView.as_view(), name="profile_photo"),
    path('search/', UserSearchView.as_view(), name="user_search"),
    path('follows/', FollowDirectoryView.as_view(), name="follows"),
    path('messages/', MessageThreadView.as_view(), name="messages"),
    path('messages/<int:user_id>/', MessageConversationView.as_view(), name="conversation"),
    path('calls/', CallSessionView.as_view(), name="calls"),
    path('calls/<int:call_id>/', CallSessionDetailView.as_view(), name="call_detail"),
    path('notifications/', NotificationListView.as_view(), name="notifications"),
    path('notifications/mark-all-read/', NotificationMarkAllReadView.as_view(), name="notifications_mark_all_read"),
    path('notifications/<int:notification_id>/read/', NotificationReadView.as_view(), name="notification_read"),
    path('follow/<int:user_id>/', ToggleFollowView.as_view()),
]
