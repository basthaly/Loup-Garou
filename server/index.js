const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const { Room } = require('./game');
const { ROLES, EXTENSIONS } = require('./roles');

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/api/roles', (req, res) => res.json({ roles: ROLES, extensions: EXTENSIONS }));
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));

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
  for (const [sid, info] of sockets) {
    if (info.code !== room.code) continue;
    const s = io.sockets.sockets.get(sid);
    if (s) s.emit('state', room.viewFor(info.playerId));
  }
}

function attach(socket, room, player) {
  sockets.set(socket.id, { code: room.code, playerId: player.id });
  socket.join(room.code);
  player.connected = true;
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
  socket.on('create', handle(({ name }) => {
    const code = newCode();
    const room = new Room(code, broadcast);
    rooms.set(code, room);
    const p = room.addPlayer(name);
    attach(socket, room, p);
    return { code, token: p.token };
  }));

  socket.on('join', handle(({ code, name }) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) throw new Error('Code de partie inconnu.');
    const p = room.addPlayer(name);
    attach(socket, room, p);
    return { code: room.code, token: p.token };
  }));

  socket.on('resume', handle(({ code, token }) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) throw new Error("Cette partie n'existe plus.");
    const p = room.byToken(token);
    if (!p) throw new Error('Session expirée.');
    attach(socket, room, p);
    return { code: room.code };
  }));

  socket.on('leave', handle(() => {
    const { room, id } = current(socket);
    sockets.delete(socket.id);
    socket.leave(room.code);
    if (room.phase === 'lobby') room.removePlayer(id);
    else { const p = room.players.get(id); if (p) p.connected = false; broadcast(room); }
  }));

  socket.on('settings', handle((patch) => { const { room, id } = current(socket); room.updateSettings(id, patch); }));
  socket.on('compo', handle(({ role, delta }) => { const { room, id } = current(socket); room.changeCompo(id, role, delta); }));
  socket.on('compoReset', handle(() => { const { room, id } = current(socket); room.resetCompo(id); }));
  socket.on('start', handle(() => { const { room, id } = current(socket); room.start(id); }));
  socket.on('act', handle((payload) => { const { room, id } = current(socket); room.act(id, payload); }));
  socket.on('control', handle(() => { const { room, id } = current(socket); room.control(id); }));
  socket.on('restart', handle(() => { const { room, id } = current(socket); room.restart(id); }));

  socket.on('disconnect', () => {
    const info = sockets.get(socket.id);
    sockets.delete(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room) return;
    const stillHere = [...sockets.values()].some((s) => s.code === info.code && s.playerId === info.playerId);
    const p = room.players.get(info.playerId);
    if (p && !stillHere) { p.connected = false; broadcast(room); }
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
  server.listen(PORT, () => console.log(`Loup-Garou : http://localhost:${PORT}`));
}

module.exports = { server, rooms };
