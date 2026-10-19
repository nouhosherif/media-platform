"""Isolated tests: no .env, development database, or persistent upload storage."""

import secrets

from .base import *  # noqa: F403

SECRET_KEY = secrets.token_urlsafe(64)
DEBUG = False
ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1', '[::1]']
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = []
