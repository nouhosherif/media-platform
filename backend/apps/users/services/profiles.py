from .errors import invalid


def update_profile_details(*, user, **changes):
    allowed_fields = {'first_name', 'last_name', 'bio', 'phone_number', 'location'}
    update_fields = []
    for field, value in changes.items():
        if field in allowed_fields:
            setattr(user, field, value)
            update_fields.append(field)
    if update_fields:
        user.save(update_fields=update_fields)
    return user


def update_profile_photo(*, user, profile_picture):
    if not profile_picture:
        invalid("No profile photo uploaded")
    if not (profile_picture.content_type or '').startswith('image/'):
        invalid("Profile photo must be an image")
    if profile_picture.size > 5 * 1024 * 1024:
        invalid("Profile photo too large (max 5MB)")
    user.profile_picture = profile_picture
    user.save(update_fields=['profile_picture'])
    return user
