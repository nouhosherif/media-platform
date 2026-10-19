# Load-smoke checks

`python scripts/load/smoke.py` performs bounded, read-only liveness/readiness checks
against localhost and reports throughput, failures, and p50/p95/max latency. It is a
smoke signal, not a capacity claim. Use `--allow-non-local` only with the target
owner's authorization. Authenticated feed, upload, messaging, and write scenarios
must use disposable test accounts and data in an isolated environment.
