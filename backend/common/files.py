"""Storage-independent URL generation shared by serializer representations."""


def file_url(file, request=None):
    if not file:
        return None
    return request.build_absolute_uri(file.url) if request is not None else file.url
