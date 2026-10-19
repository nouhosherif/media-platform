from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from ..models import User


def register_user(validated_data):
    """Create an account atomically; retain field errors for concurrent collisions."""
    try:
        with transaction.atomic():
            return User.objects.create_user(**validated_data)
    except IntegrityError:
        errors = {}
        if User.objects.filter(email__iexact=validated_data['email']).exists():
            errors['email'] = [
                "An account with this email already exists. Please log in."
            ]
        if User.objects.filter(username__iexact=validated_data['username']).exists():
            errors['username'] = ["A user with that username already exists."]
        raise ValidationError(
            errors or {'non_field_errors': ["Unable to create this account."]}
        )
