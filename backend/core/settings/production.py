"""Fail-closed security profile, not a complete production deployment.

Read only the process environment. SQLite/local media remain until the approved
deployment step; do not deploy this profile alone as production infrastructure.
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .environment import database_settings, env_bool, env_list, env_nonnegative_int, env_text, required_text

SECRET_KEY = required_text('DJANGO_SECRET_KEY')
DATABASES = database_settings(BASE_DIR)
if (len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5
        or SECRET_KEY.startswith('django-insecure-')):
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be a strong, independently generated production key.')

DEBUG = False
if env_bool('DJANGO_DEBUG', False):
    raise ImproperlyConfigured('DJANGO_DEBUG must be false in production.')

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS')
if not ALLOWED_HOSTS or any('*' in host for host in ALLOWED_HOSTS):
    raise ImproperlyConfigured('DJANGO_ALLOWED_HOSTS must contain explicit production hosts, without wildcards.')

CORS_ALLOW_ALL_ORIGINS = False
if env_bool('DJANGO_CORS_ALLOW_ALL_ORIGINS', False):
    raise ImproperlyConfigured('DJANGO_CORS_ALLOW_ALL_ORIGINS must be false in production.')
CORS_ALLOWED_ORIGINS = env_list('DJANGO_CORS_ALLOWED_ORIGINS')
CSRF_TRUSTED_ORIGINS = env_list('DJANGO_CSRF_TRUSTED_ORIGINS')
if any('*' in origin for origin in CORS_ALLOWED_ORIGINS + CSRF_TRUSTED_ORIGINS):
    raise ImproperlyConfigured('Production CORS/CSRF origins must be explicit, without wildcards.')

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = env_bool('DJANGO_SECURE_SSL_REDIRECT', True)

# Enable only after reviewing HTTPS coverage and the deployment's proxy contract.
SECURE_HSTS_SECONDS = env_nonnegative_int('DJANGO_SECURE_HSTS_SECONDS')
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool('DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS')
SECURE_HSTS_PRELOAD = env_bool('DJANGO_SECURE_HSTS_PRELOAD')
SECURE_PROXY_SSL_HEADER = None
if env_bool('DJANGO_TRUST_PROXY_HTTPS'):
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Explicit opt-in shared cache; no domain caching is enabled without a policy.
_redis_url = env_text('DJANGO_CACHE_URL')
if _redis_url:
    if not _redis_url.startswith(('redis://', 'rediss://')):
        raise ImproperlyConfigured('DJANGO_CACHE_URL must be a Redis URL.')
    CACHES = {'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': _redis_url,
        'KEY_PREFIX': 'media',
        'TIMEOUT': 60,
        'OPTIONS': {'socket_connect_timeout': 2, 'socket_timeout': 2},
    }}

BACKGROUND_TASK_DISPATCHER = env_text('DJANGO_BACKGROUND_TASK_DISPATCHER')
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {'json': {'()': 'common.logging.JsonFormatter'}},
    'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'json'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'media': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
    },
}
