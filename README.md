# Loup-Garou en ligne

Site pour jouer au Loup-Garou entre amis, avec caméras, hébergé sur le NAS Synology (DS220+).

## Fonctionnalités prévues
- Caméra et micro facultatifs pour chaque joueur
- MJ automatique (le site) ou tenu par un joueur
- Rôles distribués automatiquement selon le nombre de joueurs, ou choisis par vote des joueurs
- Joueur mort : entend et voit la partie, micro coupé
- Votes toujours révélés en même temps
- Extensions : jeu de base, Nouvelle Lune, Personnages

## Maquette
Dossier `maquette/` : 7 écrans (salon, composition des rôles, nuit, vote, révélation, mort, tableau de bord MJ).
Fichiers sources Claude Design (`.dc.html`) — version interactive : https://claude.ai/artifact/F92wuHsXrSHCYzJ2pXk17N

## Stack envisagée
- V1 : Node.js + Socket.IO (moteur de jeu temps réel), Docker
- V2 : LiveKit (SFU vidéo) + coturn, vidéo limitée à 360p/480p
- Tests en local d'abord, puis VPS ou NAS (après ajout de RAM)
