#!/bin/bash
# Lädt den aktuellen Stand einmal ins Playtest-Subreddit (devvit.json dev.subreddit) und hört dann auf.
# Ohne Terminal läuft `devvit playtest` nach dem Upload weiter, deshalb wartet das Skript
# auf "Playtest ready" und beendet dann die ganze Prozessgruppe. Übernommen aus Amber Delve.
set -euo pipefail
cd "$(dirname "$0")/.."

# Node-Programme erreichen das Netz in der Cloud nur über den Proxy
export NODE_USE_ENV_PROXY=1
log="$(mktemp)"
setsid npx devvit playtest < /dev/null > "$log" 2>&1 &
pid=$!
cleanup() {
  kill -- -"$pid" 2>/dev/null || true
  pkill -f "$PWD/node_modules/.bin/[v]ite build --watch" || true
  rm -f "$log"
}
trap cleanup EXIT

clean() { sed 's/\x1b\[[0-9;]*[A-Za-z]//g' "$log"; }

for _ in $(seq 1 600); do
  if grep -q "Playtest ready" "$log"; then
    clean | grep -E "URL:|Version:"
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Playtest stopped before it was ready:"
    clean | grep -v '^\s*$' | tail -30
    exit 1
  fi
  sleep 1
done

echo "No 'Playtest ready' after 10 minutes:"
clean | grep -v '^\s*$' | tail -30
exit 1
