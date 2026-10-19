import os
import uuid
from django.db import models
from django.conf import settings


# ✅ MUST BE HERE FIRST
def user_media_path(instance, filename):
    # Historical migrations import this path; do not move or rename it.
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join(f"user_{instance.user.id}", filename)


# ✅ THEN your model
class Media(models.Model):
    CONTENT_TYPE = (
        ('post', 'Post'),
        ('news', 'News article'),
    )
    MEDIA_TYPE = (
        ('image', 'Image'),
        ('video', 'Video'),
        ('text', 'Text'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='media'
    )

    title = models.CharField(blank=True, max_length=300)
    content_type = models.CharField(
        choices=CONTENT_TYPE,
        default='post',
        max_length=10,
    )
    file = models.FileField(upload_to=user_media_path, null=True, blank=True)
    caption = models.TextField(blank=True, max_length=10000)
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['-uploaded_at', '-id'], name='media_feed_time_idx'),
            models.Index(fields=['user', '-uploaded_at', '-id'], name='media_author_time_idx'),
        ]

    def save(self, *args, **kwargs):
        if self.file:
            self.file_size = self.file.size

            name = self.file.name.lower()
            if name.endswith(('.jpg', '.jpeg', '.png', '.gif')):
                self.media_type = 'image'
            elif name.endswith(('.mp4', '.mov', '.avi', '.mkv')):
                self.media_type = 'video'
        elif self.caption:
            self.file_size = None
            self.media_type = 'text'

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.media_type}"

class Like(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name='likes')

    class Meta:
        unique_together = ('user', 'media')


class Comment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name='comments')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class MediaView(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name='view')

    view_count = models.PositiveIntegerField(default=0)
    total_watch_time = models.FloatField(default=0)
    last_watch_time = models.FloatField(default=0)

    clicked = models.BooleanField(default=False)
    liked = models.BooleanField(default=False)
    commented = models.BooleanField(default=False)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['user', 'media', '-updated_at', '-id'],
                name='engagement_lookup_idx',
            ),
        ]
