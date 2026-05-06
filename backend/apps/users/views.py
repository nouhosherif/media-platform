from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser

from .models import User
from .serializers import RegisterSerializer
from .models import Follow
from django.contrib.auth import get_user_model



#  Register View
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer


# ✅ Custom JWT Serializer
class CustomTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['username'] = self.user.username
        return data


# ✅ Login View
class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile_picture = None

        if user.profile_picture:
            profile_picture = request.build_absolute_uri(user.profile_picture.url)

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.get_full_name(),
            "bio": user.bio,
            "profile_picture": profile_picture,
            "posts_count": user.media.count(),
            "followers_count": user.followers.count(),
            "following_count": user.following.count(),
        })


class ProfilePhotoUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        profile_picture = request.FILES.get('profile_picture') or request.FILES.get('file')

        if not profile_picture:
            return Response({"error": "No profile photo uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        if not profile_picture.content_type.startswith('image/'):
            return Response({"error": "Profile photo must be an image"}, status=status.HTTP_400_BAD_REQUEST)

        max_size = 5 * 1024 * 1024
        if profile_picture.size > max_size:
            return Response({"error": "Profile photo too large (max 5MB)"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.profile_picture = profile_picture
        user.save(update_fields=['profile_picture'])

        return Response({
            "profile_picture": request.build_absolute_uri(user.profile_picture.url),
        })


class ToggleFollowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        target_user = User.objects.get(id=user_id)

        if request.user == target_user:
            return Response({"error": "You cannot follow yourself"}, status=400)

        follow, created = Follow.objects.get_or_create(
            follower=request.user,
            following=target_user
        )

        if not created:
            follow.delete()
            return Response({"message": "Unfollowed"})

        return Response({"message": "Followed"})  
