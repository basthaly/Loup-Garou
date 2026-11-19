// Salon d'attente : arriver pendant une partie (npm test).
process.env.LG_FAST = '1';
const assert = require('assert');
const { Room } = require('../server/game');
const { OneNightRoom } = require('../server/onenight');

for (const [label, Cls, n] of [['Thiercelieux', Room, 6], ['Une nuit', OneNightRoom, 4]]) {
  const room = new Cls('W', () => {});
  const ps = Array.from({ length: n }, (_, i) => room.addPlayer('J' + i));
  room.start(ps[0].id);
  clearTimeout(room.timer);
  const late = room.addPlayer('Retard');
  assert.ok(late.waiting, `${label} : le retardataire est en attente`);
  assert.ok(!room.gamePlayers().includes(late), `${label} : il ne joue pas`);
  const v = room.viewFor(late.id);
  assert.ok(v.me.waiting && !v.me.alive, `${label} : sa vue le dit en attente`);
  assert.ok(v.players.find((p) => p.id === late.id).waiting, `${label} : les autres le voient en attente`);
  for (const p of ps) room.viewFor(p.id);
  room.removePlayer(late.id);
  assert.ok(!room.players.has(late.id), `${label} : il peut repartir`);
  const late2 = room.addPlayer('Retard2');
  room.abort(ps[0].id);
  assert.ok(!late2.waiting && late2.alive, `${label} : au retour au salon, il devient joueur`);
  console.log(`✓ ${label} : salon d'attente`);
}
