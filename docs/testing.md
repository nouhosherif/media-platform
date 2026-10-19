# Testing and verification

These commands use existing tools; they do not install new test frameworks.
Start each section from the repository root in a fresh PowerShell terminal.
Install the existing dependencies using [README](../README.md) first.

## Backend

```powershell
Set-Location .\backend
.\venv\Scripts\python.exe -B manage.py check
.\venv\Scripts\python.exe -B manage.py test --noinput --settings=core.settings.test
.\venv\Scripts\python.exe -B manage.py migrate --check
.\venv\Scripts\python.exe -B manage.py makemigrations --check --dry-run
```

- `check` validates Django configuration.
- The explicit test profile uses an in-memory database and in-memory upload
  storage, not development data or `.env`. Existing upload tests also redirect
  MEDIA_ROOT to temporary directories and clean them up. Fast MD5 hashing is
  test-only; runtime password hashing and password validation are unchanged.
- `migrate --check` detects unapplied existing migrations without applying them.
- `makemigrations --check --dry-run` detects model/migration drift without writing
  migration files. Do not remove `--dry-run` during inspection-only work.
- `-B` prevents Python bytecode writes during these checks.

Focused suites:

```powershell
.\venv\Scripts\python.exe -B manage.py test apps.users.tests --noinput --settings=core.settings.test
.\venv\Scripts\python.exe -B manage.py test apps.media_handler.tests --noinput --settings=core.settings.test
.\venv\Scripts\python.exe -B manage.py test core.tests --noinput --settings=core.settings.test
```

Current tests are organized under [users/tests](../backend/apps/users/tests),
[media_handler/tests](../backend/apps/media_handler/tests), and
[core/tests](../backend/core/tests). The posts test
module is a scaffold. New file-writing tests must isolate their storage and clean
up only their own temporary artifacts. Never test against production data.

Deployment diagnostics:

```powershell
.\venv\Scripts\python.exe -B manage.py check --deploy
```

The current development settings produce security warnings. A zero exit status
with warnings is not production approval. Do not fix unrelated deployment
settings inside a documentation-only step.

Step 3 adds [explicit profiles](backend.md). Configuration tests use fresh Python
processes to verify environment precedence, literal file parsing, fail-closed
production settings, profile isolation, legacy module selection, and unchanged
paths/JWT lifetimes. To additionally exercise the application under the current
development configuration (still using a temporary test database):

```powershell
.\venv\Scripts\python.exe -B manage.py test --noinput --settings=core.settings.development
```

