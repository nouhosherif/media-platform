"""Local development; load backend/.env without overriding exported values."""

from pathlib import Path

from .environment import database_settings, env_bool, env_list, load_development_env, required_text

load_development_env(Path(__file__).resolve().parents[2] / '.env')

from .base import *  # noqa: E402,F403

SECRET_KEY = required_text('DJANGO_SECRET_KEY')
DATABASES = database_settings(BASE_DIR)
DEBUG = env_bool('DJANGO_DEBUG', True)
ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', ('localhost', '127.0.0.1', '[::1]'))
CORS_ALLOWED_ORIGINS = env_list('DJANGO_CORS_ALLOWED_ORIGINS', (
    'http://localhost:5173',
    'http://127.0.0.1:5173',
))
CORS_ALLOW_ALL_ORIGINS = env_bool('DJANGO_CORS_ALLOW_ALL_ORIGINS', False)
CSRF_TRUSTED_ORIGINS = env_list('DJANGO_CSRF_TRUSTED_ORIGINS')
