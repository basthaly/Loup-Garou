// Vidéo via LiveKit (serveur vidéo SFU) : chacun envoie sa vidéo une seule fois au serveur,
// qui la redistribue. Indispensable au-delà d'environ 8 joueurs et hors réseau local.
// Activé si LIVEKIT_URL, LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont définis ; sinon, maillage direct.
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

const PUBLIC_URL = process.env.LIVEKIT_URL || '';                       // ex. wss://mon-vps:7443
const API_URL = process.env.LIVEKIT_HOST || PUBLIC_URL.replace(/^ws/, 'http'); // ex. http://127.0.0.1:7880
const KEY = process.env.LIVEKIT_API_KEY || '';
const SECRET = process.env.LIVEKIT_API_SECRET || '';
const enabled = !!(PUBLIC_URL && KEY && SECRET);
const svc = enabled ? new RoomServiceClient(API_URL, KEY, SECRET) : null;
const granted = new Map(); // "salon:joueur" -> droit d'abonnement accordé

// Un joueur qui ne doit rien voir ni entendre (il dort) perd le droit de s'abonner,
// côté serveur : même un navigateur modifié ne recevra aucune vidéo.
function mayReceive(room, p) {
  if (room.phase === 'lobby') return true;
  for (const other of room.players.values()) {
    if (other.id === p.id) continue;
    const r = room.mediaAllowed(other, p);
    if (r.audio || r.video) return true;
  }
  return false;
}

async function token(room, player) {
  const can = mayReceive(room, player);
  const at = new AccessToken(KEY, SECRET, { identity: player.id, name: player.name, ttl: '8h' });
  at.addGrant({ roomJoin: true, room: room.code, canPublish: true, canSubscribe: can, canPublishData: false });
  granted.set(`${room.code}:${player.id}`, can);
  return { url: PUBLIC_URL, token: await at.toJwt() };
}

function sync(room) {
  if (!enabled) return;
  for (const p of room.players.values()) {
    if (!p.connected) continue;
    const key = `${room.code}:${p.id}`;
    const want = mayReceive(room, p);
    if (granted.get(key) === want) continue;
    granted.set(key, want);
    svc.updateParticipant(room.code, p.id, { permission: { canSubscribe: want, canPublish: true, canPublishData: false } })
      .catch(() => granted.delete(key)); // pas encore connecté à LiveKit : on réessaiera au prochain changement
  }
}

function kick(room, id) {
  if (!enabled) return;
  granted.delete(`${room.code}:${id}`);
  svc.removeParticipant(room.code, id).catch(() => {});
}

module.exports = { enabled, token, sync, kick };
