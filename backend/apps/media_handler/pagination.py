from rest_framework.pagination import CursorPagination

class FeedPagination(CursorPagination):
    page_size = 10
    ordering = '-uploaded_at'