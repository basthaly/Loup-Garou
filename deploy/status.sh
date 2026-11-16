#!/usr/bin/env bash
# Vérifie que Loup-Garou tourne bien sur ce serveur : ./status.sh
cd "$(dirname "$0")"
if [ ! -f .env ]; then echo "✘ .env introuvable : lance d'abord ./install.sh"; exit 1; fi
# shellcheck disable=SC1091
. ./.env
FAIL=0
ok() { echo "✔ $1"; }
ko() { echo "✘ $1"; FAIL=1; }

echo "Adresse du site : https://$DOMAIN"
echo
echo "— En interne (sur ce serveur)"
for s in app livekit caddy; do
  if docker compose ps --status running --services 2>/dev/null | grep -qx "$s"; then ok "conteneur $s démarré"
  else ko "conteneur $s arrêté → docker compose logs $s"; fi
done
if HEALTH="$(curl -fsS --max-time 5 http://127.0.0.1:3000/health)"; then
  ok "site : répond ($(echo "$HEALTH" | sed -n 's/.*"rooms":\([0-9]*\).*/\1/p') partie(s) en cours)"
else ko "site : ne répond pas sur 127.0.0.1:3000 → docker compose logs app"; fi
if curl -fsS --max-time 5 http://127.0.0.1:7880 >/dev/null; then ok "serveur vidéo LiveKit : répond"
else ko "serveur vidéo LiveKit : ne répond pas sur 127.0.0.1:7880 → docker compose logs livekit"; fi
# Une IP brute n'a pas de certificat Let's Encrypt : Caddy en fabrique un « maison », refusé par les navigateurs.
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  ko "adresse = IP brute ($DOMAIN) : pas de certificat valide possible → relance ./install.sh $DOMAIN (utilisera ${DOMAIN//./-}.sslip.io)"
fi
ISSUER="$(echo | timeout 10 openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -issuer -enddate 2>/dev/null)"
if echo "$ISSUER" | grep -qi "let's encrypt\|ZeroSSL"; then
  ok "certificat HTTPS : $(echo "$ISSUER" | sed -n "s/.*O *= *\([^,]*\).*/\1/p" | head -1), valable jusqu'au $(echo "$ISSUER" | sed -n 's/notAfter=//p')"
elif [ -n "$ISSUER" ]; then ko "certificat HTTPS : non reconnu par les navigateurs ($(echo "$ISSUER" | head -1)) → docker compose logs caddy"
else echo "… certificat HTTPS : pas encore disponible (docker compose logs caddy)"; fi

echo
echo "— Depuis l'extérieur (par l'adresse publique)"
curl -fsS --max-time 10 "https://$DOMAIN/health" >/dev/null 2>&1; CODE=$?
if [ "$CODE" = 0 ]; then ok "https://$DOMAIN répond avec un certificat valide"
elif [ "$CODE" = 60 ]; then ko "https://$DOMAIN répond, mais le certificat n'est pas valide (voir la ligne certificat ci-dessus)"
else ko "https://$DOMAIN injoignable depuis ce serveur (certificat en cours, DNS, ports non redirigés, ou box sans « NAT loopback » : teste depuis un téléphone en 4G)"; fi
if curl -fsS --max-time 10 "https://$DOMAIN:7443" >/dev/null 2>&1; then ok "signalisation vidéo https://$DOMAIN:7443 répond"
else ko "signalisation vidéo : port 7443 injoignable"; fi

echo
[ "$FAIL" = 0 ] && echo "Tout est bon." || echo "Au moins un point à vérifier (voir ✘ ci-dessus)."
exit "$FAIL"
