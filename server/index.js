const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const { Room } = require('./game');
const { ROLES, RULES, EXTENSIONS } = require('./roles');
const ON = require('./onenight');
const Bots = require('./bots');
const { ROLES: TH_ROLES } = require('./roles');
const LK = require('./livekit');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const USE_HTTPS = process.env.HTTPS === '1';
const app = express();
const server = USE_HTTPS ? https.createServer(loadCert(), app) : http.createServer(app);
const io = new Server(server);

// Serveurs STUN/TURN transmis aux navigateurs (ICE_SERVERS = JSON pour ajouter un TURN).
let ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
try { if (process.env.ICE_SERVERS) ICE_SERVERS = JSON.parse(process.env.ICE_SERVERS); } catch (e) { console.warn('ICE_SERVERS invalide, ignoré.'); }

// HTTPS : la caméra n'est autorisée par les navigateurs qu'en HTTPS (ou sur localhost).
// Certificat auto-signé généré une fois dans ./certs (le navigateur affichera un avertissement à accepter).
function loadCert() {
  const dir = path.join(__dirname, '..', 'certs');
  const keyFile = path.join(dir, 'key.pem');
  const certFile = path.join(dir, 'cert.pem');
  if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
    const selfsigned = require('selfsigned');
    const pems = selfsigned.generate([{ name: 'commonName', value: 'loup-garou.local' }], { days: 825, keySize: 2048 });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(keyFile, pems.private);
    fs.writeFileSync(certFile, pems.cert);
  }
  return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
}

app.use(express.static(path.join(__dirname, '..', 'public')));
// Page de test cachée (aucun lien) : choisir son rôle et jouer avec des faux joueurs. TEST_PAGE=0 la désactive.
app.get('/audio', (req, res) => {
  if (process.env.TEST_PAGE === '0') return res.status(404).end();
  res.sendFile(path.join(__dirname, '..', 'public', 'audio.html'));
});
app.get('/test', (req, res) => {
  if (process.env.TEST_PAGE === '0') return res.status(404).end();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.use('/vendor', express.static(path.join(__dirname, '..', 'node_modules', 'livekit-client', 'dist')));
app.get('/api/roles', (req, res) => res.json({ roles: Object.assign({}, ROLES, ON.ROLES), rules: RULES, rulesByGame: { thiercelieux: RULES, onenight: ON.RULES }, extensions: Object.assign({}, EXTENSIONS, { onenight: 'Loup-Garou pour une nuit' }), iceServers: ICE_SERVERS, video: LK.enabled ? 'livekit' : 'mesh' }));
const connectedCount = () => [...rooms.values()].reduce((n, r) => n + [...r.players.values()].filter((p) => p.connected).length, 0);
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size, players: connectedCount() }));

// Qui est connecté ? Réservé au serveur lui-même (deploy/who.sh) : jamais via Internet.
app.get('/admin/who', (req, res) => {
  const ip = req.socket.remoteAddress || '';
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) && !req.headers['x-forwarded-for'];
  if (!local) return res.status(404).end();
  const phase = (r) => ({ lobby: 'Salon', setup: 'Préparation', night: `Nuit ${r.night}`, day: `Jour ${r.day}`, end: 'Fin de partie' }[r.phase] || r.phase);
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "à l'instant" : `il y a ${m} min`; };
  const lines = [`${rooms.size} salon(s), ${connectedCount()} joueur(s) connecté(s)`];
  for (const r of rooms.values()) {
    lines.push('', `Salon ${r.code} · ${phase(r)} · dernière activité ${ago(r.lastActivity)}`);
    for (const id of r.order) {
      const p = r.players.get(id);
      if (!p || p.kicked) continue;
      const tags = [];
      if (id === r.hostId) tags.push('hôte');
      if (r.isMJ(id)) tags.push('MJ');
      if (r.phase !== 'lobby' && !r.isMJ(id)) tags.push(p.alive ? 'vivant' : 'mort');
      if (p.mic) tags.push('micro');
      if (p.cam) tags.push('caméra');
      lines.push(`  ${p.connected ? '●' : '○'} ${p.name}${p.connected ? '' : ' (déconnecté)'}${tags.length ? '  · ' + tags.join(', ') : ''}`);
    }
  }
  res.type('text/plain; charset=utf-8').send(lines.join('\n') + '\n');
});

