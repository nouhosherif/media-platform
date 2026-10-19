"""Read queries for posts, news, feeds, and their social interactions."""

from django.db.models import Count, FloatField, IntegerField, OuterRef, Prefetch, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from apps.users.models import Follow

from .models import Comment, Like, Media, MediaView


EXPLORE_ORDERING = (
    '-likes_total', '-comments_total', '-views_total', '-watch_total',
    '-uploaded_at', '-id',
)


def _total(model, expression, output_field):
    # Separate correlated aggregates avoid multiplying sums across reverse joins.
    totals = (
        model.objects.filter(media_id=OuterRef('pk')).order_by()
        .values('media_id').annotate(total=expression).values('total')
    )
    return Coalesce(
        Subquery(totals, output_field=output_field),
        Value(0, output_field=output_field),
    )


def media_for_display(queryset=None):
    """Two queries per nonempty page, including every legacy nested comment."""
    if queryset is None:
        queryset = Media.objects.all()
    return queryset.select_related('user').annotate(
        likes_total=_total(Like, Count('pk'), IntegerField()),
    ).prefetch_related(
        Prefetch('comments', queryset=Comment.objects.select_related('user').order_by('id')),
    )


def chronological_feed(*, user=None):
    queryset = Media.objects.all()
    if user is not None:
        queryset = queryset.filter(user=user)
    return media_for_display(queryset).order_by('-uploaded_at', '-id')


def following_feed(*, user, fallback=False):
    following_ids = Follow.objects.filter(follower=user).values('following_id')
    queryset = Media.objects.filter(user_id__in=following_ids)
    if fallback and not queryset.exists():
        queryset = Media.objects.all()
    return media_for_display(queryset).order_by('-uploaded_at', '-id')


def explore_feed():
    return media_for_display().annotate(
        comments_total=_total(Comment, Count('pk'), IntegerField()),
        views_total=_total(MediaView, Sum('view_count'), IntegerField()),
        watch_total=_total(MediaView, Sum('total_watch_time'), FloatField()),
    ).order_by(*EXPLORE_ORDERING)
