"""Correlation IDs and bounded, privacy-conscious HTTP observability."""

import logging
import time
import uuid

logger = logging.getLogger('media.http')


class RequestContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            request_id = str(uuid.UUID(request.headers.get('X-Request-ID', '')))
        except (ValueError, AttributeError):
            request_id = str(uuid.uuid4())
        request.request_id = request_id
        start = time.perf_counter()
        response = self.get_response(request)
        response['X-Request-ID'] = request_id
        route = getattr(getattr(request, 'resolver_match', None), 'route', None)
        logger.info('http.request', extra={
            'event': 'http.request', 'request_id': request_id,
            'method': request.method, 'route': route or '(unresolved)',
            'status_code': response.status_code,
            'duration_ms': round((time.perf_counter() - start) * 1000, 2),
        })
        return response