const rooms = new Map();          // code -> Room
const sockets = new Map();        // socket.id -> { code, playerId }

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// Envoie à chaque joueur connecté sa propre vue de la partie.
function broadcast(room) {
  LK.sync(room);
  for (const [sid, info] of sockets) {
    if (info.code !== room.code) continue;
    const s = io.sockets.sockets.get(sid);
    const v = room.viewFor(info.playerId);
    if (s && v) s.emit('state', v);
  }
}

function attach(socket, room, player) {
  sockets.set(socket.id, { code: room.code, playerId: player.id });
  socket.join(room.code);
  player.connected = true;
  player.conn = crypto.randomBytes(4).toString('hex'); // change à chaque connexion : les autres recréent la liaison vidéo
  broadcast(room);
}

function current(socket) {
  const info = sockets.get(socket.id);
  if (!info) throw new Error("Tu n'es dans aucune partie.");
  const room = rooms.get(info.code);
  if (!room) throw new Error("Cette partie n'existe plus.");
  return { room, id: info.playerId };
}

// Enveloppe : exécute l'action et renvoie {ok} ou {error} au client.
function handle(fn) {
  return (data, ack) => {
    if (typeof data === 'function') { ack = data; data = {}; }
    try {
      const out = fn(data || {});
      if (typeof ack === 'function') ack(Object.assign({ ok: true }, out || {}));
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  };
}

io.on('connection', (socket) => {
  socket.on('create', handle(({ name, game }) => {
    const code = newCode();
    const room = game === 'onenight' ? new ON.OneNightRoom(code, broadcast) : new Room(code, broadcast);
    rooms.set(code, room);
    const p = room.addPlayer(name);
    attach(socket, room, p);
    return { code, token: p.token };
  }));

  socket.on('createTest', handle((o) => {
    if (process.env.TEST_PAGE === '0') throw new Error('Page de test désactivée.');
    const one = o.game === 'onenight';
    const defs = one ? ON.ROLES : TH_ROLES;
    if (!defs[o.role]) throw new Error('Choisis ton rôle.');
    const min = one ? 2 : 3, max = one ? 9 : 17;
    const bots = Math.min(max, Math.max(min, parseInt(o.bots, 10) || min));
    const code = newCode();
    const room = one ? new ON.OneNightRoom(code, (r) => { broadcast(r); Bots.drive(r); }) : new Room(code, (r) => { broadcast(r); Bots.drive(r); });
    if (!one) room.settings.extensions = { nouvelleLune: true, personnages: true };
    room.speed = { 1: 1, 2: 0.4, 3: 0.15 }[o.speed] || 1;
    const me = room.addPlayer(String(o.name || 'Testeur').slice(0, 20) || 'Testeur');
    for (let i = 0; i < bots; i++) { const b = room.addPlayer(Bots.NAMES[i]); b.bot = true; b.connected = true; }
    const lover = !one && o.lover && o.lover !== 'non' ? (['loup', 'village'].includes(o.lover) ? o.lover : 'any') : null;
    room.test = { me: me.id, roles: { [me.id]: o.role }, reveal: !!o.reveal, auto: o.auto !== false, lover };
    if (lover && o.role !== 'cupidon') o.extra = [...(Array.isArray(o.extra) ? o.extra : []), 'cupidon'];
    // Composition : celle d'origine, avec ton rôle et les rôles demandés (les villageois s'ajustent).
    room.customCompo = Object.assign({}, room.effectiveCompo());
    for (const r of [o.role, ...(Array.isArray(o.extra) ? o.extra : [])]) {
      if (defs[r] && !(room.customCompo[r] > 0)) room.changeCompo(me.id, r, 1);
    }
    // Trop de cartes : on retire des rôles non demandés (les moins importants d'abord).
    const asked = new Set([o.role, ...(Array.isArray(o.extra) ? o.extra : [])]);
    const order = one ? ['n_villageois', 'n_insomniaque', 'n_soulard', 'n_macon', 'n_sbire', 'n_noiseuse', 'n_voleur', 'n_voyante', 'n_loup']
      : ['bouc', 'idiot', 'ancien', 'petitefille', 'salvateur', 'renard', 'chevalier', 'cupidon', 'chasseur', 'sorciere', 'voyante', 'loup'];
    const size = () => Object.values(room.customCompo).reduce((a, b) => a + b, 0);
    for (const r of order) {
      while (size() > room.cardsNeeded() && room.customCompo[r] > (r === 'loup' || r === 'n_loup' ? 1 : 0) && !asked.has(r)) room.changeCompo(me.id, r, -1);
    }
    try { room.start(me.id); } catch (e) { throw new Error(`${e.message} Ajoute des faux joueurs ou retire des rôles.`); }
    rooms.set(code, room);
    attach(socket, room, me);
    return { code, token: me.token };
  }));

  socket.on('join', handle(({ code, name }) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) throw new Error('Code de partie inconnu.');
    const p = room.addPlayer(name);
    attach(socket, room, p);
    return { code: room.code, token: p.token };
  }));

  // Écran « Rejoindre » : état du salon et joueurs déconnectés dont on peut reprendre la place.
  socket.on('roomInfo', handle(({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) throw new Error('Code de partie inconnu.');
    return { info: room.publicInfo() };
  }));

  socket.on('reclaim', handle(({ code, playerId }) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) throw new Error('Code de partie inconnu.');
    const p = room.reclaim(playerId);
    attach(socket, room, p);
    return { code: room.code, token: p.token };
  }));

  socket.on('kick', handle(({ id: target }) => {
    const { room, id } = current(socket);
    if (id !== room.hostId && !room.isMJ(id)) throw new Error("Seul l'hôte peut exclure un joueur.");
    if (id === target) throw new Error("Tu ne peux pas t'exclure toi-même.");
    // On déconnecte d'abord l'exclu, puis on met à jour la partie.
    for (const [sid, info] of sockets) {
      if (info.code === room.code && info.playerId === target) {
        const s = io.sockets.sockets.get(sid);
        sockets.delete(sid);
        if (s) { s.leave(room.code); s.emit('kicked'); }
      }
    }
    room.kick(id, target);
    LK.kick(room, target);
    broadcast(room);
  }));

  socket.on('lkToken', async (data, ack) => {
    try {
      if (!LK.enabled) throw new Error('Vidéo LiveKit non configurée.');
      const { room, id } = current(socket);
      ack(Object.assign({ ok: true }, await LK.token(room, room.players.get(id))));
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  socket.on('resume', handle(({ code, token }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) throw new Error("Cette partie n'existe plus.");
    const p = room.byToken(token);
    if (!p || p.kicked) throw new Error('Session expirée.');
    attach(socket, room, p);
    return { code: room.code };
  }));

  socket.on('leave', handle(() => {
    const { room, id } = current(socket);
    sockets.delete(socket.id);
    socket.leave(room.code);
    if (room.phase === 'lobby') room.removePlayer(id);
    else { const p = room.players.get(id); if (p) p.connected = false; if (!room.ensureHost()) broadcast(room); }
  }));

  socket.on('settings', handle((patch) => { const { room, id } = current(socket); room.updateSettings(id, patch); }));
  socket.on('compo', handle(({ role, delta }) => { const { room, id } = current(socket); room.changeCompo(id, role, delta); }));
  // Changer de jeu sans recréer le salon : mêmes joueurs, même code, même hôte.
  socket.on('switchGame', handle(({ game }) => {
    const { room, id } = current(socket);
    if (id !== room.hostId) throw new Error("Seul l'hôte peut changer de jeu.");
    if (room.phase !== 'lobby') throw new Error('Termine la partie avant de changer de jeu.');
    if (room.game === game || !['thiercelieux', 'onenight'].includes(game)) return {};
    const next = game === 'onenight' ? new ON.OneNightRoom(room.code, broadcast) : new Room(room.code, broadcast);
    const players = [...room.players.values()];
    if (game === 'onenight' && players.length > 10) throw new Error('Loup-Garou pour une nuit : 10 joueurs maximum.');
    clearTimeout(room.timer);
    for (const p of players) {
      Object.assign(p, { alive: true, role: null, lover: null, seen: {}, death: null, card: null, startRole: null, known: {}, knownCenter: {}, knownSelf: null });
      next.players.set(p.id, p);
    }
    next.order = room.order.slice();
    next.hostId = room.hostId;
    next.resetGame();
    next.addLog(`Jeu choisi : ${game === 'onenight' ? 'Loup-Garou pour une nuit' : 'Loup-Garou de Thiercelieux'}.`, true);
    rooms.set(room.code, next);
    broadcast(next);
    return {};
  }));
  socket.on('preset', handle(({ index }) => { const { room, id } = current(socket); if (!room.applyPreset) throw new Error('Pas de deck pour ce jeu.'); room.applyPreset(id, index); }));
  socket.on('compoReset', handle(() => { const { room, id } = current(socket); room.resetCompo(id); }));
  socket.on('start', handle(() => { const { room, id } = current(socket); room.start(id); }));
  socket.on('act', handle((payload) => { const { room, id } = current(socket); room.act(id, payload); }));
  socket.on('control', handle(() => { const { room, id } = current(socket); room.control(id); }));
  socket.on('media', handle((m) => { const { room, id } = current(socket); room.setMedia(id, m); }));

  // Relais de signalisation WebRTC entre deux joueurs du même salon.
  socket.on('rtc', (msg) => {
    const info = sockets.get(socket.id);
    if (!info || !msg || typeof msg.to !== 'string') return;
    for (const [sid, other] of sockets) {
      if (other.code === info.code && other.playerId === msg.to) {
        const s = io.sockets.sockets.get(sid);
        if (s) s.emit('rtc', { from: info.playerId, data: msg.data });
      }
    }
  });

  socket.on('giveHost', handle(({ id: target }) => { const { room, id } = current(socket); room.transferHost(id, target); }));
  socket.on('abort', handle(() => { const { room, id } = current(socket); room.abort(id); }));
  socket.on('restart', handle(() => { const { room, id } = current(socket); room.restart(id); }));

  socket.on('disconnect', () => {
    const info = sockets.get(socket.id);
    sockets.delete(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room) return;
    const stillHere = [...sockets.values()].some((s) => s.code === info.code && s.playerId === info.playerId);
    const p = room.players.get(info.playerId);
    if (p && !stillHere) {
      p.connected = false;
      broadcast(room);
      // Hôte ou MJ déconnecté : on lui laisse 15 s pour revenir (rechargement de page), puis on passe la main.
      setTimeout(() => { if (rooms.get(info.code) === room && !p.connected) room.ensureHost(); }, 15000);
    }
  });
});

// Ménage : supprime les salons inactifs depuis 6 h.
setInterval(() => {
  const limit = Date.now() - 6 * 3600 * 1000;
  for (const [code, room] of rooms) {
    if (room.lastActivity < limit) { clearTimeout(room.timer); rooms.delete(code); }
  }
}, 15 * 60 * 1000).unref();

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    const proto = USE_HTTPS ? 'https' : 'http';
    console.log(`Loup-Garou : ${proto}://localhost:${PORT}`);
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  sur le réseau : ${proto}://${a.address}:${PORT}`);
    }
    console.log(`  vidéo : ${LK.enabled ? 'LiveKit' : 'maillage direct (sans serveur vidéo)'}`);
    if (!USE_HTTPS) console.log('  (caméra/micro : OK sur localhost ; pour les autres appareils, lance avec HTTPS=1)');
  });
}

module.exports = { server, rooms };
