"""Versioned, privacy-safe cache keys. No application result caching is enabled."""

import hashlib
import json


def cache_key(namespace, *, scope, version=1, **parameters):
    """Callers must name a scope (e.g. user:42); never use tokens as parameters.

    Hash parameters rather than exposing search strings/private data in keys.
    Future consumers own TTLs and after-commit invalidation for their namespace.
    """
    if not namespace or not scope or not namespace.replace('_', '').isalnum():
        raise ValueError('A simple namespace and explicit cache scope are required.')
    if not isinstance(version, int) or version < 1:
        raise ValueError('Cache key version must be a positive integer.')
    payload = json.dumps({'scope': scope, 'parameters': parameters}, sort_keys=True, separators=(',', ':'))
    digest = hashlib.sha256(payload.encode('utf-8')).hexdigest()
    return f'media:{namespace}:v{version}:{digest}'
