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
    case 'compoVote': payload = { roles: ['voyante', 'sorciere', 'chasseur', 'cupidon', 'salvateur', 'ancien', 'idiot', 'bouc'].filter(() => Math.random() < 0.6) }; break;
    case 'cupidon': { const a = [...alive].sort(() => Math.random() - 0.5); payload = { targets: [a[0].id, a[1].id] }; break; }
    case 'salvateur': payload = { target: rnd(alive.filter((p) => p.id !== st.lastProtected)).id }; break;
    case 'voyante': payload = { target: rnd(others).id }; break;
    case 'loups': payload = { target: rnd(alive.filter((p) => !v.me.wolves.includes(p.id))).id }; break;
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
  const c = await emit(host, 'create', { name: 'Bot0' });
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
  const patch = { distribution: opts.vote ? 'vote' : 'auto' };
  if (opts.mj) { patch.mjMode = 'joueur'; patch.mjId = bots[n - 1].view.me.id; bots[n - 1].isMJBot = true; }
  const st = await emit(host, 'settings', patch);
  if (!st.ok) throw new Error(st.error);
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
