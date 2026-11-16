// Simule des parties complètes avec des bots (npm test).
process.env.LG_FAST = '1';
process.env.MIN_PLAYERS = '3';
const { io } = require('socket.io-client');
const { server } = require('../server/index');

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const emit = (s, ev, data) => new Promise((res) => s.emit(ev, data, res));

function bot(url) {
  const s = io(url, { transports: ['websocket'], forceNew: true });
  s.view = null;
  s.errors = [];
  s.lastKey = null;
  s.on('state', (v) => { s.view = v; react(s); });
  return s;
}

function react(s) {
  const v = s.view;
  if (!v) return;
  if (v.me.canControl && v.room.waitingMJ && s.isMJBot) {
    setTimeout(() => s.emit('control', {}, () => {}), 5);
  }
  const st = v.step;
  if (!st || st.resolved || !st.isActor || st.submitted) return;
  const key = `${st.type}:${st.round}:${st.deadline}`;
  if (s.lastKey === key) return;
  s.lastKey = key;
  const alive = v.players.filter((p) => p.alive && !p.isMJ);
  const others = alive.filter((p) => p.id !== v.me.id);
  let payload = {};
  switch (st.type) {
    case 'compoVote': payload = { roles: ['voyante', 'sorciere', 'chasseur', 'cupidon', 'salvateur', 'ancien', 'idiot', 'bouc', 'voleur', 'flute', 'loupblanc', 'grandloup', 'infect', 'enfant', 'renard', 'soeur', 'chevalier', 'ange', 'petitefille'].filter(() => Math.random() < 0.6) }; break;
    case 'cupidon': { const a = [...alive].sort(() => Math.random() - 0.5); payload = { targets: [a[0].id, a[1].id] }; break; }
    case 'salvateur': payload = { target: rnd(alive.filter((p) => p.id !== st.lastProtected)).id }; break;
    case 'voyante': payload = { target: rnd(others).id }; break;
    case 'loups': case 'grandloup': case 'enfant': payload = { target: rnd(st.options) }; break;
    case 'renard': payload = { target: Math.random() < 0.2 ? null : rnd(st.options) }; break;
    case 'loupblanc': payload = { target: Math.random() < 0.5 || !st.options.length ? null : rnd(st.options) }; break;
    case 'flute': payload = { targets: [...st.options].sort(() => Math.random() - 0.5).slice(0, 2) }; break;
    case 'voleur': payload = { take: st.mustTake || Math.random() < 0.6 ? Math.floor(Math.random() * 2) : null }; break;
    case 'infect': payload = { infect: Math.random() < 0.5 }; break;
    case 'soeurs': payload = {}; break;
    case 'n_double': case 'n_voleur': payload = { target: rnd(st.options) }; break;
    case 'n_voyante': payload = Math.random() < 0.5 ? { center: [0, 2] } : { target: rnd(st.options) }; break;
    case 'n_noiseuse': payload = Math.random() < 0.2 ? { targets: null } : { targets: [...st.options].sort(() => Math.random() - 0.5).slice(0, 2) }; break;
    case 'n_soulard': payload = { center: Math.floor(Math.random() * 3) }; break;
    case 'n_loups': payload = st.lone ? { center: 1 } : {}; break;
    case 'n_sbire': case 'n_macons': case 'n_insomniaque': payload = {}; break;
    case 'sorciere': payload = { save: Math.random() < 0.5, kill: st.potions && st.potions.death && Math.random() < 0.3 ? rnd(others).id : null }; break;
    case 'captain_vote': payload = { target: rnd(alive).id }; break;
    case 'vote': payload = { target: Math.random() < 0.1 ? null : rnd(others).id }; break;
    case 'hunter': case 'successor': payload = { target: rnd(alive).id }; break;
  }
  setTimeout(() => s.emit('act', payload, (r) => { if (!r.ok) s.errors.push(`${st.type}: ${r.error}`); }), Math.random() * 10);
}

