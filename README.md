# Loup-Garou en ligne

Jouer au Loup-Garou entre amis, chacun sur son écran, avec caméra et micro. Le site fait le maître du jeu (ou un joueur le fait), distribue les rôles, coupe les caméras la nuit et révèle les votes tous en même temps.

**Sommaire**
1. [Tester sur ton PC](#1-tester-sur-ton-pc)
2. [Jouer à plusieurs sur ton réseau (Wi-Fi)](#2-jouer-à-plusieurs-sur-ton-réseau-wi-fi)
3. [Mettre en ligne sur un VPS (OVH)](#3-mettre-en-ligne-sur-un-vps-ovh)
4. [Dépannage](#4-dépannage)
5. [Fonctionnalités](#5-fonctionnalités)
6. [Pour les développeurs](#6-pour-les-développeurs)

---

## 1. Tester sur ton PC

### Ce qu'il faut installer (une seule fois)

| Logiciel | Où le trouver | Vérifier qu'il est installé |
| --- | --- | --- |
| **Node.js** 18 ou plus (version « LTS ») | https://nodejs.org | `node -v` |
| **Git** | https://git-scm.com | `git --version` |

Les commandes se tapent dans un terminal : **PowerShell** sous Windows, **Terminal** sous macOS ou Linux.

### Installer et lancer

```bash
git clone https://github.com/basthaly/Loup-Garou
cd Loup-Garou
npm install
npm start
```

Le terminal affiche :

```
Loup-Garou : http://localhost:3000
  vidéo : maillage direct (sans serveur vidéo)
```

Ouvre **http://localhost:3000** dans ton navigateur.

### Tester seul

Ouvre plusieurs onglets sur http://localhost:3000 : chaque onglet est un joueur.

1. Dans le premier onglet : **Créer un salon**, puis choisis un pseudo.
2. Clique sur **Copier le lien** et colle-le dans les autres onglets (ou tape le code à 4 lettres avec **Rejoindre avec un code**).
3. Une fois au moins 3 joueurs connectés, l'hôte clique sur **Lancer la partie**.

### Arrêter et mettre à jour

- Arrêter le serveur : `Ctrl + C` dans le terminal.
- Récupérer la dernière version :
  ```bash
  git pull
  npm install
  npm start
  ```

> Les parties sont gardées en mémoire : arrêter le serveur termine les parties en cours.

---

## 2. Jouer à plusieurs sur ton réseau (Wi-Fi)

Les navigateurs n'autorisent la caméra et le micro qu'en **HTTPS**. Pour que ton téléphone ou d'autres PC puissent se connecter, lance le serveur en HTTPS :

**Windows (PowerShell)**
```powershell
$env:HTTPS=1; npm start
```

**macOS / Linux**
```bash
HTTPS=1 npm start
```

Le terminal affiche l'adresse à donner aux autres, par exemple :

```
Loup-Garou : https://localhost:3000
  sur le réseau : https://192.168.1.20:3000
```

1. Sur chaque appareil (connecté au même Wi-Fi), ouvre l'adresse **https://192.168.1.20:3000** (la tienne).
2. Le navigateur affiche un avertissement, car le certificat est fabriqué par ton PC :
   - Chrome / Edge : **Paramètres avancés** → **Continuer vers le site**
   - Safari (iPhone) : **Afficher les détails** → **Visiter ce site web** → confirmer
3. Sous Windows, si une fenêtre du pare-feu demande l'accès pour Node.js, clique sur **Autoriser** (réseaux privés).

> Ce mode relie chaque navigateur directement aux autres : confortable jusqu'à environ 8 joueurs. Au-delà, ou avec des amis hors de chez toi, passe au VPS (partie 3).

---

## 3. Mettre en ligne sur un VPS (OVH)

Pour jouer avec des amis où qu'ils soient, et à nombreux. Le script installe tout :
- le site ;
- **LiveKit**, le serveur vidéo : chacun n'envoie sa vidéo qu'une fois, le serveur la redistribue (15 joueurs et plus) ;
- un **relais TURN** pour les joueurs en 4G ou derrière une box stricte ;
- le **HTTPS automatique** (certificat Let's Encrypt gratuit, renouvelé tout seul).

### Étape 1 — Commander le VPS

Chez OVH, un **VPS-1** suffit. À la commande, choisis l'image **Ubuntu 24.04**.

Tu reçois un e-mail avec :
- le **nom du serveur**, du type `vps-1234abcd.vps.ovh.net` ;
- l'**utilisateur** (en général `ubuntu`) et le **mot de passe**.

### Étape 2 — Se connecter au VPS

Depuis ton PC (PowerShell sous Windows, Terminal sous macOS) :

```bash
ssh ubuntu@vps-1234abcd.vps.ovh.net
```

Tape `yes` à la première connexion, puis le mot de passe reçu (il ne s'affiche pas pendant la saisie, c'est normal). Passe ensuite administrateur :

```bash
sudo -i
```

### Étape 3 — Installer

Remplace `vps-1234abcd.vps.ovh.net` par le nom de **ton** serveur :

```bash
apt update && apt install -y git
git clone https://github.com/basthaly/Loup-Garou
cd Loup-Garou/deploy
./install.sh vps-1234abcd.vps.ovh.net
```

L'installation prend quelques minutes (Docker, puis le site). À la fin :

```
✔ Loup-Garou est en ligne : https://vps-1234abcd.vps.ovh.net
```

### Étape 4 — Jouer

Ouvre **https://vps-1234abcd.vps.ovh.net** et partage le lien avec tes amis. Le premier chargement peut prendre une minute, le temps d'obtenir le certificat HTTPS.

### Commandes utiles sur le VPS

Toujours depuis le dossier `Loup-Garou/deploy` (après `ssh` puis `sudo -i`, tape `cd Loup-Garou/deploy`) :

| Pour… | Commande |
| --- | --- |
| Mettre à jour vers la dernière version | `./update.sh` |
| Voir ce qui se passe (journaux) | `docker compose logs -f app` (quitter avec `Ctrl + C`) |
| Redémarrer | `docker compose restart` |
| Tout arrêter | `docker compose down` |
| Relancer après un arrêt | `docker compose up -d` |

### Utiliser ton propre nom de domaine (facultatif)

1. Chez ton registrar, crée un enregistrement DNS **A** qui pointe vers l'IP du VPS (indiquée dans l'e-mail OVH).
2. Attends quelques minutes, puis relance : `./install.sh mon-domaine.fr`

### Pare-feu

Par défaut, un VPS OVH n'a pas de pare-feu actif : rien à faire. Si tu en actives un, ouvre ces ports (le script le fait déjà pour `ufw`) :

- TCP : 80, 443, 7443, 7881
- UDP : 3478, 30000-30200, 50000-50200

---

## 4. Dépannage

| Problème | Solution |
| --- | --- |
| « Le micro et la caméra demandent une connexion sécurisée » | Ouvre le site en `https://` (partie 2), ou sur `localhost`. |
| Caméra ou micro refusés | Autorise-les dans les réglages du site (icône à gauche de l'adresse) ou dans les réglages du téléphone, puis recharge la page. |
| On n'entend pas les autres sur iPhone | Touche l'écran une fois : Safari attend une action avant de jouer le son. |
| J'ai fermé l'onglet en pleine partie | Rouvre le site : **Reprendre ma partie**. Sinon, **Rejoindre avec un code** puis touche ton nom dans « Reconnexion ». |
| « Code de partie inconnu » | Le serveur a redémarré : les parties en cours sont perdues, crée un nouveau salon. |
| L'hôte est parti | Un autre joueur connecté devient hôte automatiquement (après 15 secondes s'il a juste perdu la connexion). |
| Le site ne s'ouvre pas sur le VPS | Vérifie les journaux : `docker compose logs -f`. Le certificat peut mettre une minute à arriver la première fois. |
| Vidéo noire ou coupée pour certains joueurs (VPS) | Vérifie que les ports UDP sont ouverts si tu as activé un pare-feu (voir plus haut). |

---

## 5. Fonctionnalités

**Partie**
- Salon avec code à 4 lettres et lien d'invitation.
- Maître du jeu : le site (automatique) ou un joueur, qui voit tout et ne joue pas.
- Rôles distribués automatiquement selon le nombre de joueurs (modifiables par l'hôte), ou choisis par vote des joueurs.
- Votes secrets (village, Capitaine, loups), révélés tous en même temps.
- On joue en touchant directement les visages ; la barre du bas regroupe sa caméra, son rôle, le micro, la caméra et l'action à valider.
- L'hôte peut exclure un joueur ou arrêter la partie ; si l'hôte part, la main passe à un autre joueur.
- Mode clair / sombre au choix ; la nuit et le jour nuancent seulement les teintes.

**Rôles disponibles**
Loup-Garou, Simple Villageois, Voyante, Sorcière, Chasseur, Cupidon, Petite Fille, Capitaine, Ancien, Salvateur, Idiot du village, Bouc émissaire.
Si l'Ancien est éliminé par le village, les villageois perdent leurs pouvoirs.
Affichés « Bientôt » : Voleur, Joueur de flûte et rôles de l'extension Personnages.

**Caméra et micro** (indépendants : on peut parler sans se montrer)
- Salon et jour : tout le monde se voit et s'entend.
- Nuit : les joueurs endormis ne voient plus personne ; les rôles réveillés voient tout le monde, et les loups s'entendent entre eux.
- Petite Fille : pendant le tour des loups, elle voit tout le village flou, sans le son.
- Morts : ils voient et entendent tout, mais ne parlent plus qu'aux autres morts.

---

## 6. Pour les développeurs

### Structure

| Chemin | Rôle |
| --- | --- |
| `server/game.js` | Moteur : phases, étapes, votes, morts, victoire, règles audio/vidéo |
| `server/roles.js` | Rôles et composition automatique |
| `server/index.js` | Serveur web et Socket.IO |
| `server/livekit.js` | Jetons et permissions du serveur vidéo |
| `public/app.js` | Interface |
| `public/media.js` | Micro et caméra (LiveKit ou maillage direct) |
| `deploy/` | Installation sur VPS : Docker Compose, LiveKit, Caddy |
| `test/` | Tests (`npm test`) |
| `maquette/` | Maquettes Claude Design |

### Tests

```bash
npm test
```

Vérifie les règles (vidéo de nuit, Chasseur, Ancien, exclusion, reconnexion, départ de l'hôte, fin de partie), puis simule 18 parties complètes jouées par des bots.

### Variables d'environnement

| Variable | Effet | Défaut |
| --- | --- | --- |
| `PORT` | Port du serveur | `3000` |
| `HTTPS` | `1` = HTTPS avec certificat auto-signé (réseau local) | désactivé |
| `MIN_PLAYERS` | Nombre minimum de joueurs | `3` |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Active la vidéo via LiveKit | maillage direct |
| `ICE_SERVERS` | Serveurs STUN/TURN (JSON) pour le maillage direct | STUN Google |

### Tester LiveKit en local (facultatif, avec Docker Desktop)

```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server:v1.8.4 --dev --bind 0.0.0.0 --node-ip 127.0.0.1
```

Puis, dans un autre terminal (PowerShell) :

```powershell
$env:LIVEKIT_URL="ws://localhost:7880"; $env:LIVEKIT_API_KEY="devkey"; $env:LIVEKIT_API_SECRET="secret"; npm start
```

Le serveur doit afficher `vidéo : LiveKit`. Les versions du serveur LiveKit (`v1.8.4`) et de `livekit-client` (`2.9.9`) sont figées ensemble : les mettre à jour en même temps.
