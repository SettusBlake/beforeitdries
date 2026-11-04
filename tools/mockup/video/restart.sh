#!/bin/bash
# Eigenen Vorschau-Server (Port $1, Standard 5180) neu starten, frischer Spieler. Nur Ports 5180-5189
P=${1:-5180}
case $P in 518[0-9]) ;; *) echo "refuse port $P"; exit 1;; esac
fuser -k -TERM $P/tcp >/dev/null 2>&1
for i in $(seq 1 20); do fuser $P/tcp >/dev/null 2>&1 || break; sleep 0.2; done
cd "$(dirname "$0")/../../.."
PORT=$P setsid nohup node dist/preview-server.mjs >> /tmp/preview-$P.log 2>&1 < /dev/null &
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:$P/duel.html && break; sleep 0.25; done
