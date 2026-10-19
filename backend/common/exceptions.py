"""Preserve validation/auth errors; give unexpected production errors a safe ID."""

import logging

from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import exception_handler, set_rollback

logger = logging.getLogger('media.errors')


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None or settings.DEBUG:
        return response
    request_id = getattr(context.get('request'), 'request_id', None)
    set_rollback()
    logger.error('api.unhandled', extra={
        'event': 'api.unhandled', 'request_id': request_id,
        'exception_type': type(exc).__name__,
    })
    return Response({
        'detail': 'An unexpected server error occurred.',
        'request_id': request_id,
    }, status=500)
