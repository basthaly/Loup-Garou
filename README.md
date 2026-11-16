# Loup-Garou en ligne

Site pour jouer au Loup-Garou entre amis, chacun sur son écran. Moteur de jeu temps réel en Node.js + Socket.IO.

## Lancer en local

Prérequis : [Node.js](https://nodejs.org) 18 ou plus.

```bash
npm install
npm start
```

Puis ouvre http://localhost:3000.

**Tester seul** : ouvre plusieurs onglets (ou fenêtres privées), chacun est un joueur. Minimum 3 joueurs (6+ recommandé).

### Caméra et micro avec d'autres appareils (HTTPS)

Les navigateurs n'autorisent la caméra qu'en **HTTPS** (ou sur `localhost`). Pour jouer à plusieurs sur ton réseau :

```bash
# Windows (PowerShell) : $env:HTTPS=1; npm start
HTTPS=1 npm start
```

Le serveur affiche les adresses à donner (ex. `https://192.168.1.20:3000`). Le certificat est auto-signé : chaque joueur doit accepter l'avertissement du navigateur (« Paramètres avancés » → « Continuer »).

Pour jouer en ligne avec un vrai certificat, voir « Mettre en ligne sur un VPS OVH ».

### Avec Docker

```bash
docker compose up -d --build
```

## Mettre en ligne sur un VPS OVH (jouer hors réseau, à nombreux)

Le dossier `deploy/` installe tout d'un coup : le site, le **serveur vidéo LiveKit** (chacun n'envoie sa vidéo qu'une fois, le serveur la redistribue : ça tient à 15+ joueurs), un **relais TURN** (joueurs en 4G ou derrière une box stricte) et le **HTTPS automatique** (Let's Encrypt, via Caddy).

1. Commande un VPS (ex. OVH VPS-1) avec **Ubuntu 24.04**. OVH t'envoie par e-mail l'IP, le nom du serveur (`vps-xxxxxxxx.vps.ovh.net`) et le mot de passe.
2. Connecte-toi : `ssh ubuntu@vps-xxxxxxxx.vps.ovh.net`, puis `sudo -i`.
3. Installe :
   ```bash
   apt update && apt install -y git
   git clone https://github.com/basthaly/Loup-Garou && cd Loup-Garou/deploy
   ./install.sh vps-xxxxxxxx.vps.ovh.net
   ```
4. Ouvre `https://vps-xxxxxxxx.vps.ovh.net` et partage le lien.

Mise à jour plus tard : `cd Loup-Garou/deploy && ./update.sh`.

Ports utilisés (à ouvrir si tu actives un pare-feu, `install.sh` le fait pour `ufw`) : 80, 443, 7443, 7881 en TCP ; 3478, 30000-30200 et 50000-50200 en UDP.

Ton propre nom de domaine : crée un enregistrement DNS `A` vers l'IP du VPS, puis relance `./install.sh mon-domaine.fr`.

## Ce que fait le site
- Accueil en deux temps : créer un salon ou rejoindre avec un code, puis pseudo
- Reconnexion : « Reprendre ma partie » après avoir fermé l'onglet, ou « Reprendre la place de… » parmi les joueurs déconnectés (autre appareil, bug)
- L'hôte peut exclure un joueur (en jeu, il est compté comme mort)
- MJ automatique (le site) ou tenu par un joueur (il voit tout et fait avancer la partie)
- Rôles distribués automatiquement selon le nombre de joueurs (modifiable par l'hôte), ou choisis par vote des joueurs
- Votes (village, Capitaine, loups) secrets puis révélés en même temps
- Interface en 4 zones : Moi, Le village (vivants / cimetière séparés), Action, Journal ; bandeau de phase nuit / jour
- **Micro et caméra indépendants** (on peut parler sans se montrer), barre flottante sur téléphone, règles automatiques :
  - jour et salon : tout le monde se voit et s'entend
  - nuit : les joueurs endormis ne voient et n'entendent plus personne (seulement leur propre caméra) ; les rôles réveillés voient tout le monde, et les loups s'entendent entre eux
  - Petite Fille : voit la vidéo floutée des loups pendant leur tour (sans le son)
  - morts : voient et entendent tout, mais ne parlent plus qu'aux autres morts
  - MJ joueur : voit et entend tout, tout le monde l'entend
- Joueurs morts en spectateurs (option : ils voient les rôles)
- Rôles gérés : Loup-Garou, Villageois, Voyante, Sorcière, Chasseur, Cupidon (amoureux), Petite Fille, Capitaine, Ancien, Salvateur, Idiot du village, Bouc émissaire
- Affichés « Bientôt » : Voleur, Joueur de flûte et rôles de l'extension Personnages

## Vidéo : deux modes
- **LiveKit** (VPS, voir ci-dessus) : activé dès que `LIVEKIT_URL`, `LIVEKIT_API_KEY` et `LIVEKIT_API_SECRET` sont définis. Le serveur de jeu retire en plus aux joueurs endormis le droit de recevoir la moindre vidéo.
- **Maillage direct** (par défaut, en local) : chaque navigateur envoie sa vidéo à chacun ; confortable jusqu'à ~8 joueurs, idéal pour tester.

## Pas encore fait
- Rôles marqués « Bientôt »

## Structure
- `server/roles.js` : rôles et composition automatique
- `server/game.js` : moteur (phases, étapes, votes, morts, victoire)
- `server/index.js` : serveur web + Socket.IO
- `server/livekit.js` : jetons et permissions du serveur vidéo
- `public/` : interface (`app.js`) et micro/caméra (`media.js`)
- `deploy/` : installation sur VPS (Docker, LiveKit, Caddy)
- `test/` : `npm test` vérifie les règles (vidéo de nuit, exclusion, reconnexion, fin de partie) puis simule 18 parties complètes avec des bots
- `maquette/` : maquette Claude Design (7 écrans)
