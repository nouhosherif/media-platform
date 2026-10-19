import os
from pathlib import Path
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from core.settings.environment import database_settings


class DatabaseConfigurationTests(SimpleTestCase):
    def test_default_keeps_local_sqlite_path(self):
        base = Path(__file__).resolve().parents[2]
        with patch.dict(os.environ, {}, clear=True):
            config = database_settings(base)['default']
        self.assertEqual(config['NAME'], base / 'db.sqlite3')
        self.assertEqual(config['ENGINE'], 'django.db.backends.sqlite3')

    def test_postgresql_requires_explicit_credentials_and_secure_defaults(self):
        environment = {
            'DJANGO_DATABASE_ENGINE': 'postgresql', 'DJANGO_DB_NAME': 'test_db',
            'DJANGO_DB_USER': 'test_user', 'DJANGO_DB_PASSWORD': 'test-only-value',
            'DJANGO_DB_HOST': 'database.example.com',
        }
        with patch.dict(os.environ, environment, clear=True):
            config = database_settings(Path('.'))['default']
        self.assertEqual(config['ENGINE'], 'django.db.backends.postgresql')
        self.assertEqual(config['OPTIONS']['sslmode'], 'require')
        self.assertEqual(config['CONN_MAX_AGE'], 0)
        environment.pop('DJANGO_DB_PASSWORD')
        with patch.dict(os.environ, environment, clear=True):
            with self.assertRaisesMessage(ImproperlyConfigured, 'DJANGO_DB_PASSWORD'):
                database_settings(Path('.'))

    def test_unknown_backend_and_invalid_port_fail(self):
        for environment in ({'DJANGO_DATABASE_ENGINE': 'unknown'},
                            {'DJANGO_DATABASE_ENGINE': 'postgresql', 'DJANGO_DB_PORT': '70000'}):
            with patch.dict(os.environ, environment, clear=True):
                with self.assertRaises(ImproperlyConfigured):
                    database_settings(Path('.'))
