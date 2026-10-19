"""
ASGI config for core project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

# Production must explicitly export core.settings.production before startup.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.development')

application = get_asgi_application()
