#!/usr/bin/env bash
# Retour à une ancienne version : l'inverse de update.sh.
#
#   ./rollback.sh                     liste les dernières versions et demande laquelle remettre
#   ./rollback.sh 3                   remet la version n°3 de la liste
#   ./rollback.sh "15/11 21:30"       remet la version qui était en ligne à ce moment-là
#   ./rollback.sh "2026-11-15 21:30"  idem, avec l'année
#   ./rollback.sh a1b2c3d             remet un commit précis
#
# Pour revenir ensuite à la toute dernière version : ./update.sh
{ # accolades : le script est lu en entier avant de s'exécuter (git peut le remplacer pendant qu'il tourne)
set -euo pipefail
cd "$(dirname "$0")"
# On garde les outils actuels : une ancienne version ne les a peut-être pas encore.
KEEP_RB=$(cat rollback.sh); KEEP_UP=$(cat update.sh)
LOG="versions.log"   # historique des mises en ligne (écrit par update.sh et rollback.sh)
N=${N:-20}

git fetch -q origin main 2>/dev/null || echo "(GitHub injoignable : liste des versions déjà téléchargées)"
REF=origin/main
git rev-parse -q --verify "$REF" >/dev/null || REF=main
CUR=$(git rev-parse --short HEAD)

mapfile -t LIST < <(git log "$REF" -n "$N" --date=format:'%d/%m/%Y %H:%M' --format='%h|%ad|%s')

show_list() {
  echo "Versions disponibles (★ = en ligne) :"
  local i=1 line h d m mark
  for line in "${LIST[@]}"; do
    IFS='|' read -r h d m <<<"$line"
    mark="  "; [ "$h" = "$CUR" ] && mark="★ "
    printf "%s%2d) %s  %s  %s\n" "$mark" "$i" "$d" "$h" "${m:0:70}"
    i=$((i + 1))
  done
}

# Date au format JJ/MM[/AAAA] [HH:MM] ou AAAA-MM-JJ [HH:MM] → secondes
to_epoch() {
  local s="$1"
  if [[ "$s" =~ ^([0-9]{1,2})/([0-9]{1,2})(/([0-9]{4}))?([[:space:]]+([0-9]{1,2}:[0-9]{2}))?$ ]]; then
    local y="${BASH_REMATCH[4]:-$(date +%Y)}" t="${BASH_REMATCH[6]:-23:59}"
    s=$(printf '%s-%02d-%02d %s' "$y" "$((10#${BASH_REMATCH[2]}))" "$((10#${BASH_REMATCH[1]}))" "$t")
  fi
  date -d "$s" +%s 2>/dev/null
}

# La version en ligne à un moment donné : d'abord l'historique des mises en ligne, sinon la date des commits.
at_time() {
  local ts="$1" best=""
  if [ -f "$LOG" ]; then
    while read -r when sha _; do
      [ -n "$when" ] && [ "$when" -le "$ts" ] && best="$sha"
    done < "$LOG"
  fi
  [ -z "$best" ] && best=$(git rev-list -1 --before="@$ts" "$REF" 2>/dev/null || true)
  echo "$best"
}

CHOICE="${1:-}"
if [ -z "$CHOICE" ]; then
  show_list
  echo
  read -r -p "Numéro, date (ex. 15/11 21:30) ou commit à remettre (Entrée pour annuler) : " CHOICE
  [ -z "$CHOICE" ] && { echo "Annulé."; exit 0; }
fi

TARGET=""
if [[ "$CHOICE" =~ ^[0-9]{1,2}$ ]] && [ "$CHOICE" -ge 1 ] && [ "$CHOICE" -le "${#LIST[@]}" ]; then
  TARGET=$(cut -d'|' -f1 <<<"${LIST[$((CHOICE - 1))]}")
elif git rev-parse -q --verify "${CHOICE}^{commit}" >/dev/null 2>&1; then
  TARGET="$CHOICE"
elif TS=$(to_epoch "$CHOICE") && [ -n "$TS" ]; then
  TARGET=$(at_time "$TS")
  [ -z "$TARGET" ] && { echo "Aucune version trouvée avant le $CHOICE."; exit 1; }
else
  echo "Je ne comprends pas « $CHOICE » : donne un numéro de la liste, une date ou un commit."
  exit 1
fi

SHORT=$(git rev-parse --short "$TARGET")
echo
git log -1 --date=format:'%d/%m/%Y %H:%M' --format='Version choisie : %h du %ad%n  %s' "$TARGET"
if [ "$SHORT" = "$CUR" ]; then echo "C'est déjà la version en ligne."; exit 0; fi
if [ -t 0 ] && [ -z "${YES:-}" ]; then
  read -r -p "La remettre en ligne ? [o/N] " OK
  [[ "$OK" =~ ^[oOyY] ]] || { echo "Annulé."; exit 0; }
fi

git -c advice.detachedHead=false checkout -q -f "$TARGET"
printf '%s\n' "$KEEP_RB" > rollback.sh; printf '%s\n' "$KEEP_UP" > update.sh; chmod +x rollback.sh update.sh
docker compose up -d --build
docker image prune -f >/dev/null
echo "$(date +%s) $(git rev-parse --short HEAD) rollback" >> "$LOG"
echo "✔ Version $SHORT remise en ligne. Pour revenir à la dernière : ./update.sh"
exit 0
}