async function game(url, n, opts) {
  const host = bot(url);
  await new Promise((r) => host.on('connect', r));
  const c = await emit(host, 'create', { name: 'Bot0', game: opts.game });
  if (!c.ok) throw new Error(c.error);
  const bots = [host];
  for (let i = 1; i < n; i++) {
    const b = bot(url);
    await new Promise((r) => b.on('connect', r));
    const j = await emit(b, 'join', { code: c.code, name: 'Bot' + i });
    if (!j.ok) throw new Error(j.error);
    bots.push(b);
  }
  await new Promise((r) => setTimeout(r, 50));
  const patch = opts.game === 'onenight' ? {} : { distribution: opts.vote ? 'vote' : 'auto' };
  if (opts.mj) { patch.mjMode = 'joueur'; patch.mjId = bots[n - 1].view.me.id; bots[n - 1].isMJBot = true; }
  const st = await emit(host, 'settings', patch);
  if (!st.ok) throw new Error(st.error);
  if (opts.preset !== undefined) { const r = await emit(host, 'preset', { index: opts.preset }); if (!r.ok) throw new Error(r.error); }
  for (const role of opts.roles || []) {
    const r = await emit(host, 'compo', { role, delta: 1 });
    if (!r.ok) throw new Error(`${role} : ${r.error}`);
  }
  // Trop de cartes : on retire des rôles de base, comme le ferait l'hôte.
  for (const role of ['bouc', 'idiot', 'ancien', 'petitefille', 'salvateur', 'cupidon', 'chasseur', 'sorciere', 'voyante', 'loup']) {
    await new Promise((r) => setTimeout(r, 20));
    const v = host.view;
    const size = Object.values(v.compo).reduce((a, b) => a + b, 0);
    if (size <= v.expectedCards) break;
    if (v.compo[role] && !(opts.roles || []).includes(role)) await emit(host, 'compo', { role, delta: -1 });
  }
  const go = await emit(host, 'start', {});
  if (!go.ok) throw new Error(go.error);
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    await new Promise((r) => setTimeout(r, 50));
    if (host.view && host.view.room.phase === 'end') break;
  }
  const v = host.view;
  const errors = bots.flatMap((b) => b.errors);
  bots.forEach((b) => b.close());
  if (v.room.phase !== 'end') throw new Error(`Partie bloquée (phase ${v.room.phase}, étape ${v.step && v.step.type})`);
  return { winner: v.room.winner.team, nights: v.room.night, errors };
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}`;
  const results = {};
  let errors = 0;
  const cases = [];
  for (let n = 6; n <= 16; n += 2) cases.push([n, {}], [n, { vote: true }], [n + 1, { mj: true }]);
  // Parties avec les rôles des extensions (composition choisie par l'hôte).
  const extra = [
    ['voleur', 'flute', 'loupblanc'], ['grandloup', 'infect', 'enfant', 'renard'], ['soeur', 'chevalier', 'ange', 'voleur'],
    ['loupblanc', 'infect', 'flute', 'soeur', 'renard', 'chevalier'], ['ange', 'enfant', 'grandloup', 'voleur', 'flute']
  ];
  for (let rep = 0; rep < 4; rep++) extra.forEach((roles, i) => cases.push([8 + ((i + rep) % 5) * 2, { roles }]));
  // Loup-Garou pour une nuit : chaque nombre de joueurs, les deux decks proposés.
  for (let n = 3; n <= 10; n++) cases.push([n, { game: 'onenight', preset: 0 }], [n, { game: 'onenight', preset: 1 }]);
  for (const [n, opts] of cases) {
    const r = await game(url, n, opts);
    results[r.winner] = (results[r.winner] || 0) + 1;
    if (r.errors.length) { errors += r.errors.length; console.log(`  ${n} joueurs ${JSON.stringify(opts)} :`, r.errors.slice(0, 3)); }
    console.log(`OK ${n} joueurs ${JSON.stringify(opts)} → ${r.winner} en ${r.nights} nuit(s)`);
  }
  console.log('Victoires :', results, '| erreurs bots :', errors);
  server.close();
  process.exit(errors ? 1 : 0);
})().catch((e) => { console.error('ÉCHEC :', e.message); process.exit(1); });
