"""Configuration regression tests, independent of application data."""

import json
import os
import secrets
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from core.settings.environment import (
    env_bool,
    env_list,
    env_nonnegative_int,
    env_path,
    load_development_env,
    required_text,
)


class EnvironmentReaderTests(SimpleTestCase):
    def test_boolean_values_are_parsed_not_coerced_from_strings(self):
        for value in ('true', 'TRUE', '1', 'yes', 'on'):
            with self.subTest(value=value), patch.dict(os.environ, {'FLAG': value}):
                self.assertTrue(env_bool('FLAG'))
        for value in ('false', 'FALSE', '0', 'no', 'off'):
            with self.subTest(value=value), patch.dict(os.environ, {'FLAG': value}):
                self.assertFalse(env_bool('FLAG', True))

    def test_invalid_boolean_fails_without_echoing_value(self):
        with patch.dict(os.environ, {'FLAG': 'sensitive-invalid-value'}):
            with self.assertRaisesMessage(ImproperlyConfigured, 'FLAG must be a boolean') as error:
                env_bool('FLAG')
        self.assertNotIn('sensitive-invalid-value', str(error.exception))

    def test_required_value_rejects_missing_and_blank(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ImproperlyConfigured):
                required_text('REQUIRED')
        with patch.dict(os.environ, {'REQUIRED': '   '}):
            with self.assertRaises(ImproperlyConfigured):
                required_text('REQUIRED')

    def test_lists_trim_entries_and_preserve_explicit_empty(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(env_list('LIST', ('default',)), ['default'])
        with patch.dict(os.environ, {'LIST': ' first, , second '}):
            self.assertEqual(env_list('LIST'), ['first', 'second'])
        with patch.dict(os.environ, {'LIST': ''}):
            self.assertEqual(env_list('LIST', ('default',)), [])

    def test_nonnegative_integer_validation(self):
        with patch.dict(os.environ, {'SECONDS': '3600'}):
            self.assertEqual(env_nonnegative_int('SECONDS'), 3600)
        for value in ('-1', '1.5', 'invalid', ''):
            with self.subTest(value=value), patch.dict(os.environ, {'SECONDS': value}):
                with self.assertRaises(ImproperlyConfigured):
                    env_nonnegative_int('SECONDS')

    def test_relative_paths_are_anchored_to_backend(self):
        base = Path(__file__).resolve().parents[2]
        with patch.dict(os.environ, {'LOCATION': 'custom/media'}):
            self.assertEqual(env_path('LOCATION', 'fallback', base), base / 'custom/media')
        with patch.dict(os.environ, {'LOCATION': str(base / 'absolute')}):
            self.assertEqual(env_path('LOCATION', 'fallback', base), base / 'absolute')

    def test_env_file_is_literal_and_process_environment_wins(self):
        with TemporaryDirectory() as directory, patch.dict(os.environ, {'EXISTING': 'process'}, clear=True):
            path = Path(directory) / '.env'
            path.write_text(
                '# comment\nEXISTING=file\nQUOTED="literal # $VALUE"\n'
                "SINGLE='text with spaces'\nEMPTY=\nHASH=abc#def\n",
                encoding='utf-8',
            )
            load_development_env(path)
            self.assertEqual(os.environ['EXISTING'], 'process')
            self.assertEqual(os.environ['QUOTED'], 'literal # $VALUE')
            self.assertEqual(os.environ['SINGLE'], 'text with spaces')
            self.assertEqual(os.environ['EMPTY'], '')
            self.assertEqual(os.environ['HASH'], 'abc#def')

    def test_missing_env_file_is_optional(self):
        with TemporaryDirectory() as directory:
            load_development_env(Path(directory) / '.env')

    def test_malformed_files_fail_without_printing_contents(self):
        for content in ('bad line', 'KEY="unclosed', 'KEY=one\nKEY=two',
                        'DJANGO_SETTINGS_MODULE=core.settings.production'):
            with self.subTest(content=content), TemporaryDirectory() as directory:
                path = Path(directory) / '.env'
                path.write_text(content, encoding='utf-8')
                with patch.dict(os.environ, {}, clear=True):
                    with self.assertRaises(ImproperlyConfigured):
                        load_development_env(path)


class SettingsProfileTests(SimpleTestCase):
    """Fresh interpreters prevent module/env caching from hiding profile leaks."""

    backend_dir = Path(__file__).resolve().parents[2]
    snapshot_code = '''
import json
from django.conf import settings as s
print(json.dumps({
    'base_dir': str(s.BASE_DIR),
    'database': str(s.DATABASES['default']['NAME']),
    'engine': s.DATABASES['default']['ENGINE'],
    'media': str(s.MEDIA_ROOT),
    'static': str(s.STATIC_ROOT),
    'debug': s.DEBUG,
    'hosts': s.ALLOWED_HOSTS,
    'cors_all': s.CORS_ALLOW_ALL_ORIGINS,
    'cors': s.CORS_ALLOWED_ORIGINS,
    'csrf': s.CSRF_TRUSTED_ORIGINS,
    'secure_session': s.SESSION_COOKIE_SECURE,
    'secure_csrf': s.CSRF_COOKIE_SECURE,
    'redirect': s.SECURE_SSL_REDIRECT,
    'proxy': s.SECURE_PROXY_SSL_HEADER,
    'hsts': s.SECURE_HSTS_SECONDS,
    'storage': s.STORAGES['default']['BACKEND'],
    'access_seconds': s.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
    'refresh_seconds': s.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
    'auth_model': s.AUTH_USER_MODEL,
    'page_size': s.REST_FRAMEWORK['PAGE_SIZE'],
}))
'''

    def run_profile(self, profile, overrides=None, forbid_env_file=False):
        environment = {key: value for key, value in os.environ.items()
                       if not key.startswith('DJANGO_')}
        environment.update({
            'DJANGO_SETTINGS_MODULE': profile,
            'DJANGO_SECRET_KEY': secrets.token_urlsafe(64),
            'DJANGO_ALLOWED_HOSTS': 'api.example.com',
        })
        for key, value in (overrides or {}).items():
            if value is None:
                environment.pop(key, None)
            else:
                environment[key] = value
        code = self.snapshot_code
        if forbid_env_file:
            code = ("from unittest.mock import patch\n"
                    "guard = patch('core.settings.environment.load_development_env', "
                    "side_effect=AssertionError('local environment was loaded'))\n"
                    "guard.start()\n") + code
        return subprocess.run(
            [sys.executable, '-B', '-c', code], cwd=self.backend_dir,
            env=environment, capture_output=True, text=True, timeout=30,
        )

    def successful_profile(self, *args, **kwargs):
        result = self.run_profile(*args, **kwargs)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_development_preserves_paths_authentication_and_pagination(self):
        config = self.successful_profile('core.settings.development', {
            'DJANGO_DEBUG': 'true', 'DJANGO_CORS_ALLOW_ALL_ORIGINS': 'false',
            'DJANGO_SQLITE_PATH': 'db.sqlite3', 'DJANGO_MEDIA_ROOT': 'media',
            'DJANGO_STATIC_ROOT': 'staticfiles',
        })
        self.assertEqual(config['base_dir'], str(self.backend_dir))
        self.assertEqual(config['database'], str(self.backend_dir / 'db.sqlite3'))
        self.assertEqual(config['media'], str(self.backend_dir / 'media'))
        self.assertEqual(config['static'], str(self.backend_dir / 'staticfiles'))
        self.assertEqual(config['engine'], 'django.db.backends.sqlite3')
        self.assertTrue(config['debug'])
        self.assertFalse(config['cors_all'])
        self.assertEqual(config['access_seconds'], 900)
        self.assertEqual(config['refresh_seconds'], 86400)
        self.assertEqual(config['auth_model'], 'users.User')
        self.assertEqual(config['page_size'], 10)

    def test_legacy_settings_module_remains_compatible(self):
        options = {'DJANGO_DEBUG': 'false', 'DJANGO_CORS_ALLOW_ALL_ORIGINS': 'false'}
        self.assertEqual(
            self.successful_profile('core.settings', options),
            self.successful_profile('core.settings.development', options),
        )

    def test_development_does_not_replace_an_explicit_blank_key(self):
        result = self.run_profile('core.settings.development', {'DJANGO_SECRET_KEY': ''})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DJANGO_SECRET_KEY must be set', result.stderr)

    def test_test_profile_is_isolated_and_ignores_local_env(self):
        config = self.successful_profile('core.settings.test', {
            'DJANGO_SECRET_KEY': None, 'DJANGO_DEBUG': 'true',
            'DJANGO_SQLITE_PATH': 'must-not-use.sqlite3',
        }, forbid_env_file=True)
        self.assertEqual(config['database'], ':memory:')
        self.assertEqual(config['storage'], 'django.core.files.storage.InMemoryStorage')
        self.assertFalse(config['debug'])
        self.assertFalse(config['cors_all'])

    def test_production_is_secure_and_ignores_local_env(self):
        config = self.successful_profile('core.settings.production', forbid_env_file=True)
        self.assertFalse(config['debug'])
        self.assertFalse(config['cors_all'])
        self.assertEqual(config['hosts'], ['api.example.com'])
        self.assertEqual(config['cors'], [])
        self.assertEqual(config['csrf'], [])
        self.assertTrue(config['secure_session'])
        self.assertTrue(config['secure_csrf'])
        self.assertTrue(config['redirect'])
        self.assertIsNone(config['proxy'])
        self.assertEqual(config['hsts'], 0)

    def test_production_requires_independent_secret(self):
        for value in (None, '', 'short', 'x' * 64, 'django-insecure-' + 'abcde' * 15):
            with self.subTest(value=value):
                result = self.run_profile('core.settings.production', {'DJANGO_SECRET_KEY': value})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('DJANGO_SECRET_KEY', result.stderr)

    def test_production_requires_explicit_hosts(self):
        for value in (None, '', '*', 'api.example.com,*'):
            with self.subTest(value=value):
                result = self.run_profile('core.settings.production', {'DJANGO_ALLOWED_HOSTS': value})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('DJANGO_ALLOWED_HOSTS', result.stderr)

    def test_production_rejects_debug_and_open_cors(self):
        for name in ('DJANGO_DEBUG', 'DJANGO_CORS_ALLOW_ALL_ORIGINS'):
            with self.subTest(name=name):
                result = self.run_profile('core.settings.production', {name: 'true'})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(name, result.stderr)

    def test_production_rejects_wildcard_origins(self):
        for name in ('DJANGO_CORS_ALLOWED_ORIGINS', 'DJANGO_CSRF_TRUSTED_ORIGINS'):
            with self.subTest(name=name):
                result = self.run_profile('core.settings.production', {name: 'https://*.example.com'})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('without wildcards', result.stderr)

    def test_production_proxy_trust_and_hsts_require_explicit_configuration(self):
        config = self.successful_profile('core.settings.production', {
            'DJANGO_TRUST_PROXY_HTTPS': 'true',
            'DJANGO_SECURE_HSTS_SECONDS': '3600',
            'DJANGO_CORS_ALLOWED_ORIGINS': 'https://web.example.com',
            'DJANGO_CSRF_TRUSTED_ORIGINS': 'https://web.example.com',
        })
        self.assertEqual(config['proxy'], ['HTTP_X_FORWARDED_PROTO', 'https'])
        self.assertEqual(config['hsts'], 3600)
        self.assertEqual(config['cors'], ['https://web.example.com'])
        self.assertEqual(config['csrf'], ['https://web.example.com'])
