# Media Platform

An existing social-media application with a Django REST API, a React/Vite web
client, and an Expo/React Native mobile client. Users can publish text, images,
and videos, manage profiles and follows, and exchange messages and voice notes.
Web calling is implemented; mobile call buttons are placeholders. See the
[feature inventory](docs/architecture.md#client-features) for other differences.

The default profile is a development application. The current
development profile uses a private local key, debug mode, SQLite, and local media
storage. This checkout retains permissive local hosts/CORS for compatibility.
Do not expose this setup as a production service. The production settings profile
is paired with reference container infrastructure under `infrastructure/`; review
and adapt it before operating a public service.
No concurrent-user capacity has been established through load testing.

## Start here

- [Architecture and feature ownership](docs/architecture.md)
- [Contributing and restructuring safety](CONTRIBUTING.md)
- [Test commands, baseline, and coverage gaps](docs/testing.md)
- [Django settings and backend configuration](docs/backend.md)
- [Deployment preparation](docs/deployment.md)
- [Security and performance notes](docs/security-performance.md)

The approved restructuring through Step 24 is recorded in
[restructuring-progress.md](docs/restructuring-progress.md).

## Repository layout

```text
media-platform/
├── backend/          Django API, models, migrations, and backend tests
├── frontend/         React/Vite browser application
├── frontend-mobile/  Expo Router application, services, types, and native UI
├── docs/             Architecture and testing guides
├── .gitignore        Local/generated-file rules; does not untrack existing files
├── CONTRIBUTING.md   Development and review conventions
└── README.md         Onboarding entry point
```

There is no root npm workspace or root package script. Run npm commands in the
appropriate client directory. The root lockfile is not a dependency manifest for
either client.

CI is defined in `.github/workflows/ci.yml`; reference containers live in
`infrastructure/`, and the bounded load-smoke utility lives in `scripts/load/`.

The backend has two active business apps: `users` and `media_handler`. The
installed `posts` app is a scaffold; actual posts and news live in `Media`.

## Requirements

The inspected environment uses Python **3.14.0**, Node.js **24.15.0**, and npm
**11.12.1**. These are verified local versions, not a declared minimum-support
matrix. No runtime version-manager pin is currently committed.

- Backend versions are pinned in [requirements.txt](backend/requirements.txt).
- Each client has its own `package.json` and `package-lock.json`; use `npm ci`
  for a clean installation from its lockfile.
- Mobile uses Expo SDK 57 and React Native 0.86.2. Follow
  [the mobile development instructions](frontend-mobile/AGENTS.md) before changing
  mobile code. Windows cannot run an iOS simulator locally.

Commands below use PowerShell. Start each terminal in the repository root.
Reuse existing environments and configuration when present. Installation and
migration commands below are onboarding instructions, not operations performed
by the documentation/configuration restructuring steps.

## Backend setup

In the backend terminal:

```powershell
Set-Location .\backend
# Create a virtual environment only if this checkout does not have one.
if (-not (Test-Path .\venv\Scripts\python.exe)) {
    python -m venv venv
}
.\venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
```

For a fresh checkout, generate a local secret and place it in `DJANGO_SECRET_KEY`
inside `backend/.env`. Do not overwrite an existing key: changing it invalidates
existing signed sessions and JWTs. Step 3 preserved this checkout's development
key in its ignored `.env`; no setup change is needed for this existing checkout.

```powershell
# Only when a new development key is needed; keep the result private.
.\venv\Scripts\python.exe -B -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

After setting the key:

```powershell
.\venv\Scripts\python.exe -B manage.py check
.\venv\Scripts\python.exe -B manage.py migrate --plan
```

For an existing database, review the migration plan and take a consistent backup
of the database and uploaded files before applying schema changes. For a fresh
development database, apply the existing migrations. Do not delete the database
or migration history to resolve an error.

```powershell
.\venv\Scripts\python.exe -B manage.py migrate
.\venv\Scripts\python.exe -B manage.py runserver 127.0.0.1:8001
```

Leave this terminal running. Current data lives in `backend/db.sqlite3`; uploads
live in `backend/media/`. These are local state, not disposable source files.

## Web setup

In a separate terminal, starting from the repository root:

```powershell
Set-Location .\frontend
npm ci
if (-not (Test-Path .env.local)) {
    Copy-Item .env.example .env.local
}
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173`. Vite may select
another port if that port is occupied.

The default browser API path is `/api/`. Vite forwards `/api` and `/media` to
`http://127.0.0.1:8001`. Both servers must remain running for login/signup and
other API features. Production build/preview commands are not substitutes for
the Django server or a production reverse proxy.

## Mobile setup

A physical device needs a backend address reachable from that device.
`localhost` on the phone is the phone, not the development computer.

For trusted LAN development, stop the loopback-only Django server with Ctrl+C
and restart it from the backend directory:

```powershell
.\venv\Scripts\python.exe -B manage.py runserver 0.0.0.0:8001
```

Do not run a second server on the same port. Use a trusted network and restrict
firewall access appropriately; this is still a development server.
For a new checkout, add the computer's LAN IP to `DJANGO_ALLOWED_HOSTS` in
`backend/.env` before starting Django. Keep production hosts separate.

In another terminal, starting from the repository root:

```powershell
Set-Location .\frontend-mobile
npm ci
if (-not (Test-Path .env.local)) {
    Copy-Item .env.example .env.local
}
```

Edit `frontend-mobile/.env.local`, replacing `YOUR_COMPUTER_IP` with the
computer's reachable LAN IP, then start Expo:

```powershell
npm start
```

Use an SDK-compatible client/device and the launch options Expo displays.
Restart Expo after changing environment configuration. Native calls are not
implemented: creating a development build alone does not add calling support.

**Do not run `npm run reset-project` for setup or troubleshooting.** The starter
script can move or delete the mobile `src` and `scripts` directories. The
client-level READMEs still contain starter guidance; use this root guide for
application onboarding.

## Current environment configuration

| Variable / file | Consumer | Current behavior |
|---|---|---|
| `VITE_API_BASE_URL` | Web API client | Optional root or API base; defaults to `/api/`. The example `/` keeps requests same-origin. |
| `VITE_BACKEND_PROXY_URL` | Vite development server | Optional backend origin; defaults to `http://127.0.0.1:8001`. |
| `EXPO_PUBLIC_API_BASE_URL` | Mobile API client | Required reachable backend root or `/api` URL; missing configuration throws during module loading. |
| `DJANGO_SETTINGS_MODULE` | Django entrypoints | Process-level selection; defaults to `core.settings.development`. Production/test profiles are explicit. |
| `DJANGO_SECRET_KEY` | Django development/production | Required private backend secret; no source-code fallback. |
| `backend/.env` | Development settings only | Literal local assignments; existing process variables take priority. Never loaded by production/test profiles. |

Examples are in [web .env.example](frontend/.env.example) and
[mobile .env.example](frontend-mobile/.env.example). Do not overwrite a working
`.env.local` without checking it first.

`VITE_*` and `EXPO_PUBLIC_*` values referenced by client code are public build
configuration, not places for passwords, signing keys, or cloud secrets.
See [backend configuration](docs/backend.md) and [backend .env.example](backend/.env.example)
for host/CORS/CSRF, path, and production security settings. Never put
`DJANGO_SETTINGS_MODULE` inside the local `.env`; select it in the process
environment or with Django's `--settings` option.

## Verification

See [testing.md](docs/testing.md) for exact commands and limitations. The current
checks cover Django checks/tests, migration consistency, web lint/tests/build,
and mobile TypeScript/lint. There is no mobile unit-test script or end-to-end
suite yet.

## Troubleshooting

- **Login/signup reports an unreachable server or HTTP 502:** confirm Django is
  running on port 8001 and the Vite proxy points to it. Restart the web client
  after changing its environment. Do not reset the database.
- **API returns HTTP 400:** inspect the field-specific validation response; it
  is different from a connection failure.
- **Mobile cannot connect:** confirm the LAN address, port, server binding,
  same-network access, and firewall. A desktop-only localhost URL is insufficient.
- **Login/signup fails:** confirm the API is reachable, then inspect the field-level
  validation response. Public login/register requests deliberately strip any stale
  bearer token on both clients.
- **Browser calls cannot access camera/microphone:** check browser permissions
  and use localhost or HTTPS. Cross-network calls also need infrastructure work.
- **A clean checkout is missing features:** review repository tracking with the
  maintainer. Step 1 found untracked mobile source and newer migrations; ignore
  rules do not add them to Git automatically.

## Production boundary

The current development proxy is not production hosting. A future deployment
needs reviewed production settings, secret management, SPA/API routing, private
media policy, backups, monitoring, and capacity testing. PostgreSQL, shared
storage/CDN, Redis, and workers are future decisions, not currently configured
services. See [architecture.md](docs/architecture.md#future-direction-not-implemented).
