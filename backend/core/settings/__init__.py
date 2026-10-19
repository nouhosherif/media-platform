"""Environment-specific settings; entrypoints default to development.

Keep DJANGO_SETTINGS_MODULE=core.settings working for existing local commands.
Explicit production/test imports must not load the development environment.
"""

import os

if os.environ.get('DJANGO_SETTINGS_MODULE') == 'core.settings':
    from .development import *  # noqa: F403
