// Mise à jour sans perdre les salons : à l'arrêt du serveur (./update.sh), on enregistre chaque salon
// (code, hôte, réglages, joueurs et leurs jetons de connexion). Au redémarrage, les salons sont recréés
// et les navigateurs s'y reconnectent tout seuls. Une partie en cours n'est pas reprise : retour au salon.
const fs = require('fs');
const path = require('path');

const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'salons.json');
const MAX_AGE = 30 * 60 * 1000; // un fichier plus vieux (serveur resté éteint) est ignoré

function snapshot(rooms) {
  const out = [];
  for (const room of rooms.values()) {
    if (room.test) continue; // pages de test : rien à garder
    const players = room.order.map((id) => room.players.get(id)).filter((p) => p && !p.kicked && !p.bot);
    if (!players.length) continue;
    out.push({
      code: room.code, game: room.game, hostId: room.hostId, settings: room.settings,
      customCompo: room.customCompo, anarchy: !!room.anarchy, inGame: room.phase !== 'lobby',
      players: players.map((p) => ({ id: p.id, token: p.token, name: p.name }))
    });
  }
  return out;
}

function save(rooms) {
  const data = snapshot(rooms);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify({ at: Date.now(), rooms: data }));
  fs.renameSync(FILE + '.tmp', FILE);
  return data.length;
}

// make(game, code) crée un salon vide du bon jeu.
function restore(rooms, make) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return 0; }
  try { fs.renameSync(FILE, FILE + '.old'); } catch { /* lecture seule : tant pis */ }
  if (!raw || !Array.isArray(raw.rooms) || Date.now() - (raw.at || 0) > MAX_AGE) return 0;
  let n = 0;
  for (const r of raw.rooms) {
    if (!r || !r.code || rooms.has(r.code) || !Array.isArray(r.players) || !r.players.length) continue;
    const room = make(r.game, r.code);
    room.settings = Object.assign(room.settings, r.settings || {});
    room.customCompo = r.customCompo || null;
    if (r.anarchy) room.anarchy = true;
    for (const q of r.players) {
      room.players.set(q.id, {
        id: q.id, token: q.token, name: q.name,
        connected: false, alive: true, role: null, lover: null, seen: {}, idiotRevealed: false, ancienHit: false, canVote: true,
        death: null, cam: false, mic: false, conn: null
      });
      room.order.push(q.id);
    }
    room.hostId = room.players.has(r.hostId) ? r.hostId : r.players[0].id;
    if (room.settings.mjId && !room.players.has(room.settings.mjId)) room.settings.mjId = null;
    room.notice = r.inGame ? 'Le site a été mis à jour : la partie a été interrompue, vous êtes de retour au salon.' : 'Le site a été mis à jour.';
    if (r.inGame) room.addLog('Le site a été mis à jour : la partie en cours a été interrompue.', true);
    room.lastActivity = Date.now();
    rooms.set(r.code, room);
    n++;
  }
  return n;
}

module.exports = { save, restore, snapshot, FILE };
