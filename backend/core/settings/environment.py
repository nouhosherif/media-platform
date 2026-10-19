"""Small, dependency-free readers for backend configuration only."""

import os
import re
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured


def load_development_env(path):
    """Load literal KEY=value lines; the process environment always wins.

    Supports blank lines, whole-line comments, and matching outer quotes.
    No shell execution, interpolation, escapes, multiline or inline comments.
    Production and test settings never call this function.
    """
    if not path.is_file():
        return

    seen = set()
    for number, raw_line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
        name, separator, value = line.partition('=')
        name, value = name.strip(), value.strip()
        if (not separator or not re.fullmatch(r'[A-Z][A-Z0-9_]*', name)
                or name == 'DJANGO_SETTINGS_MODULE' or name in seen):
            raise ImproperlyConfigured(f'Invalid environment assignment on line {number} of {path.name}.')
        seen.add(name)
        if value.startswith(('"', "'")):
            if len(value) < 2 or value[-1] != value[0]:
                raise ImproperlyConfigured(f'Unclosed environment quote on line {number} of {path.name}.')
            value = value[1:-1]
        os.environ.setdefault(name, value)


def env_text(name, default=''):
    return os.environ.get(name, default).strip()


def required_text(name):
    value = env_text(name)
    if not value:
        raise ImproperlyConfigured(f'{name} must be set to a non-empty value.')
    return value


def env_bool(name, default=False):
    value = env_text(name, str(default)).lower()
    if value in {'true', '1', 'yes', 'on'}:
        return True
    if value in {'false', '0', 'no', 'off'}:
        return False
    raise ImproperlyConfigured(f'{name} must be a boolean (true/false).')


def env_list(name, default=()):
    if name not in os.environ:
        return list(default)
    return [item.strip() for item in os.environ[name].split(',') if item.strip()]


def env_nonnegative_int(name, default=0):
    try:
        value = int(env_text(name, str(default)))
    except ValueError:
        raise ImproperlyConfigured(f'{name} must be a non-negative integer.') from None
    if value < 0:
        raise ImproperlyConfigured(f'{name} must be a non-negative integer.')
    return value


def env_path(name, default, base_dir):
    value = env_text(name)
    path = Path(value).expanduser() if value else Path(default)
    return path if path.is_absolute() else base_dir / path


def database_settings(base_dir):
    engine = env_text('DJANGO_DATABASE_ENGINE', 'sqlite').lower()
    if engine == 'sqlite':
        return {'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': env_path('DJANGO_SQLITE_PATH', base_dir / 'db.sqlite3', base_dir),
        }}
    if engine != 'postgresql':
        raise ImproperlyConfigured('DJANGO_DATABASE_ENGINE must be sqlite or postgresql.')
    port = env_nonnegative_int('DJANGO_DB_PORT', 5432)
    if not 1 <= port <= 65535:
        raise ImproperlyConfigured('DJANGO_DB_PORT must be between 1 and 65535.')
    sslmode = env_text('DJANGO_DB_SSLMODE', 'require')
    if sslmode not in {'disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'}:
        raise ImproperlyConfigured('DJANGO_DB_SSLMODE is not supported.')
    return {'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': required_text('DJANGO_DB_NAME'),
        'USER': required_text('DJANGO_DB_USER'),
        'PASSWORD': required_text('DJANGO_DB_PASSWORD'),
        'HOST': required_text('DJANGO_DB_HOST'),
        'PORT': port,
        'CONN_MAX_AGE': env_nonnegative_int('DJANGO_DB_CONN_MAX_AGE', 0),
        'CONN_HEALTH_CHECKS': True,
        'OPTIONS': {'sslmode': sslmode, 'connect_timeout': 5},
    }}
