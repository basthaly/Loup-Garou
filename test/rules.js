// Tests ciblés des règles (npm test les lance après les parties simulées).
process.env.LG_FAST = '1';
const assert = require('assert');
const { Room } = require('../server/game');

function setup(n, roles) {
  const room = new Room('TEST', () => {});
  const ps = [];
  for (let i = 0; i < n; i++) ps.push(room.addPlayer('J' + i));
  room.customCompo = {};
  roles.forEach((r) => { room.customCompo[r] = (room.customCompo[r] || 0) + 1; });
  room.start(ps[0].id);
  // Distribution déterministe pour le test.
  ps.forEach((p, i) => { p.role = roles[i]; });
  return { room, ps };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1. Le dernier loup est Capitaine et se fait éliminer : la partie se termine, sans élire de successeur.
  {
    const { room, ps } = setup(4, ['loup', 'villageois', 'villageois', 'villageois']);
    room.captainId = ps[0].id;
    room.phase = 'day';
    room.deaths = [];
    room.queue = [];
    room.startStep({ type: 'vote', actors: [], seconds: 60, dynamicActors: true });
    for (const p of ps.slice(1)) room.act(p.id, { target: ps[0].id });
    room.act(ps[0].id, { target: ps[1].id });
    await wait(200);
    assert.strictEqual(room.phase, 'end', 'la partie doit être terminée');
    assert.strictEqual(room.winner.team, 'village');
    console.log('OK  dernier loup Capitaine éliminé → victoire du village, pas de successeur');
  }

  // 2. Nuit, tour des loups : les loups voient tout le monde et s'entendent ; les autres ne voient rien.
  {
    const { room, ps } = setup(6, ['loup', 'loup', 'petitefille', 'villageois', 'villageois', 'voyante']);
    clearTimeout(room.timer);
    room.phase = 'night';
    room.night = 1;
    room.queue = [];
    room.startStep({ type: 'loups', actors: [ps[0].id, ps[1].id] });
    const [w1, w2, pf, v1, , voy] = ps;
    assert.deepStrictEqual(room.mediaAllowed(v1, w1), { audio: false, video: true, blur: false }, 'le loup voit le villageois');
    assert.deepStrictEqual(room.mediaAllowed(w2, w1), { audio: true, video: true, blur: false }, 'les loups se voient et s\'entendent');
    assert.strictEqual(room.mediaAllowed(w1, v1).video, false, 'le villageois ne voit pas le loup');
    assert.strictEqual(room.mediaAllowed(voy, v1).video, false, 'le villageois ne voit personne');
    assert.deepStrictEqual(room.mediaAllowed(w1, pf), { audio: false, video: true, blur: true }, 'Petite Fille : loups floutés');
    v1.alive = false;
    assert.strictEqual(room.mediaAllowed(w1, v1).video, true, 'un mort voit tout');
    assert.strictEqual(room.mediaAllowed(v1, w1).audio, false, 'un mort ne parle pas aux vivants');
    clearTimeout(room.timer);
    console.log('OK  règles vidéo de nuit (loups, dormeurs, Petite Fille, morts)');
  }

  // 3. Exclusion en cours de partie : le joueur meurt, ne bloque pas l'étape, et peut finir la partie.
  {
    const { room, ps } = setup(4, ['loup', 'villageois', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    room.phase = 'day';
    room.queue = [];
    room.startStep({ type: 'vote', actors: [], seconds: 60, dynamicActors: true });
    room.act(ps[1].id, { target: ps[2].id });
    room.act(ps[2].id, { target: ps[1].id });
    room.act(ps[3].id, { target: ps[1].id });
    room.kick(ps[0].id === room.hostId ? ps[0].id : room.hostId, ps[0].id === room.hostId ? ps[1].id : ps[0].id);
    assert.ok(ps[1].kicked && !ps[1].alive, 'joueur exclu et mort');
    assert.throws(() => room.reclaim(ps[1].id), 'un exclu ne peut pas reprendre sa place');
    room.kick(room.hostId, ps[2].id);
    room.kick(room.hostId, ps[3].id);
    assert.strictEqual(room.phase, 'end', 'plus de villageois : fin de partie');
    console.log('OK  exclusion en cours de partie');
  }

  // 4. Reprendre la place d'un joueur déconnecté.
  {
    const room = new Room('TEST', () => {});
    const a = room.addPlayer('Alice');
    const b = room.addPlayer('Bob');
    assert.throws(() => room.reclaim(b.id), 'joueur connecté : refus');
    b.connected = false;
    const old = b.token;
    const p = room.reclaim(b.id);
    assert.ok(p.token !== old, 'nouveau jeton');
    assert.strictEqual(room.publicInfo().players.length, 2);
    assert.ok(a);
    console.log('OK  reprise de la place d\'un joueur déconnecté');
  }
  process.exit(0);
})().catch((e) => { console.error('ÉCHEC :', e.message); process.exit(1); });
