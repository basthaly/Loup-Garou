# Loup-Garou en ligne

Jouer au Loup-Garou entre amis, chacun sur son écran, avec caméra et micro. Le site fait le maître du jeu (ou un joueur le fait), distribue les rôles, coupe les caméras la nuit et révèle les votes tous en même temps.

Deux jeux au choix en créant le salon :
- **Loup-Garou de Thiercelieux** : plusieurs nuits, 8 à 18 joueurs conseillés.
- **Loup-Garou pour une nuit** : une seule nuit et un seul vote, de 3 à 10 joueurs, une dizaine de minutes.

**Sommaire**
1. [Tester sur ton PC](#1-tester-sur-ton-pc) (avec Node.js ou avec Docker)
2. [Jouer à plusieurs sur ton réseau (Wi-Fi)](#2-jouer-à-plusieurs-sur-ton-réseau-wi-fi)
3. [Mettre en ligne sur un serveur (VPS ou chez toi)](#3-mettre-en-ligne-sur-un-serveur-vps-ou-chez-toi)
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

### Variante : avec Docker (sans installer Node.js)

1. Installe **Docker Desktop** : https://www.docker.com/products/docker-desktop (Windows ou macOS), puis lance-le.
2. Récupère le projet et démarre le conteneur :
   ```bash
   git clone https://github.com/basthaly/Loup-Garou
   cd Loup-Garou
   docker compose up -d --build
   ```
3. Ouvre **http://localhost:3000**.

| Pour… | Commande (dans le dossier `Loup-Garou`) |
| --- | --- |
| Voir les journaux | `docker compose logs -f` (quitter avec `Ctrl + C`) |
| Arrêter | `docker compose down` |
| Mettre à jour | `git pull` puis `docker compose up -d --build` |

Pour jouer à plusieurs sur ton Wi-Fi avec Docker, ouvre `docker-compose.yml`, enlève le `#` devant `HTTPS: "1"`, puis relance `docker compose up -d --build`. L'adresse à donner est `https://<IP de ton PC>:3000` (voir partie 2 pour trouver l'IP et passer l'avertissement).

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

Le terminal affiche l'adresse à donner aux autres (avec Docker, trouve l'IP de ton PC avec `ipconfig` sous Windows ou `ipconfig getifaddr en0` sous macOS), par exemple :

```
Loup-Garou : https://localhost:3000
  sur le réseau : https://192.168.1.20:3000
```

1. Sur chaque appareil (connecté au même Wi-Fi), ouvre l'adresse **https://192.168.1.20:3000** (la tienne).
2. Le navigateur affiche un avertissement, car le certificat est fabriqué par ton PC :
   - Chrome / Edge : **Paramètres avancés** → **Continuer vers le site**
   - Safari (iPhone) : **Afficher les détails** → **Visiter ce site web** → confirmer
3. Sous Windows, si une fenêtre du pare-feu demande l'accès pour Node.js, clique sur **Autoriser** (réseaux privés).

> Ce mode relie chaque navigateur directement aux autres : confortable jusqu'à environ 8 joueurs. Au-delà, ou avec des amis hors de chez toi, passe à un serveur (partie 3).

---

## 3. Mettre en ligne sur un serveur (VPS ou chez toi)

Pour jouer avec des amis où qu'ils soient, et à nombreux. Le serveur peut être un **VPS** loué (OVH…) ou une **machine chez toi** (VM Proxmox, mini-PC…). Le script installe tout :
- le site ;
- **LiveKit**, le serveur vidéo : chacun n'envoie sa vidéo qu'une fois, le serveur la redistribue (15 joueurs et plus) ;
- un **relais TURN** pour les joueurs en 4G ou derrière une box stricte ;
- le **HTTPS automatique** (certificat Let's Encrypt gratuit, renouvelé tout seul).

### Étape 1 — Préparer le serveur

Il faut une machine sous **Ubuntu 24.04** (2 cœurs, 2 Go de RAM et 10 Go de disque suffisent), joignable depuis Internet.

**Cas A — un VPS (ex. OVH VPS-1)**

À la commande, choisis l'image **Ubuntu 24.04**. Tu reçois un e-mail avec :
- l'**adresse IP** du serveur, par exemple `51.210.12.34` (aussi visible dans l'espace client OVH) ;
- l'**utilisateur** (en général `ubuntu`) et le **mot de passe**.

Rien d'autre à faire : un VPS est directement joignable depuis Internet.

**Cas B — une machine chez toi (VM Proxmox, mini-PC…)**

1. Crée la VM avec l'image **Ubuntu Server 24.04** et coche **OpenSSH server** pendant l'installation.
2. Donne-lui une **IP locale fixe** (réservation DHCP dans ta box, ou IP statique dans la VM), par exemple `192.168.1.50`.
3. Dans ta box, **redirige ces ports vers l'IP locale de la VM** :

   | Protocole | Ports | Sert à |
   | --- | --- | --- |
   | TCP | 80, 443 | Site et certificat HTTPS |
   | TCP | 7443, 7881 | Serveur vidéo (signalisation, secours TCP) |
   | UDP | 3478, 30000-30200, 50000-50200 | Vidéo et relais TURN |

4. Ton **IP publique** (celle de ta box) est celle que tes amis utiliseront. Le script la détecte tout seul. Si elle change de temps en temps (fréquent chez les particuliers), utilise plutôt un **DNS dynamique** (le service DynDNS de ta box ou de ton NAS, DuckDNS…) et installe avec ce nom.

> Si les ports 80 et 443 de ta box sont déjà redirigés vers une autre machine (par exemple un NAS qui héberge un autre site), ils ne peuvent pas aller aussi vers la VM. Il faut alors passer par le proxy inversé de cette machine, ou jouer seulement en interne (voir « Jouer seulement sur ton réseau » plus bas).

### Étape 2 — Se connecter au serveur

Depuis ton PC (PowerShell sous Windows, Terminal sous macOS) :

```bash
ssh ubuntu@51.210.12.34
```

Remplace `ubuntu` par ton utilisateur, et `51.210.12.34` par l'IP de **ton** serveur : l'IP du VPS, ou l'IP locale de ta VM (par exemple `192.168.1.50`) si tu es chez toi. Tape `yes` à la première connexion, puis le mot de passe (il ne s'affiche pas pendant la saisie, c'est normal). Passe ensuite administrateur :

```bash
sudo -i
```

### Étape 3 — Installer Docker

Tout tourne dans Docker sur le serveur. Deux façons de l'installer, au choix :

**A. Rapide** (script officiel de Docker) :
```bash
curl -fsSL https://get.docker.com | sh
```

**B. Pas à pas** (dépôt officiel Docker pour Ubuntu) :
```bash
apt update
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Vérifie que Docker fonctionne :
```bash
docker run --rm hello-world
docker compose version
```
Le premier affiche « Hello from Docker! », le second un numéro de version.

> Si tu sautes cette étape, le script de l'étape 4 installe Docker tout seul (méthode A).

### Étape 4 — Installer Loup-Garou

#### Quelle adresse pour le site ?

Le HTTPS est obligatoire (sinon pas de caméra), et un certificat HTTPS gratuit demande un **nom**, pas une IP brute. Trois possibilités :

| Tu veux utiliser… | Commande | Adresse du site |
| --- | --- | --- |
| **Juste l'IP publique** (le plus simple) | `./install.sh` | `https://51-210-12-34.sslip.io` |
| Une IP précise | `./install.sh 51.210.12.34` | `https://51-210-12-34.sslip.io` |
| **Ton nom de domaine** | `./install.sh loupgarou.mon-domaine.fr` | `https://loupgarou.mon-domaine.fr` |

- **Avec l'IP** : le script détecte l'IP publique tout seul (celle de ta box si le serveur est chez toi) et utilise [sslip.io](https://sslip.io), un service gratuit où `51-210-12-34.sslip.io` pointe vers `51.210.12.34`. Rien à configurer.
- **Avec ton domaine** (ou un DNS dynamique) : crée d'abord, chez ton registrar (OVH, Gandi…), un enregistrement DNS **A** qui pointe vers l'IP publique, et attends quelques minutes qu'il soit actif.

**Avec le script (recommandé)** :
```bash
apt update && apt install -y git
git clone https://github.com/basthaly/Loup-Garou
cd Loup-Garou/deploy
./install.sh
```

L'installation prend quelques minutes. À la fin, le script affiche l'adresse du site (et, si le serveur est chez toi, rappelle les ports à rediriger) :

```
✔ Loup-Garou est en ligne : https://51-210-12-34.sslip.io
  Vérifier que tout tourne : ./status.sh
```

**À la main avec Docker Compose** (ce que fait le script, si tu préfères tout contrôler) :
```bash
apt update && apt install -y git
git clone https://github.com/basthaly/Loup-Garou
cd Loup-Garou/deploy

# 1. Fichier de configuration : l'adresse du site (ton IP avec des tirets + .sslip.io, ou ton domaine)
#    et deux clés secrètes générées au hasard
cat > .env <<FIN
DOMAIN=51-210-12-34.sslip.io
LIVEKIT_API_KEY=lg$(openssl rand -hex 6)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
FIN

# 2. Configuration du serveur vidéo à partir du modèle
. ./.env
sed -e "s/__KEY__/$LIVEKIT_API_KEY/" -e "s/__SECRET__/$LIVEKIT_API_SECRET/" livekit.yaml.template > livekit.yaml

# 3. Démarrage des trois conteneurs : le site, LiveKit et Caddy (HTTPS)
docker compose up -d --build
docker compose ps
```
`docker compose ps` doit montrer trois services `running` : `app`, `livekit` et `caddy`.

### Étape 5 — Vérifier que tout tourne

Sur le serveur, dans le dossier `Loup-Garou/deploy` :

```bash
./status.sh
```

Exemple de résultat :

```
Adresse du site : https://51-210-12-34.sslip.io

— En interne (sur ce serveur)
✔ conteneur app démarré
✔ conteneur livekit démarré
✔ conteneur caddy démarré
✔ site : répond (0 partie(s) en cours)
✔ serveur vidéo LiveKit : répond
✔ certificat HTTPS : obtenu

— Depuis l'extérieur (par l'adresse publique)
✔ https://51-210-12-34.sslip.io répond avec un certificat valide
✔ signalisation vidéo https://51-210-12-34.sslip.io:7443 répond

Tout est bon.
```

En cas de ✘, la ligne indique la commande à lancer pour voir l'erreur. Tu peux aussi vérifier à la main :

| Vérification | Commande | Résultat attendu |
| --- | --- | --- |
| Les 3 conteneurs tournent | `docker compose ps` | `app`, `livekit`, `caddy` en `running` |
| Le site répond en interne | `curl http://127.0.0.1:3000/health` | `{"ok":true,"rooms":0}` |
| Le serveur vidéo répond | `curl http://127.0.0.1:7880` | `OK` |
| Le certificat est obtenu | `docker compose logs caddy \| grep -i certificate` | `certificate obtained successfully` |
| Les ports écoutent | `ss -tulpn \| grep -E ':(80\|443\|7443\|7880\|7881\|3478) '` | une ligne par port |

> **Serveur chez toi** : la vérification « depuis l'extérieur » peut échouer depuis le serveur lui-même si ta box ne gère pas le « NAT loopback », alors que tout marche pour tes amis. Le test le plus fiable : ouvre l'adresse du site sur ton téléphone **en 4G** (Wi-Fi coupé).

### Étape 6 — Jouer

Ouvre l'adresse affichée à la fin de l'installation (par exemple **https://51-210-12-34.sslip.io**) et partage le lien avec tes amis. Le premier chargement peut prendre une minute, le temps d'obtenir le certificat HTTPS.

### Commandes utiles sur le serveur

Toujours depuis le dossier `Loup-Garou/deploy` (après `ssh` puis `sudo -i`, tape `cd Loup-Garou/deploy`) :

| Pour… | Commande |
| --- | --- |
| Vérifier que tout tourne | `./status.sh` |
| Voir les salons et les joueurs connectés | `./who.sh` (en continu : `watch -n 5 ./who.sh`) |
| Mettre à jour vers la dernière version | `./update.sh` |
| Voir ce qui se passe (journaux) | `docker compose logs -f app` (quitter avec `Ctrl + C`) |
| Redémarrer | `docker compose restart` |
| Tout arrêter | `docker compose down` |
| Relancer après un arrêt | `docker compose up -d` |

### Passer à ton propre nom de domaine plus tard

1. Chez ton registrar, crée un enregistrement DNS **A** qui pointe vers l'IP publique (celle du VPS, ou de ta box).
2. Attends quelques minutes, puis relance : `./install.sh loupgarou.mon-domaine.fr` (ou, à la main, change `DOMAIN=` dans `.env` puis `docker compose up -d`).

### Pare-feu

Par défaut, un VPS OVH et une VM Ubuntu neuve n'ont pas de pare-feu actif : rien à faire. Si tu en actives un (sur le serveur, ou le pare-feu de Proxmox), ouvre ces ports (le script le fait déjà pour `ufw`) :

- TCP : 80, 443, 7443, 7881
- UDP : 3478, 30000-30200, 50000-50200

### Jouer seulement sur ton réseau (sans accès depuis Internet)

Si tu veux juste jouer chez toi, sans redirection de ports ni nom de domaine, n'utilise pas `install.sh` : lance le site seul en HTTPS auto-signé sur le serveur.

```bash
apt update && apt install -y git
git clone https://github.com/basthaly/Loup-Garou && cd Loup-Garou
sed -i 's/# HTTPS: "1"/HTTPS: "1"/' docker-compose.yml
docker compose up -d --build
```

Ouvre ensuite **https://192.168.1.50:3000** (l'IP locale du serveur) depuis les appareils de ton réseau et accepte l'avertissement du navigateur (voir partie 2). La vidéo passe alors directement entre les navigateurs, sans LiveKit (confortable jusqu'à environ 8 joueurs).

Vérifier que ça tourne : `docker compose ps` et `curl -k https://127.0.0.1:3000/health`.

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
| Le site ne s'ouvre pas sur le serveur | Lance `./status.sh` dans `Loup-Garou/deploy`. Le certificat peut mettre une minute à arriver la première fois. |
| Vidéo noire ou coupée pour certains joueurs | Vérifie que les ports UDP sont ouverts (pare-feu) et, chez toi, redirigés par la box vers le serveur. |
| Certificat HTTPS jamais obtenu | Les ports 80 et 443 doivent arriver jusqu'au serveur depuis Internet (redirection de ports chez toi), et le nom doit pointer vers l'IP publique. |

---

## 5. Fonctionnalités

**Partie**
- Salon avec code à 4 lettres et lien d'invitation.
- Maître du jeu : le site (automatique) ou un joueur, qui voit tout et ne joue pas.
- Rôles distribués automatiquement selon le nombre de joueurs, modifiables par l'hôte.
- Votes secrets (village, Capitaine, loups), révélés tous en même temps. Le vote du village s'ouvre directement (temps réglable) et se clôt dès que tout le monde a voté.
- On joue en touchant directement les visages ; la barre du bas regroupe sa caméra, son rôle, le micro, la caméra et l'action à valider.
- L'hôte peut exclure un joueur, arrêter la partie ou nommer un autre hôte ; s'il part, la main passe automatiquement.
- Quand c'est ton tour : alerte au centre de l'écran, son et vibration (désactivables), titre de l'onglet « ● À toi », bouton d'action qui pulse.
- Bouton « ? » (en haut, ou en touchant son rôle en bas) : comment se joue sa carte, le déroulé d'une partie et les cartes en jeu.
- Indicateur de voix : la vignette de celui qui parle s'entoure de vert, avec des barres qui suivent sa voix.
- Mode clair / sombre au choix ; la nuit et le jour nuancent seulement les teintes.
- Micro et caméra mémorisés : ils se rallument tout seuls à la connexion suivante. Choix du micro et de la caméra dans **Paramètres** (engrenage en haut).
- Deux panneaux : **Rôles** (ou **Deck**) pour la composition, bouton en bas à droite ; **Paramètres** (engrenage en haut) pour le jeu, avec ou sans MJ, les durées, le micro, la caméra, l'apparence et les joueurs.
- On change de jeu depuis le salon (Paramètres), sans recréer de salon : mêmes joueurs, même code.
- Panneaux larges sur ordinateur, plein écran sur téléphone.

**Rôles disponibles** (tous jouables)

| Extension | Rôles |
| --- | --- |
| Jeu de base | Loup-Garou, Simple Villageois, Voyante, Sorcière, Chasseur, Cupidon, Petite Fille, Voleur, Capitaine |
| Nouvelle Lune | Ancien, Salvateur, Idiot du village, Bouc émissaire, Joueur de flûte |
| Personnages | Loup-Garou Blanc, Grand Méchant Loup, Infect Père des Loups, Enfant Sauvage, Renard, Deux Sœurs, Chevalier à l'épée rouillée, Ange |

- Composition : quand l'hôte ajoute un rôle, un Simple Villageois est retiré pour garder le bon nombre de cartes. Le Voleur ajoute 2 cartes au centre, les Sœurs vont par deux.
- Sorcière : le joueur en danger porte un badge, sa potion de vie apparaît sur sa vignette, le poison sur les autres ; bouton Passer.
- Si l'Ancien est éliminé par le village, les villageois perdent leurs pouvoirs.
- Solitaires : le Joueur de flûte gagne quand tous les vivants sont charmés, le Loup-Garou Blanc s'il reste seul, l'Ange s'il est éliminé au premier vote.

**Loup-Garou pour une nuit**

| Camp | Rôles |
| --- | --- |
| Loups | Loup-Garou (×2), Sbire |
| Village | Franc-Maçon (×2), Voyante, Voleur, Noiseuse, Soûlard, Insomniaque, Villageois (×3), Chasseur |
| Autres | Double (prend le camp du rôle copié), Tanneur (gagne s'il est éliminé) |

- Cartes = joueurs + 3. Les 3 cartes du centre sont affichées face cachée, et se retournent quand on les regarde (Voyante, loup seul) puis toutes à la fin.
- Decks prêts à jouer pour chaque nombre de joueurs (2 au choix), ou composition libre.
- Chaque rôle a le même temps la nuit (réglable), qu'il soit joué ou au centre : le temps ne trahit rien.
- Fin de partie : cartes finales et de départ de chacun, gagnants, votes et tout ce qui s'est passé la nuit.

**Ambiance**
- Musique d'ambiance générée par le site pendant la partie : nappe, vent, pluie, gouttes, tonnerre lointain, ruisseau, grillons, grenouilles, hibou, loup lointain, oiseaux (le jour), feu de camp, cloche du village (le jour), et des instruments (harpe, flûte, violoncelle, battement de cœur désactivé par défaut). Volume bas par défaut.
- Bouton note de musique en bas : couper, régler le volume ou retirer le tonnerre, pour soi seulement (mémorisé).
- Les vignettes s'adaptent à la taille de l'écran et au nombre de joueurs.

**Page de test** (cachée, aucun lien) : ouvre `/test` sur le site, par exemple `https://ton-adresse/test`.
- Choisis le jeu, **ton rôle**, le nombre de **faux joueurs** et d'autres rôles à mettre en jeu.
- Les faux joueurs jouent tout seuls (ou pas), les minuteurs peuvent être accélérés, et « Voir tous les rôles » aide à vérifier un cas précis.
- Pratique pour tester seul.

**Page de mixage** (cachée) : `/audio`. Un curseur en dB par son et par instrument (plus la réverbération et la sortie), la nuit et le jour, avec le niveau mesuré en direct, « S » pour écouter seul, « M » pour couper, et « Copier les valeurs ». Les réglages s'appliquent aussi aux parties sur ce navigateur.

Pour désactiver `/test` et `/audio` sur un serveur : variable d'environnement `TEST_PAGE=0`.

**Caméra et micro** (indépendants : on peut parler sans se montrer)
- Salon et jour : tout le monde se voit et s'entend.
- Nuit : les joueurs endormis ne voient plus personne ; les rôles réveillés voient tout le monde, et les loups s'entendent entre eux.
- Petite Fille : pendant le tour des loups, elle voit tout le village flou et entend les loups de loin (voix très déformée et faible, sans savoir qui parle).
- Morts : ils voient et entendent tout, mais ne parlent plus qu'aux autres morts.

---

## 6. Pour les développeurs

### Structure

| Chemin | Rôle |
| --- | --- |
| `server/game.js` | Moteur : phases, étapes, votes, morts, victoire, règles audio/vidéo |
| `server/roles.js` | Rôles et composition automatique |
| `server/onenight.js` | Loup-Garou pour une nuit : rôles, decks, nuit unique, vote, victoire |
| `public/ambience.js` | Musique d'ambiance générée (Web Audio) |
| `server/index.js` | Serveur web et Socket.IO |
| `server/livekit.js` | Jetons et permissions du serveur vidéo |
| `public/app.js` | Interface |
| `public/media.js` | Micro et caméra (LiveKit ou maillage direct) |
| `Dockerfile`, `docker-compose.yml` | Le site seul dans Docker (PC ou serveur) |
| `deploy/` | Installation complète sur serveur : Docker Compose, LiveKit, Caddy, `install.sh`, `status.sh`, `who.sh`, `update.sh` |
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
