# Architecture and ownership

The feature map describes the code inspected on **2026-10-17**. Configuration
sections were updated for Step 3 on **2026-10-18**. Proposed domain directories
and infrastructure below are not implemented.
See [README](../README.md) for setup and [testing](testing.md) for verification.

## Current boundaries

```text
Web: React pages/components -> Axios -> Django REST API
Mobile: Expo routes/components -> typed services -> Axios -> Django REST API

Django core.urls
  +-- /api/users/ -> users views -> serializers and ORM
  +-- /api/media/ -> media_handler views -> serializers and ORM
  +-- /admin/
  +-- /media/     -> development file serving when DEBUG is enabled

Persistence: local SQLite + local filesystem uploads
```

The backend is a monolith, not microservices. `core/settings/` contains shared,
development, production, and test settings. See [backend configuration](backend.md).
ASGI and WSGI entrypoints exist, but there
is no production application-server/reverse-proxy configuration in the repo.

| Area | Actual responsibility / entry points |
|---|---|
| [users](../backend/apps/users) | Authentication, profiles/photos, search, follows, text/voice messaging, call signaling, notifications |
| [media_handler](../backend/apps/media_handler) | Text/image/video/news content, uploads, feeds, likes, comments, engagement, ownership-based deletion |
| [posts](../backend/apps/posts) | Installed scaffold; no implemented model or API workflow |
| [web](../frontend/src/App.jsx) | Browser routes, page-local API/state logic, shared cards/composer |
| [mobile](../frontend-mobile/src/app) | File-based routes, services/types, native controls, shared UI primitives |

There are no application service/selector packages, custom permission classes,
custom middleware, background tasks, or application signals. App admin modules
are placeholders. Authentication and ownership checks live mainly in views.

## Models and dependencies

```text
users.User (AbstractUser + bio + profile_picture)
  +-- Follow: follower and following -> User
  +-- DirectMessage: sender and recipient -> User
  +-- CallSession: caller and recipient -> User
  +-- Notification: recipient and optional actor -> User
  +-- media_handler.Media: owner/user -> User
        +-- Like: media + user
        +-- Comment: media + user
        +-- MediaView: media + user
```

Sources: [user models](../backend/apps/users/models.py) and
[media models](../backend/apps/media_handler/models.py).

`Media` is the content model. `content_type` distinguishes `post` and `news`;
`media_type` distinguishes image, video, and text. A news article uses a title
and caption, not another table. A multiple-photo upload creates independent
Media records, not an album/attachment aggregate. Shares are client-side actions,
not a persisted model. MediaView stores view counts, watch durations, and
clicked/liked/commented flags.

Media views import User and Follow. User serializers query the reverse
`User.media` relation for post counts. This is cross-domain coupling, but no
direct circular import was found in these paths. Keep shared utilities below
domains in the dependency direction; do not make them import views.

## API inventory and contracts

Authoritative route lists: [users URLs](../backend/apps/users/urls.py) and
[media URLs](../backend/apps/media_handler/urls.py). Paths below are relative to
the stated prefix and retain their trailing slash.

| Prefix | Routes and behavior |
|---|---|
| `/api/users/` | POST `register/`, `login/`, `token/refresh/` |
| `/api/users/` | GET `profile/`, `profile/<user_id>/`; POST `profile/photo/` |
| `/api/users/` | GET `search/`, `follows/`; POST `follow/<user_id>/` toggles following |
| `/api/users/` | GET/POST `messages/`; GET `messages/<user_id>/` returns conversation and marks incoming messages read |
| `/api/users/` | GET/POST `calls/` and `calls/<call_id>/` for call state/signaling |
| `/api/users/` | GET `notifications/`; POST `notifications/mark-all-read/`, `notifications/<notification_id>/read/` |
| `/api/media/` | POST `upload/`; GET `my-media/`, `user/<user_id>/`; DELETE `delete/<pk>/` |
| `/api/media/` | GET `feed/`, `following/`, `personalized/`, `explore/` |
| `/api/media/` | POST `like/<media_id>/`, `comment/<media_id>/`, `engagement/<media_id>/` |
| `/api/media/` | POST `like-signal/<media_id>/`, `view/<media_id>/`, `watch/<media_id>/`, `click/<media_id>/` |

There is no API version prefix, health/readiness endpoint, generated API schema,
logout endpoint, or token-blacklist configuration. `like-signal` is a view alias,
not a Django signal. No client calls to the view/watch/click tracking endpoints
were found; like/comment actions do update engagement flags on the backend.

Registration issues JWTs, defaults an omitted username to email, and validates
passwords. Access tokens last 15 minutes; refresh tokens last one day. Social and
media views explicitly require authentication. Media deletion filters by owner;
call access filters participants; notification updates filter the recipient.

