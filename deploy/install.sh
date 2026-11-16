#!/usr/bin/env bash
# Installation sur un VPS Debian/Ubuntu (ex. OVH VPS-1). À lancer en root depuis le dossier deploy/ :
#   ./install.sh vps-xxxxxxxx.vps.ovh.net
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  read -rp "Nom de domaine du serveur (ex. vps-1234abcd.vps.ovh.net) : " DOMAIN
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Installation de Docker…"
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -f .env ]; then
  KEY="lg$(openssl rand -hex 6)"
  SECRET="$(openssl rand -hex 32)"
  printf 'DOMAIN=%s\nLIVEKIT_API_KEY=%s\nLIVEKIT_API_SECRET=%s\n' "$DOMAIN" "$KEY" "$SECRET" > .env
  chmod 600 .env
else
  sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN/" .env
fi
# shellcheck disable=SC1091
source .env
sed -e "s/__KEY__/$LIVEKIT_API_KEY/" -e "s/__SECRET__/$LIVEKIT_API_SECRET/" livekit.yaml.template > livekit.yaml
chmod 600 livekit.yaml

# Pare-feu (seulement s'il est actif) : web, signalisation vidéo, médias et relais TURN.
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80,443,7443,7881/tcp
  ufw allow 3478/udp
  ufw allow 50000:50200/udp
  ufw allow 30000:30200/udp
fi

docker compose up -d --build
echo
echo "✔ Loup-Garou est en ligne : https://$DOMAIN"
echo "  (le certificat HTTPS peut prendre une minute à être délivré la première fois)"
