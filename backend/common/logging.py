"""Allowlisted structured logs: never serialize request bodies or credentials."""

import json
import logging
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record):
        # Free-form messages/exception strings may contain user input or secrets.
        # Emit stable event names and explicit fields, not record.__dict__.
        data = {
            'timestamp': datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'event': getattr(record, 'event', 'application.log'),
        }
        for name in ('request_id', 'method', 'route', 'status_code', 'duration_ms', 'exception_type'):
            value = getattr(record, name, None)
            if value is not None:
                data[name] = value
        return json.dumps(data, ensure_ascii=True)