Single uploads return a media object; batches return `{count, results}`. General
media uploads accept JPEG/PNG/MP4 up to 5 MiB per file; multiple selection permits
up to ten images. News requires a headline, at least 40 characters of text, and
at most one media file. Profile photos have a separate 5 MiB check; voice messages
have a 10 MiB check. These policies must not be silently unified during refactoring.

## Pagination and query behavior

| Data | Current response behavior |
|---|---|
| All four feeds; own/public media | Cursor page size 10, ordered by `-uploaded_at` |
| Search | First 20, no continuation |
| Follow directory | First 50, no continuation |
| Calls | First 20, no continuation |
| Threads | Scans all messages involving the user and groups latest per peer in Python |
| Conversations / notifications | Unbounded lists |
| Comments | Entire collection nested in each media response |

Global DRF pagination does not paginate manually constructed APIView responses.
The personalized feed is followed-user content with an all-content fallback, not
a separate recommendation engine.

Step 1's isolated, forced-authentication query probes measured:

| Fixture | SQL statements |
|---|---:|
| Ten feed posts, no comments | 21 |
| Ten feed posts, thirty comments | 51 |
| Search with two other users | 9 |
| Five-message conversation | 47 |
| One thread containing five messages | 14 |
| Five notifications | 23 |
| One active call | 13 |

These are diagnostic counts, not load-test results. Rich user serializers repeat
four count/follow queries per representation; media serializers query likes,
comments, and comment authors. Fix query shape before adding caches.

Explore has two confirmed defects: multi-relation joins inflate view/watch sums,
and the cursor paginator overrides its intended engagement ranking with upload
time. A fixture with two likes, three comments, and one view produced six summed
views. These defects are recorded, not corrected in Step 2.

## Client features

| Capability | Web | Mobile |
|---|---|---|
| Authentication/refresh | Implemented; localStorage | Implemented; SecureStore, shared refresh promise |
| Explicit logout interface | Not found | Present on home |
| Profiles/photos/follows/search | Implemented | Implemented |
| Main feed | Implemented | Implemented |
| Following / For You / Explore controls | Not found | Implemented |
| Text/photo/video/batch upload | Implemented | Implemented |
| News creation/title display | Implemented | No first-class news contract/composer |
| Likes/comments | Post comments; video comment button is inert | Cards/reels and comment modal |
| Sharing | Clipboard text/links | Native share sheet |
| Text and voice messages | Implemented | Implemented |
| Live calls | WebRTC plus HTTP signaling | Informational alert only; no native calling implementation |
| Notifications/read actions | Implemented | Implemented |
| Deletion | Backend endpoint; no UI found | Unused service wrapper; no UI found |
| Help/settings | Minimal/placeholder pages | Placeholder pages |
| Dashboard | No route | Placeholder route, not in menu |

Web paths: `/`, `/signup`, `/feed`, `/videos`, `/profile`, `/profile/:userId`,
`/follows`, `/messages`, `/notifications`, `/menu`, `/menu/help-support`, and
`/menu/settings-privacy`. The first two are public; others use a token-presence
guard. Routes are defined in [App.jsx](../frontend/src/App.jsx).

Mobile paths: `/`, `/login`, `/register`, `/upload`, `/videos`, `/profile`,
`/profile/[userId]`, `/search`, `/follows`, `/messages`, `/notifications`, `/menu`,
`/menu/dashboard`, `/menu/help-support`, and `/menu/settings-privacy`.
Keep route files in `src/app`; the root layout currently only declares a Stack.

Web pages call Axios directly and repeat navigation/error handling. Mobile has
domain services, response types, shared UI, a theme, and FlatList rendering, but
route files still own large workflows. Both video clients filter generic feed
pages locally. Mobile types currently omit news title/content-type fields.

## Messaging and notifications

The backend stores text/voice messages and call signaling in SQLite. Web records
voice using browser APIs; mobile uses expo-audio. WebRTC media is peer-to-peer,
not relayed through Django's HTTP signaling endpoints.

- Web conversation polling: every 3.5 seconds, followed by a thread refresh.
- Web incoming-call polling: every 2.5 seconds when no call is active.
- Web active-call polling: every 1.2 seconds.
- Mobile conversation polling: every 3.5 seconds.

There is no WebSocket server, shared pub/sub, or configured STUN/TURN server in
the web peer connection. Call updates append ICE candidates to JSON arrays.

Follow, message, and call creation insert a notification synchronously. There is
no large notification fan-out loop, push delivery, email delivery, or worker.
Notification reads return all records with counts; mark-one and mark-all actions
exist. Pagination and query optimization are more immediate needs than a queue
for a single notification insert.

## Persistence and deployment boundary

