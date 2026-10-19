# Content ownership

This Django app is intentionally dormant. It has no active models or API routes.
The existing `apps.media_handler.models.Media` model owns text posts, image/video
posts, news articles, upload batches, likes, comments, and engagement records.
Its selectors own chronological/following/personalized/explore reads; its services
own content mutations. Both clients continue using the existing `/api/media/`
routes and existing database tables.

Do not introduce a second Post table or move historical Media models/migrations
as a cleanup. Any future app rename or domain split needs an explicit migration
plan preserving app labels, table names, data, API contracts, and upload callable
import paths. The current package is retained for compatibility.
