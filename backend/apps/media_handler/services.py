"""Transactional content writes, independent of HTTP request/response objects."""

import logging
import math

from django.db import transaction
from django.db.models import F

from .models import Comment, Like, Media, MediaView


logger = logging.getLogger(__name__)


def create_media_batch(*, user, validated_items):
    """Roll back rows and clean only files written by this failed batch.

    Storage is not transactional. Keep references before save so a file written
    immediately before an insert failure is also eligible for cleanup.
    """
    items = []
    pending_files = []
    try:
        with transaction.atomic():
            for attributes in validated_items:
                item = Media(user=user, **attributes)
                items.append(item)
                if item.file and not item.file._committed:
                    pending_files.append(item)
                item.save()
    except Exception:
        for item in pending_files:
            if item.file and item.file._committed:
                try:
                    item.file.storage.delete(item.file.name)
                except Exception:
                    logger.exception('Failed to clean a file from a rolled-back upload batch')
        raise
    return items


def get_or_create_engagement(user, media):
    # Historical duplicates are preserved; consistently update the latest row.
    engagement = (
        MediaView.objects.filter(user=user, media=media)
        .order_by('-updated_at', '-id').first()
    )
    return engagement or MediaView.objects.create(user=user, media=media)


def _lock_media(media):
    # Serializes creation/toggling on databases with row locks. F expressions
    # also prevent lost counter increments. SQLite uses write locks.
    Media.objects.select_for_update().get(pk=media.pk)


@transaction.atomic
def toggle_like(*, user, media):
    _lock_media(media)
    like, created = Like.objects.get_or_create(user=user, media=media)
    if not created:
        like.delete()
    engagement = get_or_create_engagement(user, media)
    engagement.liked = created
    engagement.save(update_fields=['liked', 'updated_at'])
    return created


@transaction.atomic
def add_comment(*, user, media, text):
    _lock_media(media)
    comment = Comment.objects.create(user=user, media=media, text=text)
    engagement = get_or_create_engagement(user, media)
    engagement.commented = True
    engagement.save(update_fields=['commented', 'updated_at'])
    return comment


def nonnegative_duration(value):
    try:
        duration = float(value or 0)
    except (TypeError, ValueError, OverflowError):
        return 0
    return max(duration, 0) if math.isfinite(duration) else 0


@transaction.atomic
def record_engagement(*, user, media, viewed=False, watch_time=None, clicked=False):
    _lock_media(media)
    engagement = get_or_create_engagement(user, media)
    fields = ['updated_at']
    if viewed:
        engagement.view_count = F('view_count') + 1
        fields.append('view_count')
    if watch_time is not None:
        duration = nonnegative_duration(watch_time)
        engagement.total_watch_time = F('total_watch_time') + duration
        engagement.last_watch_time = duration
        fields.extend(['total_watch_time', 'last_watch_time'])
    if clicked:
        engagement.clicked = True
        fields.append('clicked')
    engagement.save(update_fields=fields)


def delete_media(*, media):
    # Preserve existing semantics: rows/cascades are deleted, storage objects
    # retained. Retention/garbage collection needs a separately reviewed policy.
    media.delete()
