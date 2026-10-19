from django.apps import apps
from django.db.models import Count, Exists, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404

from ..models import Follow, User


def find_login_user(identifier):
    return User.objects.filter(
        Q(username__iexact=identifier) | Q(email__iexact=identifier)
    ).only('username').first()


def get_profile(user_id):
    return get_object_or_404(User, pk=user_id)


def search_users(*, viewer, query=''):
    users = User.objects.exclude(pk=viewer.pk)
    return _search_names(users, query).order_by('username', 'id')


def follow_directory(*, viewer, tab='discover', query=''):
    if tab == 'followers':
        users = User.objects.filter(following__following=viewer)
    elif tab == 'following':
        users = User.objects.filter(followers__follower=viewer)
    else:
        users = User.objects.exclude(pk=viewer.pk)
    return _search_names(users, query).distinct().order_by('username', 'id')


def _search_names(users, query):
    if not query:
        return users
    return users.filter(
        Q(username__icontains=query)
        | Q(first_name__icontains=query)
        | Q(last_name__icontains=query)
    )


def get_user_summaries(user_ids, viewer=None):
    """One query per batch; independent subqueries avoid multiplied join counts."""
    user_ids = {user_id for user_id in user_ids if user_id is not None}
    if not user_ids:
        return {}

    media = apps.get_model('media_handler', 'Media')
    like = apps.get_model('media_handler', 'Like')

    def count(queryset, group):
        return Coalesce(Subquery(
            queryset.order_by().values(group).annotate(total=Count('pk')).values('total')
        ), Value(0))

    is_following = Value(False)
    if viewer is not None and viewer.is_authenticated:
        is_following = Exists(Follow.objects.filter(
            follower_id=viewer.pk, following_id=OuterRef('pk')
        ))
    rows = User.objects.filter(pk__in=user_ids).annotate(
        posts_count=count(media.objects.filter(user_id=OuterRef('pk')), 'user_id'),
        likes_count=count(like.objects.filter(media__user_id=OuterRef('pk')), 'media__user_id'),
        followers_count=count(
            Follow.objects.filter(following_id=OuterRef('pk')), 'following_id'
        ),
        following_count=count(
            Follow.objects.filter(follower_id=OuterRef('pk')), 'follower_id'
        ),
        is_following=is_following,
    ).values('id', 'posts_count', 'likes_count', 'followers_count', 'following_count', 'is_following')
    return {row['id']: row for row in rows}


def user_summary_context(request, users):
    """Use for nested/list serializers to avoid a query for each participant."""
    return {
        'request': request,
        'user_summaries': get_user_summaries(
            (user.pk for user in users if user is not None), request.user
        ),
    }
