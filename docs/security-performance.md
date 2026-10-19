# Security and performance notes

Public auth endpoints ignore authentication and both clients remove stale bearer
headers before login or registration. Refresh requests are single-flight on web;
invalid refresh credentials clear the session, while transient network failures do
not. API error responses hide unexpected production exceptions and carry a request
ID; logs use allowlisted metadata and do not log bodies, passwords, or tokens.

Feed, messaging, notification, follow, view, and engagement access paths now have
bounded pagination options, selector/query consolidation, and additive indexes.
Legacy response shapes remain available where clients still require them. Explore
uses a signed composite cursor over live ranking values; it is stable for a request
sequence but is not a historical ranking snapshot. Nested comment payloads remain a
known size limit to address with their own endpoint.

The smoke runner in `scripts/load/` is read-only and localhost-only by default. It
reports a signal, not supported concurrency. Establish capacity only in an isolated
environment using representative data and explicit thresholds for latency, errors,
database connections, memory, CPU, and storage throughput.
