import json
import logging
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.test import SimpleTestCase, TestCase, RequestFactory, override_settings
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request

from common.background import dispatch_after_commit
from common.cache import cache_key
from common.exceptions import api_exception_handler
from common.files import file_url
from common.logging import JsonFormatter
from common.middleware import RequestContextMiddleware
from common.pagination import BoundedPageNumberPagination


class UtilityTests(SimpleTestCase):
    def test_cache_keys_are_stable_scoped_versioned_and_private(self):
        first = cache_key('profile', scope='user:1', search='private phrase', page=2)
        self.assertEqual(first, cache_key('profile', scope='user:1', page=2, search='private phrase'))
        self.assertNotEqual(first, cache_key('profile', scope='user:2', search='private phrase', page=2))
        self.assertNotEqual(first, cache_key('profile', scope='user:1', version=2, search='private phrase', page=2))
        self.assertNotIn('private phrase', first)
        with self.assertRaises(ValueError):
            cache_key('profile', scope='')

    def test_file_urls_preserve_empty_relative_and_absolute_behavior(self):
        self.assertIsNone(file_url(None))
        file = SimpleNamespace(url='/media/file.png')
        self.assertEqual(file_url(file), '/media/file.png')
        self.assertEqual(file_url(file, RequestFactory().get('/')), 'http://testserver/media/file.png')

    def test_pagination_caps_requested_page_size(self):
        paginator = BoundedPageNumberPagination()
        rows = paginator.paginate_queryset(list(range(200)), Request(RequestFactory().get('/?page_size=10000')))
        self.assertEqual(len(rows), 100)
        self.assertEqual(paginator.page.paginator.count, 200)

    def test_structured_logs_do_not_serialize_messages_or_secrets(self):
        record = logging.LogRecord('media.http', logging.ERROR, __file__, 1, 'password=secret', (), None)
        record.event = 'http.request'
        record.authorization = 'Bearer private-token'
        record.request_id = 'trace'
        formatted = JsonFormatter().format(record)
        self.assertNotIn('secret', formatted)
        self.assertNotIn('private-token', formatted)
        self.assertEqual(json.loads(formatted)['request_id'], 'trace')

    @override_settings(DEBUG=False)
    def test_exception_handler_preserves_validation_and_hides_unhandled_details(self):
        validation = api_exception_handler(ValidationError({'email': ['Invalid email.']}), {})
        self.assertEqual(validation.status_code, 400)
        self.assertEqual(validation.data['email'], ['Invalid email.'])
        unexpected = api_exception_handler(RuntimeError('sensitive internal text'), {
            'request': SimpleNamespace(request_id='trace'),
        })
        self.assertEqual(unexpected.status_code, 500)
        self.assertEqual(unexpected.data['request_id'], 'trace')
        self.assertNotIn('sensitive', str(unexpected.data))

    def test_middleware_sanitizes_correlation_id_and_omits_query_data(self):
        from django.http import HttpResponse
        request = RequestFactory().get('/missing/?token=private', HTTP_X_REQUEST_ID='untrusted-not-a-uuid')
        with self.assertLogs('media.http', level='INFO') as logs:
            response = RequestContextMiddleware(lambda request: HttpResponse())(request)
        self.assertEqual(response['X-Request-ID'], request.request_id)
        self.assertNotEqual(response['X-Request-ID'], 'untrusted-not-a-uuid')
        self.assertNotIn('private', JsonFormatter().format(logs.records[0]))


class BackgroundBoundaryTests(TestCase):
    def test_dispatch_waits_for_commit_and_captures_payload(self):
        dispatcher = Mock()
        payload = {'media_id': 1}
        with self.captureOnCommitCallbacks(execute=True):
            dispatch_after_commit('media.thumbnail', payload, idempotency_key='media:1:v1', dispatcher=dispatcher)
            payload['media_id'] = 2
            dispatcher.assert_not_called()
        dispatcher.assert_called_once_with('media.thumbnail', {'media_id': 1}, idempotency_key='media:1:v1')

    def test_rollback_does_not_dispatch(self):
        dispatcher = Mock()
        with self.captureOnCommitCallbacks(execute=True):
            try:
                with transaction.atomic():
                    dispatch_after_commit('media.thumbnail', {}, idempotency_key='one', dispatcher=dispatcher)
                    raise RuntimeError('rollback')
            except RuntimeError:
                pass
        dispatcher.assert_not_called()

    @override_settings(BACKGROUND_TASK_DISPATCHER='')
    def test_missing_queue_is_explicit_not_fake_async_success(self):
        with self.assertRaises(ImproperlyConfigured):
            dispatch_after_commit('media.thumbnail', {}, idempotency_key='one')


class OperationalEndpointTests(TestCase):
    def test_health_and_readiness_return_status_only(self):
        for path in ('/health/', '/ready/'):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {'status': 'ok'})
            self.assertIn('X-Request-ID', response)

    def test_readiness_failure_does_not_disclose_database_details(self):
        with patch('common.health.connection.cursor', side_effect=RuntimeError('password=secret')):
            response = self.client.get('/ready/')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'status': 'unavailable'})

    def test_operational_probes_do_not_accept_writes(self):
        self.assertEqual(self.client.post('/health/').status_code, 405)