Production diagnostics must explicitly select `core.settings.production` and
provide its required environment; see [backend.md](backend.md#production-profile).
HSTS is deliberately opt-in until HTTPS/domain coverage is reviewed. Never use
the test profile for a deployment check or for running a real application server.

## Web

```powershell
Set-Location .\frontend
npm run lint
npm test
npm run build
```

- ESLint uses the existing React/hooks configuration and does not use `--fix`.
- `npm test` runs Node's built-in test runner for
  [apiError.test.js](../frontend/src/utils/apiError.test.js).
- The build checks bundling and writes generated output to `frontend/dist`.
  It is not an end-to-end browser test and does not test backend availability.

For an inspection that should not replace the existing build output, the
verified local Node/Vite setup also supports:

```powershell
# Run from frontend.
$auditBuildDir = Join-Path ([System.IO.Path]::GetTempPath()) ('media-platform-audit-' + [guid]::NewGuid().ToString('N'))
npm run build -- --configLoader native --outDir $auditBuildDir
```

This creates build artifacts in a unique temporary directory. An external-outDir
notice is expected; do not add destructive cleanup commands for an unresolved path.

## Mobile

```powershell
Set-Location .\frontend-mobile
npx --no-install tsc --noEmit --incremental false
npm run lint
npx --no-install expo install --check
```

These commands require the existing local dependencies. `--no-install` prevents
npx from fetching a missing tool. The Expo dependency check may need network
access; it checks SDK compatibility, not all security advisories or latest
available versions. Do not replace `--check` with a dependency-changing operation
without approval.

For no-cache lint verification, use the configured ESLint directly:

```powershell
.\node_modules\.bin\eslint.cmd .
```

An offline compatibility check can use `EXPO_OFFLINE=1`, but Expo explicitly
warns that offline validation is unreliable. Report it as limited evidence, not
a successful online audit. There is currently no mobile unit-test script,
device automation suite, or implemented native live-calling flow.

## Inspection baseline: 2026-10-17

This is a recorded Step 1 snapshot, not a promise that every later checkout has
the same results. Rerun relevant checks and report the actual outcome.

| Check | Recorded result |
|---|---|
| Django system checks | Passed |
| Django tests | 37 passed: 20 user/auth/privacy tests and 17 media tests |
| Existing migration application check | Passed |
| Model/migration dry-run check | No changes detected |
| Django deployment check | Six warnings: HSTS, HTTPS redirect, development secret, secure session cookie, secure CSRF cookie, debug mode |
| Web lint | Passed |
| Web unit tests | 8 passed |
| Web production build | Passed; outdated Browserslist data warning |
| Mobile TypeScript | Passed |
| Mobile direct ESLint | No errors; one unused-disable warning in generated Expo route types |
| Expo SDK dependency check | Reported up to date in offline mode; explicitly limited/unreliable |

No dependency upgrade, production deployment, physical-device test, browser
end-to-end suite, or load test was part of that baseline. Query-count probes in
[architecture.md](architecture.md#pagination-and-query-behavior) used synthetic
in-memory data and are not a committed performance suite or a capacity benchmark.

## Step 3 verification: 2026-10-18

The configuration refactor passed all 56 backend tests under both the isolated
test profile and the development profile: 37 existing application tests plus
19 configuration tests. Development system checks, migration application checks,
and model/migration dry runs passed. WSGI/ASGI initialization passed for both
development and explicitly selected production settings without starting servers.
Production deployment diagnostics, using a synthetic key/host configuration,
reported only the expected opt-in HSTS warning (`security.W004`). This does not
validate real deployment infrastructure or establish production readiness.

## Final restructuring verification: 2026-10-18

The completed restructuring passed 123 Django tests outside the Windows sandbox,
where upload tests can manage temporary directories. `makemigrations --check
--dry-run` reported no model drift, all migrations are applied, and development
system checks passed. Production deployment diagnostics reported only the deliberate
HSTS opt-in warning. Web verification passed 17 tests, ESLint, and the Vite
production build. Mobile verification passed TypeScript and Expo ESLint. Docker
definitions were inspected but not built because a Docker runtime was unavailable.

The development index migrations were applied after an ignored local backup of the
SQLite database and media tree was created and integrity-checked. No test used the
development data as its test database.

## Coverage and gaps

Existing backend tests cover registration/password errors, duplicate validation,
login/refresh, profile access, selected privacy payloads, media uploads/batches,
feed inclusion, owner-only deletion, likes, and comments. Web tests cover request
error formatting. They do not establish complete feature correctness.

Prioritize future regression coverage for:

- Public usernames that reveal email-default identities; email uniqueness races.
- Stale-token mobile signup, concurrent refresh, and session restoration.
- Calls: authorization, state transitions, signaling races, and network behavior.
- Voice-message and profile-photo validation, permissions, and storage lifecycle.
- Follow/message/notification transactional consistency and read ownership.
- Explore ranking/aggregate correctness and cursor behavior across feed types.
- Query budgets and bounded pagination for users, messages, notifications/comments.
- News validation, successful video paths, engagement concurrency, and storage cleanup.
- Client pagination races, video filtering, uploads, and notification navigation.

Do not silently encode a known bug as the intended contract. Mark existing
behavior clearly and agree on corrective behavior before changing it.

## Manual regression checklist for later feature changes

Use synthetic accounts and temporary media in an isolated development/test setup:

1. Signup, login, refresh, session restoration, and existing logout behavior.
2. Own/public profiles, private fields, photo upload, search, follow/unfollow.
3. Text/image/video/news creation where implemented, batches, feeds and paging.
4. Likes, comments, sharing and media ownership restrictions.
5. Text/voice messaging and notification read actions between two accounts.
6. Web call permissions/signaling on actual devices and networks when calling changes.
7. Existing web URLs and Expo routes, including placeholder pages.

Do not report mobile live calls or placeholder settings/help as working features.
Do not call a successful build an end-to-end test.

## Documentation-only verification

- Check Markdown links resolve to existing repository files/directories/headings.
- Check setup commands and environment-variable descriptions against current code.
- Check package manifests agree with their client lockfile root entries.
- Check ignore patterns hide local/generated paths but retain source, migrations,
  lockfiles, and safe environment examples. `git check-ignore --no-index` can test
  rules for already tracked paths; it does not change their tracking status.
- Inspect the diff/status and preserve all pre-existing changes.
- Do not install packages, migrate the development database, or reset application
  state merely to validate documentation.

## Performance and release claims

The bounded, read-only harness in `scripts/load/` checks local health/readiness;
no measured capacity target exists. Full load tests
need realistic accounts, media sizes, data volumes, concurrent behavior, and
infrastructure. Measure latency percentiles, throughput, errors, database load,
CPU/memory, and connection use. Distinguish simulated traffic from real users and
report the tested environment. Folder structure and passing unit tests cannot
establish support for millions of simultaneous users.