Current configuration lives in [core/settings](../backend/core/settings): shared
application defaults plus explicit development, production, and test profiles.
Development loads an ignored `backend/.env`; this checkout preserves its local
key and broad host/CORS access. Production reads only process variables, requires
a strong key and explicit hosts, disables debug/open CORS, and enables secure
cookies/HTTPS redirection. Test settings use an in-memory database and storage.
SQLite and local media remain the runtime defaults; no PostgreSQL/storage
deployment, throttles, or custom logging were added. See [backend.md](backend.md).

SQLite has primary-key, foreign-key, unique username, unique follow-pair, and
unique like-pair indexes. There are no explicit timeline/composite access-path
indexes, no unique user/media engagement pair, and no database-enforced unique
email. Candidate indexes need query plans and workload evidence before adoption.

Media paths are `user_<id>/<uuid>.<extension>`, `profiles/`, and
`messages/user_<id>/`. Files are saved synchronously and served through development
media routing. There is no object store, CDN, transcoding/thumbnail pipeline, or
explicit file-replacement/deletion cleanup workflow. Private voice URLs have no
separate authorization/signed-delivery layer.

No application caching, Redis, queue/workers, production server setup, Docker,
reverse proxy configuration, CI workflows, metrics/tracing, backup automation, or
load-testing harness is present. Standard ASGI/WSGI entrypoints are not evidence
of a production deployment. Vite's development proxy is not included in static
build hosting; a future deployment needs API/media routing and SPA fallback.

## Known issues requiring separately approved work

| Priority | Evidence / concern | Future treatment |
|---|---|---|
| Critical before public deployment | Historical development key remains local/in Git history; deployment infrastructure is still absent | Step 3 separates security profiles; independently provision production secrets and complete reviewed deployment work |
| High | Email-default usernames are returned publicly even when the email field is hidden | Separate public identity from private email with a compatibility plan |
| High | Unprotected private-media delivery and metadata-based upload validation | Deliberate privacy policy, signed/authenticated delivery, file validation |
| High | N+1 serializers, unbounded messages/notifications/comments, expensive thread scans | Lean serializers, selectors, database-side reads and compatible pagination |
| High | Explore aggregate multiplication and overridden ordering | Focused correctness tests and ranking/pagination correction |
| High | Engagement read-modify-write races; call ICE update races; related writes lack one service transaction | Constraints after data review, atomic updates and transactional services |
| High | SQLite/local files and absent throttling | Production database/shared storage and evidence-based abuse controls |
| High | Untracked source/new migrations and tracked runtime data | Reviewed source checkpoint and safe repository hygiene, not automatic deletion |
| Medium | Expired stored access token can be attached to mobile signup and produce 401 | Align public-auth transport handling and add regression tests |
| Medium | Web refresh duplication; polling/network/rendering growth; limited call networking | Coordinated refresh, focused polling, incremental responses and network tests |
| Medium | Feature-heavy screens, duplicated errors/navigation, cross-client contract drift | One-feature-at-a-time extraction and contract tests |
| Medium | No deployment observability or broad regression coverage | Health/logging/monitoring and risk-focused tests in later steps |
| Low | Starter artifacts and stale metadata | Separate reviewed cleanup |

Step 1 found twelve stale Django content types for retired domains. Those
apps are not active. This metadata is not permission to delete records during a
structural change. The inactive posts migration initializer was already marked
deleted in the inspected working tree; that pre-existing state is not repaired
by this documentation step.

## Future direction (not implemented)

Preserve app labels and model/table identities. Start by extracting bounded
services/selectors inside existing apps. Users can eventually split views and
serializers by auth, profiles, social, messaging, calls, and notifications.
Media can initially keep small `services.py` and `selectors.py` modules; it does
not need a directory for every possible layer. Keep posts dormant until its role
is explicitly decided; do not duplicate the existing content model.

Shared backend code should contain only proven common validation, pagination,
error, or authorization primitives. Models, migrations, and import shims must
remain compatible. Proposed responsibility rules are in [CONTRIBUTING](../CONTRIBUTING.md).

For web, gradually introduce `app`, shared `components/ui` and layout components,
an API transport module, and `features/{auth,feed,media,profile,social,messaging,
notifications,settings,support}`. Extract Messages into conversation/voice/call
components and hooks; move PostCard/composer to media and profile workflows to
profile. Move one feature and verify it before continuing.

For mobile, retain `src/app` as thin route adapters, move workflows into equivalent
feature folders, and preserve native UI/SecureStore. Reuse existing services and
types before adding abstractions. Shared pure contracts are optional future work;
do not introduce a shared-package system or shared DOM/native UI prematurely.

Step 3 introduced base/development/production/test settings, not new infrastructure.
Deployment work may introduce PostgreSQL, a reverse proxy/load balancer, shared
object storage/CDN, and appropriate connection management. Cache and workers
should follow measured needs and explicit invalidation/job-lifecycle designs.
Observability, CI, infrastructure directories, and load tests belong to their
approved roadmap steps. No millions-of-users claim is supported by current tests.
