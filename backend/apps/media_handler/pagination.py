import math

from django.core import signing
from django.db.models import Q
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import NotFound
from rest_framework.utils.urls import replace_query_param

from common.pagination import BoundedCursorPagination

from .selectors import EXPLORE_ORDERING


class FeedPagination(BoundedCursorPagination):
    page_size = 10
    ordering = ('-uploaded_at', '-id')


class ExplorePagination(FeedPagination):
    """Composite keyset pagination with the unchanged public response envelope.

    Rank ties can span thousands of rows; DRF's first-field offset cursor cannot
    traverse those reliably. Include every rank field plus the unique id. Rank
    is live, not a snapshot: concurrent interactions can still move an item.
    Old chronological cursor links retain their original traversal behavior.
    """

    prefix = 'e1.'
    salt = 'media.explore.cursor.v1'
    fields = tuple(field.lstrip('-') for field in EXPLORE_ORDERING)

    def paginate_queryset(self, queryset, request, view=None):
        token = request.query_params.get(self.cursor_query_param)
        self.legacy = bool(token and not token.startswith(self.prefix))
        if self.legacy:
            return super().paginate_queryset(queryset, request, view)

        self.base_url = request.build_absolute_uri()
        self.page_size = self.get_page_size(request)
        self.boundary = None
        reverse = False
        if token:
            try:
                payload = signing.loads(token[len(self.prefix):], salt=self.salt)
                position = payload['position']
                reverse = payload['reverse']
                if (
                    not isinstance(position, list) or len(position) != len(self.fields)
                    or not isinstance(reverse, bool)
                    or any(type(position[index]) is not int or position[index] < 0 for index in (0, 1, 2, 5))
                    or not isinstance(position[3], (int, float)) or not math.isfinite(position[3])
                    or not isinstance(position[4], str) or parse_datetime(position[4]) is None
                ):
                    raise ValueError('Invalid position')
                self.boundary = position
            except (signing.BadSignature, KeyError, TypeError, ValueError, OverflowError):
                raise NotFound(self.invalid_cursor_message)

            predicate = Q()
            equal = Q()
            comparison = 'gt' if reverse else 'lt'
            for field, value in zip(self.fields, position):
                predicate |= equal & Q(**{f'{field}__{comparison}': value})
                equal &= Q(**{field: value})
            queryset = queryset.filter(predicate)

        ordering = self.fields if reverse else EXPLORE_ORDERING
        rows = list(queryset.order_by(*ordering)[:self.page_size + 1])
        self.page = rows[:self.page_size]
        has_more = len(rows) > self.page_size
        if reverse:
            self.page.reverse()
            self.has_previous, self.has_next = has_more, True
        else:
            self.has_previous, self.has_next = self.boundary is not None, has_more
        self.display_page_controls = self.has_previous or self.has_next
        return self.page

    def _position(self, instance):
        return [
            getattr(instance, field).isoformat() if field == 'uploaded_at'
            else getattr(instance, field)
            for field in self.fields
        ]

    def _link(self, position, reverse):
        token = self.prefix + signing.dumps(
            {'position': position, 'reverse': reverse}, salt=self.salt, compress=True,
        )
        return replace_query_param(self.base_url, self.cursor_query_param, token)

    def get_next_link(self):
        if self.legacy:
            return super().get_next_link()
        if not self.has_next:
            return None
        position = self._position(self.page[-1]) if self.page else self.boundary
        return self._link(position, False)

    def get_previous_link(self):
        if self.legacy:
            return super().get_previous_link()
        if not self.has_previous:
            return None
        position = self._position(self.page[0]) if self.page else self.boundary
        return self._link(position, True)
