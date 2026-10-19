from ..selectors.profiles import user_summary_context


def participant_context(request, records, fields, *, extra_users=()):
    users = list(extra_users)
    for record in records:
        users.extend(getattr(record, field) for field in fields)
    return user_summary_context(request, users)
