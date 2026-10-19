from common.pagination import BoundedPageNumberPagination


def optional_page(queryset, request, *, legacy_limit=None):
    """Opt-in paging preserves legacy list/envelope responses for existing clients."""
    if 'page' not in request.query_params and 'page_size' not in request.query_params:
        return list(queryset[:legacy_limit] if legacy_limit else queryset), {}
    paginator = BoundedPageNumberPagination()
    records = paginator.paginate_queryset(queryset, request)
    return records, {
        'count': paginator.page.paginator.count,
        'next': paginator.get_next_link(),
        'previous': paginator.get_previous_link(),
    }
