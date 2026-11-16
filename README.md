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

**Avec des amis sur le même réseau** : ils ouvrent `http://<IP-de-ton-PC>:3000` (ex. `http://192.168.1.20:3000`).

### Avec Docker

```bash
docker compose up -d --build
```

## Ce que fait la V1
- Salon avec code à 4 lettres et lien d'invitation, reconnexion automatique
- MJ automatique (le site) ou tenu par un joueur (il voit tout et fait avancer la partie)
- Rôles distribués automatiquement selon le nombre de joueurs (modifiable par l'hôte), ou choisis par vote des joueurs
- Votes (village, Capitaine, loups) secrets puis révélés en même temps
- Thème nuit / jour, joueurs morts en spectateurs (option : ils voient les rôles)
- Rôles gérés : Loup-Garou, Villageois, Voyante, Sorcière, Chasseur, Cupidon (amoureux), Petite Fille (sans pouvoir pour l'instant), Capitaine, Ancien, Salvateur, Idiot du village, Bouc émissaire
- Affichés « Bientôt » : Voleur, Joueur de flûte et rôles de l'extension Personnages

## Pas encore fait
- Caméras et micros (V2 : LiveKit + coturn) ; la Petite Fille pourra alors espionner le salon des loups
- Rôles marqués « Bientôt »

## Structure
- `server/roles.js` : rôles et composition automatique
- `server/game.js` : moteur (phases, étapes, votes, morts, victoire)
- `server/index.js` : serveur web + Socket.IO
- `public/` : interface
- `test/simulate.js` : `npm test` simule 18 parties complètes avec des bots
- `maquette/` : maquette Claude Design (7 écrans)
