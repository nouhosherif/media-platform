# Contributing to Media Platform

Read [README.md](README.md), [architecture.md](docs/architecture.md), and
[testing.md](docs/testing.md) before changing a feature. This guide establishes
repository conventions; it does not imply that the existing code has already
been restructured to follow all of them.

## Work in an existing application

- Inspect the affected code and existing working-tree changes first.
- Preserve user changes, migrations, development data, uploads, and working APIs.
- Do not create replacement Django, React, or Expo projects.
- Keep the backend a modular monolith. New services or dependencies need a
  demonstrated requirement and approval.
- Do not restore retired product domains as part of organization work.
- Never run the mobile `reset-project` script as onboarding or routine repair.

For the approved restructuring roadmap, every step must follow this sequence:

1. Inspect and explain the current structure.
2. Explain the bounded change and compatibility risks.
3. Make only that step's changes and update references.
4. Run relevant checks; fix regressions caused by the step.
5. Report changed files, results, limitations, and any remaining risks.
6. Stop and obtain approval before the next step.

Step 2 established documentation and repository conventions. Step 3 is Django
configuration only. Do not fold query fixes, model moves, domain extraction,
dependency upgrades, or new infrastructure into a configuration refactor.

## Branches, commits, and reviews

- Agree on the target base branch with the maintainer; do not assume its name.
- Use short-lived topic branches. Use `codex/<short-topic>` for Codex-assisted
  branches, unless the maintainer requests another name.
- Do not switch/reset branches in a dirty checkout without preserving the work.
- Keep commits focused. Suggested subjects: `docs: explain local setup`,
  `test(users): cover refresh failures`, `refactor(media): extract upload service`.
- Inspect staged changes before committing. Avoid blanket staging of local
  databases, uploads, logs, environments, or unrelated work.
- Never rewrite shared history or deploy production without explicit agreement.

A pull request should state:

- The approved scope, behavior preserved, and reason for the change.
- Files/domains affected and any import, API, route, or environment implications.
- Exact checks run and their results; clearly distinguish warnings and skipped checks.
- Tests added for changed behavior and relevant manual verification.
- Migration/backfill/rollback requirements, or an explicit statement that none exist.
- Screenshots for user-interface changes where useful; no credentials or private data.

## Naming and responsibility conventions

| Area | Convention |
|---|---|
| Python modules/functions | `snake_case` |
| Python classes | `PascalCase` |
| React/React Native components | `PascalCase` |
| JavaScript/TypeScript functions | `camelCase` |
| True global constants | `UPPER_SNAKE_CASE` |

Names should describe purpose; avoid `new`, `final`, `helper2`, or similar names.
Follow the surrounding style and existing lint configuration. Do not mass-format
unrelated files or add new formatting tools as incidental cleanup.

Backend responsibilities for future approved extractions:

- Models: database representation, constraints, small model-specific behavior.
- Serializers: request validation and API representation.
- Views: authentication/authorization, validation orchestration, service/selector
  calls, and responses.
- Services: writes, business workflows, and transactions.
- Selectors: reusable, optimized reads.
- Permissions: reusable authorization rules when justified.
- Tasks: approved asynchronous work; no queue is currently installed.

Avoid import cycles: views depend on services/selectors, which depend on models.
Shared utilities must not depend on application views or feature services.
Do not split small files merely to match a template.

For clients, move one feature at a time. Keep domain-specific logic with that
feature and UI primitives separate. Preserve platform-specific UI and storage.
For mobile changes, first read [AGENTS.md](frontend-mobile/AGENTS.md) and the
versioned Expo documentation it requires. Keep Expo routes in `src/app`.

## Database and migration safety

- Preserve `users` and `media_handler` app labels, table names, primary keys,
  relationships, and migration history during structural changes.
- Never delete or rewrite applied migrations to make a refactor appear simpler.
- Do not reset `db.sqlite3`, run `flush`, or remove uploads as a migration fix.
- Back up existing data and media consistently before approved schema/data work;
  agree on recovery and verify the backup before proceeding.
- A pure file move should not generate schema changes. Use the dry-run check in
  [testing.md](docs/testing.md#backend) and investigate unexpected migrations.
- Historical migrations reference `apps.media_handler.models.user_media_path`
  and `apps.users.models.message_voice_path`. Preserve those import paths through
  compatibility exports if their implementation moves.
- If models become a package, preserve model discovery and existing imports.
- Add constraints/indexes only in a separately reviewed migration, after checking
  existing data and query plans. Do not silently discard duplicates.
- Database transactions do not roll back storage writes. Design compensation and
  cleanup deliberately when changing upload/deletion workflows.

## API and client compatibility

- Preserve existing `/api/users/` and `/api/media/` paths and HTTP methods.
- Do not introduce `/api/v1/` or rename endpoints without a migration strategy.
- Preserve response fields, validation errors, cursor links, and the distinction
  between single-upload and batch-upload responses.
- Treat pagination changes as contract changes; update and test both clients.
- Preserve web paths and Expo route identities, including placeholder routes.
- Keep JWT storage keys and refresh behavior compatible unless an authentication
  change is explicitly approved. Never log tokens or passwords.
- Do not create a second Post/content model just because the `posts` app exists.

## Testing expectations

Run the checks appropriate to the change, using [testing.md](docs/testing.md).
Prioritize authentication, permissions, private fields, ownership, uploads,
pagination, and cross-domain write consistency. Add regression tests for bug
fixes. Performance changes should include query-count/query-plan evidence and,
where needed, realistic load testing rather than unsupported capacity claims.

Documentation-only changes should check local links, commands/configuration
claims, and ignore rules. They do not require inventing application changes to
make an unrelated warning disappear. Existing failing checks must be reported,
not hidden or disabled.

## Security and local files

Never add passwords, private keys, JWTs, cloud/email credentials, or real user
data to source, examples, logs, screenshots, or test fixtures. Use synthetic test
data. Client environment variables are public configuration.

Backend secrets belong in the process environment or the ignored development
`backend/.env`, never in settings source. See [backend configuration](docs/backend.md).
This checkout retains its historical development key and permissive local access;
do not reuse either for production. Removing a literal from current source does
not erase Git history or previously tracked bytecode. Report security concerns
privately without reproducing secrets in public issues.

The root `.gitignore` covers environments, caches, logs, generated builds, local
database/media paths, and private environment files. Safe `.env.example` files,
migrations, source, manifests, and lockfiles should remain discoverable.

Ignore rules do not untrack files already in Git or erase history. Step 1 found
tracked bytecode, a database, and uploaded media, plus untracked mobile source and
newer migrations. Review these with the maintainer; do not automatically run
`git rm --cached`, stage everything, delete local files, or rewrite history.
