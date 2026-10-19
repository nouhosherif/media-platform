from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('users', '0005_communication_query_indexes')]

    operations = [
        migrations.AddField(
            model_name='user',
            name='location',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='user',
            name='phone_number',
            field=models.CharField(blank=True, max_length=32),
        ),
    ]
