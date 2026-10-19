"""Additive indexes for existing polling/list access paths; no data changes."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('users', '0004_directmessage_message_type_and_more')]

    operations = [
        migrations.AddIndex(
            model_name='directmessage',
            index=models.Index(fields=['sender', 'recipient', 'created_at', 'id'], name='users_msg_pair_created'),
        ),
        migrations.AddIndex(
            model_name='directmessage',
            index=models.Index(fields=['recipient', 'is_read', 'sender'], name='users_msg_unread_sender'),
        ),
        migrations.AddIndex(
            model_name='callsession',
            index=models.Index(fields=['caller', 'status', '-created_at'], name='users_call_caller_state'),
        ),
        migrations.AddIndex(
            model_name='callsession',
            index=models.Index(fields=['recipient', 'status', '-created_at'], name='users_call_recipient_state'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['recipient', '-created_at', '-id'], name='users_note_created'),
        ),
    ]
