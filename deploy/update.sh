#!/usr/bin/env bash
# Mise à jour : récupère la dernière version depuis GitHub et relance.
# (Pour revenir à une ancienne version : ./rollback.sh)
{ # accolades : le script est lu en entier avant de s'exécuter (git pull peut le remplacer)
set -euo pipefail
cd "$(dirname "$0")"
# Après un ./rollback.sh, on est sur une ancienne version : on revient sur la branche principale.
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || git checkout -q -f main
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
echo "$(date +%s) $(git rev-parse --short HEAD) update" >> versions.log
echo "✔ Mis à jour ($(git log -1 --format='%h · %s' | cut -c1-80))."
exit 0
}
