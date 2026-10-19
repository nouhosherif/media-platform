# Deployment preparation

The files in `infrastructure/` are a reviewed starting point, not an automatic
deployment. They build the Django API with Gunicorn, the Vite application behind
Nginx, PostgreSQL, and Redis. Copy `infrastructure/.env.example` to an untracked
`infrastructure/.env`, replace every placeholder, and keep secrets outside images
and source control. The example disables HTTPS redirection only so the compose
stack can be exercised over local HTTP; real deployments must use TLS and restore
`DJANGO_SECURE_SSL_REDIRECT=true`.

Before a release: back up and restore-test the database and uploaded media; run
the CI commands; review `manage.py migrate --plan`; apply migrations once; verify
`/health/` and `/ready/`; and test login, signup, upload, feed, profile, follows,
messages, and notifications. Terminate TLS at the trusted edge, set explicit
hosts/origins, enable proxy HTTPS only for that edge, then introduce HSTS gradually.

Local media volumes and a single Gunicorn container are suitable for staging only.
A scaled deployment needs shared object storage, a CDN policy, managed PostgreSQL
backups, rate limiting, alerting, and independently scaled web/API workers. The
optional Redis and background-dispatch boundaries are inert until a feature has a
documented consistency, invalidation, retry, and idempotency policy.

No deployment was performed by the restructuring work.
