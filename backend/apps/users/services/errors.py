from rest_framework.exceptions import ValidationError


def invalid(message):
    """Preserve the existing single-string error response contract."""
    raise ValidationError({'error': message})
