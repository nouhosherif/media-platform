from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from ..models import User
from ..selectors.profiles import find_login_user
from ..services.auth import register_user


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'password',
            'first_name',
            'last_name',
        ]

    def validate_email(self, value):
        return value.strip().lower()

    def validate_username(self, value):
        return value.strip().lower()

    def validate(self, attrs):
        email = attrs['email']
        submitted_username = attrs.get('username')
        username = submitted_username or email
        errors = {}

        if User.objects.filter(email__iexact=email).exists():
            errors['email'] = [
                "An account with this email already exists. Please log in."
            ]

        if submitted_username and User.objects.filter(username__iexact=username).exists():
            errors['username'] = ["A user with that username already exists."]
        elif (
            not submitted_username
            and 'email' not in errors
            and User.objects.filter(username__iexact=username).exists()
        ):
            errors['email'] = [
                "An account with this email already exists. Please log in."
            ]

        candidate_user = User(
            username=username,
            email=email,
            first_name=attrs.get('first_name', ''),
            last_name=attrs.get('last_name', ''),
        )

        try:
            validate_password(attrs['password'], user=candidate_user)
        except DjangoValidationError as error:
            errors['password'] = error.messages

        if errors:
            raise serializers.ValidationError(errors)

        attrs['username'] = username
        return attrs

    def create(self, validated_data):
        return register_user(validated_data)


class CustomTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        identifier = attrs.get(self.username_field, '').strip()
        user = find_login_user(identifier)
        if user:
            attrs[self.username_field] = user.get_username()
        data = super().validate(attrs)
        data['username'] = self.user.username
        return data
