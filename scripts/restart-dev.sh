#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for port in 3000 3001 3002 3003; do
  pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Stopping process(es) on port ${port} (${pids})…"
    kill $pids 2>/dev/null || true
    sleep 0.5
    kill -9 $pids 2>/dev/null || true
  fi
done

sleep 1
rm -rf .next node_modules/.cache

# Ensure port 3000 is free before starting
for _ in 1 2 3; do
  if ! lsof -ti "tcp:3000" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  pids="$(lsof -ti "tcp:3000" 2>/dev/null || true)"
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
done

echo "Starting Next.js on http://localhost:3000 …"
exec npx next dev -p 3000
