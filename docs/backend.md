# Backend configuration

Step 3 separates Django configuration without changing models, migrations,
database contents, uploads, API routes, app labels, or JWT lifetimes. No new
dependencies, PostgreSQL server, workers, or deployment infrastructure were added.

## Settings layout

| Module | Responsibility |
|---|---|
| `core.settings.base` | Shared apps, middleware, templates, auth, REST/JWT, paths and SQLite configuration; not a standalone profile |
| `core.settings.development` | Local `.env`, required development key, configurable debug/hosts/CORS/CSRF |
| `core.settings.production` | Process environment only; required key/hosts, restrictive security defaults |
| `core.settings.test` | In-memory database/uploads, temporary signing key and test-only fast hashing |
| `core.settings.environment` | Small backend-only readers and literal development environment-file loader |

Sources: [settings package](../backend/core/settings), [entrypoint](../backend/manage.py),
and [configuration tests](../backend/core/tests.py).

`manage.py`, WSGI and ASGI default to development for existing local workflows.
An exported `DJANGO_SETTINGS_MODULE` is honored; `manage.py --settings=...` can
also select a profile. Existing `DJANGO_SETTINGS_MODULE=core.settings` remains a
development compatibility alias. Use explicit environment modules for new setup.
Application code should import `django.conf.settings`, not profile modules.

The settings-package move does not change `BASE_DIR`: it still points to
`backend/`. Relative configured paths resolve from there, not from the shell's
current directory. Defaults remain `backend/db.sqlite3` and `backend/media/`.
`STATIC_ROOT` is now `backend/staticfiles/`; no collection or media move was run.

## Local environment

Development reads **only** `backend/.env`. It does not search parent directories,
load frontend `.env.local` files, or replace already exported process variables.
Restart the backend after editing it; `.env` changes are not guaranteed to trigger
Django's code autoreloader. An explicitly blank required key fails startup rather
than falling back to a different key.

Copy [backend/.env.example](../backend/.env.example) only if no local file exists.
Generate a private key using the [README setup](../README.md#backend-setup).
The example deliberately has no usable secret. Step 3 moved the existing
checkout's development key into its ignored local file without rotating it,
preserving current development sessions/JWTs. Its historical broad host/CORS
settings also remain local; new examples use loopback hosts and explicit origins.
For LAN development, add your computer's IP to the host list.

The dependency-free local format is intentionally limited:

- One uppercase `KEY=value` assignment per line; duplicate keys are rejected.
- Blank lines and whole-line `#` comments are allowed.
- Matching single/double outer quotes are removed; everything inside is literal.
- There is no variable interpolation, shell execution, escape processing,
  multiline value, `export` prefix, or inline-comment syntax. A `#` inside a value
  is part of the value, which preserves secrets containing that character.
- Select `DJANGO_SETTINGS_MODULE` outside this file; an assignment here is rejected.
- Parsing errors identify the line/key, not secret values.

This is backend configuration only. Cross-client environment consolidation is a
later roadmap step; client variables and behavior have not changed.

## Environment reference

| Variable | Meaning / default |
|---|---|
| `DJANGO_SETTINGS_MODULE` | Process-level profile; entrypoints default to `core.settings.development` |
| `DJANGO_SECRET_KEY` | Required for development and production; test profile generates an isolated key |
| `DJANGO_DEBUG` | Development defaults true; production rejects true; test always false |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames/IPs, not URLs/ports; development defaults loopback, production requires explicit non-wildcard hosts |
| `DJANGO_CORS_ALLOW_ALL_ORIGINS` | Development defaults false; production rejects true |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Comma-separated browser origins including scheme/port; development defaults localhost/127.0.0.1 on port 5173, production defaults empty |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Comma-separated trusted origins including scheme; defaults empty |
| `DJANGO_SQLITE_PATH` | Defaults `db.sqlite3` beneath backend; does not migrate/copy the old database |
| `DJANGO_MEDIA_ROOT` | Defaults `media` beneath backend; changing it does not move existing uploads |
| `DJANGO_STATIC_ROOT` | Defaults `staticfiles` beneath backend |
| `DJANGO_TRUST_PROXY_HTTPS` | Production only; default false, explicitly trust sanitized `X-Forwarded-Proto` when true |
| `DJANGO_SECURE_HSTS_SECONDS` | Production only; non-negative integer, default 0 pending HTTPS review |
| `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS` | Production only; default false |
| `DJANGO_SECURE_HSTS_PRELOAD` | Production only; default false |

Booleans accept `true/false`, `1/0`, `yes/no`, and `on/off`, case-insensitively.
Invalid or blank booleans/integers fail clearly. List values are comma-separated,
trimmed, and omit empty entries; an explicit blank means an empty list.

## Production profile

**This is a security configuration profile, not a completed production deployment.**
It intentionally never reads the development `.env`. Provision environment
variables through the deployment platform/secret manager. At minimum provide:

```text
DJANGO_SETTINGS_MODULE=core.settings.production
DJANGO_SECRET_KEY=<independently generated private production secret>
DJANGO_ALLOWED_HOSTS=<actual API hostnames>
```

The placeholders above are not deployable values. The key must have at least
50 characters, at least five distinct characters, and no `django-insecure-`
prefix. These structural checks cannot establish randomness; generate it securely.
Never reuse the historical development key. Removing its literal from current
source does not remove it from Git history or previously tracked bytecode.

Production forces debug off, secure session/CSRF cookies and HTTPS redirection.
Open CORS and wildcard hosts/origins are rejected. Set exact CORS origins only
when the browser frontend uses a different origin; CORS is not authentication.
Set CSRF trusted origins deliberately for applicable browser/session flows.

Proxy trust defaults off. Set `DJANGO_TRUST_PROXY_HTTPS=true` only when a trusted
proxy strips client-provided forwarding headers and sets `X-Forwarded-Proto`
itself; otherwise clients could spoof HTTPS. Without the correct proxy contract,
HTTPS redirection can also loop. Do not enable forwarding trust merely to silence
an error.

HSTS defaults to zero because a persistent browser policy requires verified
HTTPS coverage. `check --deploy` reports `security.W004` until configured.
Subdomains and preloading require separate domain-wide review; enabling only an
HSTS duration can also produce Django's subdomain/preload warnings. Do not hide
these warnings or turn on persistent policies just to obtain a clean report.

With actual environment variables supplied, run from `backend/`:

```powershell
.\venv\Scripts\python.exe -B manage.py check --deploy --settings=core.settings.production
```

Production still uses SQLite and local filesystem storage. This profile alone
must not be deployed as the finished platform. A later approved step must address
PostgreSQL, shared storage/private-media delivery, a production server/proxy,
static/media delivery, backups, monitoring, and capacity testing. Debug-only
Django `/media/` serving is absent when debug is false; configure real delivery
before a deployment. No production service was started in Step 3.

## Verification and safety

Use [testing.md](testing.md) for the full commands. Run the full backend suite with
`--settings=core.settings.test`, plus development checks, `migrate --check`, and
`makemigrations --check --dry-run`. Neither migration check applies migrations.
Configuration tests launch isolated Python processes to catch environment/module
cache leaks and test fail-closed behavior without exposing secrets.

The test profile must never serve real users: its signing key changes per process,
password hashing is intentionally weak for speed, and data/uploads are ephemeral.
No database reset, migration generation, storage relocation, secret-history cleanup,
or feature correction belongs to this configuration step.
