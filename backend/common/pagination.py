"""Bounded pagination primitives; endpoint adapters preserve legacy contracts."""

from rest_framework.pagination import CursorPagination, PageNumberPagination


class BoundedPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class BoundedCursorPagination(CursorPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    ordering = '-pk'
