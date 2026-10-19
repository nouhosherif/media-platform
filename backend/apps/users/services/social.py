from django.db import transaction

from ..models import Follow, Notification
from ..selectors.profiles import get_profile
from .errors import invalid
from .notifications import create_notification


@transaction.atomic
def toggle_follow(*, user, target_id):
    target = get_profile(target_id)
    if user.pk == target.pk:
        invalid("You cannot follow yourself")
    follow, created = Follow.objects.get_or_create(follower=user, following=target)
    if created:
        create_notification(
            recipient=target, actor=user, notification_type=Notification.FOLLOW,
            message=f"{user.username} followed you", target_url=f"/profile/{user.pk}",
        )
    else:
        follow.delete()
    return {
        'message': 'Followed' if created else 'Unfollowed',
        'is_following': created,
        'followers_count': target.followers.count(),
        'following_count': user.following.count(),
    }
