"""Shared Django application configuration. Select a concrete environment."""

from datetime import timedelta
from pathlib import Path

from .environment import env_path


# settings is now a package: keep the original backend directory as the root.
BASE_DIR = Path(__file__).resolve().parents[2]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'apps.users',
    'apps.posts',
    'apps.media_handler',
    'corsheaders',
]

MIDDLEWARE = [
    'common.middleware.RequestContextMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'
WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {
        'context_processors': [
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
        ],
    },
}]

# Preserve local persistence. PostgreSQL/storage deployment is a later step.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': env_path('DJANGO_SQLITE_PATH', BASE_DIR / 'db.sqlite3', BASE_DIR),
    },
}

AUTH_USER_MODEL = 'users.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = env_path('DJANGO_STATIC_ROOT', BASE_DIR / 'staticfiles', BASE_DIR)
MEDIA_URL = '/media/'
MEDIA_ROOT = str(env_path('DJANGO_MEDIA_ROOT', BASE_DIR / 'media', BASE_DIR))

REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'common.exceptions.api_exception_handler',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.CursorPagination',
    'PAGE_SIZE': 10,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Explicit extension points. No feed cache or background queue is enabled.
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}}
BACKGROUND_TASK_DISPATCHER = ''
CORS_EXPOSE_HEADERS = ['X-Request-ID']
