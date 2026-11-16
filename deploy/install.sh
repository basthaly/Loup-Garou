#!/usr/bin/env bash
# Installation sur un VPS Debian/Ubuntu (ex. OVH VPS-1). À lancer en root depuis le dossier deploy/ :
#   ./install.sh                      → utilise l'adresse IP du serveur (détectée automatiquement)
#   ./install.sh 51.210.12.34         → une adresse IP précise
#   ./install.sh mon-domaine.fr       → ton nom de domaine (enregistrement DNS A vers l'IP du serveur)
set -euo pipefail
cd "$(dirname "$0")"

ADDR="${1:-}"
if [ -z "$ADDR" ]; then
  ADDR="$(curl -fsS -4 https://api.ipify.org || true)"
  [ -n "$ADDR" ] && echo "Adresse IP du serveur détectée : $ADDR"
fi
if [ -z "$ADDR" ]; then
  read -rp "Adresse IP ou nom de domaine du serveur : " ADDR
fi

# Un certificat HTTPS gratuit (Let's Encrypt) demande un nom, pas une IP brute.
# Pour une IP, on utilise le service gratuit sslip.io : 51-210-12-34.sslip.io pointe vers 51.210.12.34.
if [[ "$ADDR" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  DOMAIN="${ADDR//./-}.sslip.io"
  echo "Adresse du site : https://$DOMAIN (pointe vers $ADDR)"
else
  DOMAIN="$ADDR"
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
echo "  Vérifier que tout tourne : ./status.sh"

# Serveur chez soi (VM, mini-PC…) derrière une box : rappeler les redirections de ports.
LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ "$LOCAL_IP" =~ ^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.) ]]; then
  echo
  echo "Ce serveur est derrière une box (IP locale $LOCAL_IP)."
  echo "Redirige ces ports de ta box vers $LOCAL_IP :"
  echo "  TCP : 80, 443, 7443, 7881"
  echo "  UDP : 3478, 30000-30200, 50000-50200"
fi
