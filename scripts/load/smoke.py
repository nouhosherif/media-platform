"""Small dependency-free HTTP smoke runner; defaults to safe local GETs only."""

import argparse
import concurrent.futures
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request


def request(url, timeout):
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            ok = 200 <= response.status < 400
            status = response.status
    except urllib.error.HTTPError as error:
        ok, status = False, error.code
    except OSError:
        ok, status = False, 0
    return ok, status, (time.perf_counter() - started) * 1000


def percentile(values, percent):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int((len(ordered) - 1) * percent))]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:8001')
    parser.add_argument('--requests', type=int, default=50)
    parser.add_argument('--concurrency', type=int, default=5)
    parser.add_argument('--timeout', type=float, default=5)
    parser.add_argument('--allow-non-local', action='store_true')
    args = parser.parse_args()
    host = urllib.parse.urlparse(args.base_url).hostname
    if host not in {'localhost', '127.0.0.1', '::1'} and not args.allow_non_local:
        parser.error('non-local targets require --allow-non-local and owner authorization')
    if not 1 <= args.requests <= 10_000 or not 1 <= args.concurrency <= 100:
        parser.error('requests must be 1..10000 and concurrency 1..100')
    urls = [f"{args.base_url.rstrip('/')}{path}" for path in ('/health/', '/ready/')]
    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(args.concurrency) as pool:
        results = list(pool.map(lambda index: request(urls[index % 2], args.timeout), range(args.requests)))
    elapsed = time.perf_counter() - started
    timings = [result[2] for result in results]
    failures = sum(not result[0] for result in results)
    print(f'requests={args.requests} failures={failures} rps={args.requests / elapsed:.2f}')
    print(f'latency_ms p50={statistics.median(timings):.2f} p95={percentile(timings, .95):.2f} max={max(timings):.2f}')
    raise SystemExit(1 if failures else 0)


if __name__ == '__main__':
    main()
