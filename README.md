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

Sur le NAS, on utilisera plutôt le proxy inversé de Synology avec un vrai certificat Let's Encrypt.

### Avec Docker

```bash
docker compose up -d --build
```

## Ce que fait le site
- Salon avec code à 4 lettres et lien d'invitation, reconnexion automatique
- MJ automatique (le site) ou tenu par un joueur (il voit tout et fait avancer la partie)
- Rôles distribués automatiquement selon le nombre de joueurs (modifiable par l'hôte), ou choisis par vote des joueurs
- Votes (village, Capitaine, loups) secrets puis révélés en même temps
- Interface en 4 zones : Moi, Le village (vivants / cimetière séparés), Action, Journal ; bandeau de phase nuit / jour
- **Caméra et micro** (WebRTC) avec règles automatiques :
  - jour et salon : tout le monde se voit et s'entend
  - nuit : caméras et micros coupés, sauf entre loups pendant leur tour
  - Petite Fille : voit la vidéo floutée des loups pendant leur tour (sans le son)
  - morts : voient et entendent tout, mais ne parlent plus qu'aux autres morts
  - MJ joueur : voit et entend tout, tout le monde l'entend
- Joueurs morts en spectateurs (option : ils voient les rôles)
- Rôles gérés : Loup-Garou, Villageois, Voyante, Sorcière, Chasseur, Cupidon (amoureux), Petite Fille, Capitaine, Ancien, Salvateur, Idiot du village, Bouc émissaire
- Affichés « Bientôt » : Voleur, Joueur de flûte et rôles de l'extension Personnages

## Limites actuelles
- Vidéo en maillage direct (chaque joueur envoie sa vidéo à chacun) : confortable jusqu'à ~8 joueurs. Au-delà, prévoir un serveur vidéo (LiveKit) sur le NAS.
- Hors réseau local (amis en 4G, box stricte), il faudra un serveur TURN : variable `ICE_SERVERS` (JSON, ex. `[{"urls":"turn:mon-nas:3478","username":"u","credential":"p"}]`).
- Rôles marqués « Bientôt »

## Structure
- `server/roles.js` : rôles et composition automatique
- `server/game.js` : moteur (phases, étapes, votes, morts, victoire)
- `server/index.js` : serveur web + Socket.IO
- `public/` : interface (`app.js`) et audio/vidéo (`rtc.js`)
- `test/simulate.js` : `npm test` simule 18 parties complètes avec des bots
- `maquette/` : maquette Claude Design (7 écrans)
