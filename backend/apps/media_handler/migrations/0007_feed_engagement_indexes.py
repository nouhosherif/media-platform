from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('media_handler', '0006_media_content_type_media_title_alter_media_caption'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='media',
            index=models.Index(fields=['-uploaded_at', '-id'], name='media_feed_time_idx'),
        ),
        migrations.AddIndex(
            model_name='media',
            index=models.Index(fields=['user', '-uploaded_at', '-id'], name='media_author_time_idx'),
        ),
        migrations.AddIndex(
            model_name='mediaview',
            index=models.Index(fields=['user', 'media', '-updated_at', '-id'], name='engagement_lookup_idx'),
        ),
    ]
