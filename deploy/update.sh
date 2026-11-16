#!/usr/bin/env bash
# Mise à jour : récupère la dernière version depuis GitHub et relance.
set -euo pipefail
cd "$(dirname "$0")"
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
echo "✔ Mis à jour."
