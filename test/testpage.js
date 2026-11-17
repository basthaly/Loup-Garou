// Page de test (/test) : chaque rôle peut être imposé au testeur, avec des faux joueurs qui jouent seuls.
process.env.LG_FAST = '1';
const assert = require('assert');
const { io } = require('socket.io-client');
const { server } = require('../server/index');
const { ROLES } = require('../server/roles');
const ON = require('../server/onenight');

const emit = (s, ev, d) => new Promise((r) => s.emit(ev, d, r));
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const cases = [
    ...Object.keys(ROLES).map((role) => ({ game: 'thiercelieux', role, bots: 9 })),
    ...Object.keys(ON.ROLES).map((role) => ({ game: 'onenight', role, bots: 4 })),
    { game: 'thiercelieux', role: 'sorciere', bots: 5, extra: ['voleur', 'soeur', 'ange'] },
    { game: 'onenight', role: 'n_double', bots: 3, extra: ['n_tanneur', 'n_chasseur'] }
  ];
  let ended = 0;
  for (const c of cases) {
    const s = io(url, { transports: ['websocket'], forceNew: true });
    let view = null;
    s.on('state', (v) => { view = v; });
    const r = await emit(s, 'createTest', Object.assign({ name: 'Testeur', auto: true, reveal: true, speed: 3 }, c));
    assert.ok(r.ok, `${c.game}/${c.role} : ${r.error}`);
    await new Promise((res) => setTimeout(res, 50));
    assert.strictEqual(view.me.role, c.role, `${c.role} imposé`);
    assert.ok(view.players.filter((p) => p.bot).length === c.bots);
    // Le testeur ne fait rien : les faux joueurs jouent, les minuteurs font avancer jusqu'à la fin.
    const t0 = Date.now();
    while (view.room.phase !== 'end' && Date.now() - t0 < 20000) {
      if (view.step && view.step.isActor && !view.step.submitted && view.step.type === 'roles_reveal') s.emit('act', {}, () => {});
      await new Promise((res) => setTimeout(res, 50));
    }
    if (view.room.phase === 'end') ended++;
    s.close();
  }
  console.log(`OK  page de test : ${cases.length} rôles imposés, ${ended} parties terminées par les faux joueurs`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
