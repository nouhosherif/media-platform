"""After-commit dispatch boundary for a future durable task queue.

No queue or synchronous pretend-worker is started. A deployment must explicitly
configure a dispatcher; task handlers must be idempotent and accept record IDs.
"""

import json
import re

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.utils.module_loading import import_string


def dispatch_after_commit(task_name, payload, *, idempotency_key, dispatcher=None):
    if not re.fullmatch(r'[a-z][a-z0-9_.]+', task_name) or not idempotency_key:
        raise ValueError('A named task and idempotency key are required.')
    # Capture an immutable JSON-compatible snapshot, not mutable model instances.
    message = json.loads(json.dumps(payload, allow_nan=False))
    if dispatcher is None:
        configured = getattr(settings, 'BACKGROUND_TASK_DISPATCHER', '')
        if not configured:
            raise ImproperlyConfigured('No durable background-task dispatcher is configured.')
        dispatcher = import_string(configured)
    if not callable(dispatcher):
        raise ImproperlyConfigured('The background-task dispatcher must be callable.')
    transaction.on_commit(lambda: dispatcher(
        task_name, message, idempotency_key=idempotency_key,
    ))
