// Règles de Loup-Garou pour une nuit (npm test).
process.env.LG_FAST = '1';
const assert = require('assert');
const { OneNightRoom, PRESETS } = require('../server/onenight');

// Partie à n joueurs avec des cartes imposées (joueurs puis centre).
function setup(cards, center) {
  const room = new OneNightRoom('T', () => {});
  const ps = cards.map((_, i) => room.addPlayer('J' + i));
  room.start(ps[0].id);
  clearTimeout(room.timer);
  cards.forEach((c, i) => { ps[i].card = ps[i].startRole = c; });
  room.center = center.slice();
  const counts = {};
  for (const c of [...cards, ...center]) counts[c] = (counts[c] || 0) + 1;
  room.compo = counts;
  for (const p of ps) room.act(p.id, {}); // tout le monde a vu sa carte → la nuit commence
  return { room, ps };
}
const until = (room, type) => { while (room.step && room.step.type !== type && room.phase !== 'day') room.resolveStep(); };
const vote = (room, ps, targets) => targets.forEach((t, i) => room.act(ps[i].id, { target: t === null ? null : ps[t].id }));

// 1. Decks : toujours joueurs + 3 cartes.
for (const [n, list] of Object.entries(PRESETS)) for (const [, c, sc] of list) if (!sc.random) assert.strictEqual(Object.values(c).reduce((a, b) => a + b, 0), +n + 3);
for (let n = 3; n <= 10; n++) assert.ok(PRESETS[n].length >= 3, `au moins 3 scénarios à ${n}`);
assert.deepStrictEqual(PRESETS[9].find(([nm]) => nm === 'Confusion')[1], { n_loup: 2, n_soulard: 1, n_voleur: 1, n_noiseuse: 1, n_insomniaque: 1, n_villageois: 2, n_voyante: 1, n_sbire: 1, n_macon: 2 });
console.log('OK  scénarios du livret : joueurs + 3 cartes, de 3 à 10 joueurs');
// Anarchie : tirage au lancement, 2 loups + 1 villageois toujours, Francs-Maçons par deux, tous les rôles appelés.
for (let t = 0; t < 200; t++) {
  const n = 3 + (t % 8);
  const room = new OneNightRoom('A', () => {});
  const ps = Array.from({ length: n }, (_, i) => room.addPlayer('A' + i));
  room.applyPreset(ps[0].id, room.presetsFor(n).findIndex((p) => p.random));
  room.start(ps[0].id);
  clearTimeout(room.timer);
  const c = room.compo;
  assert.strictEqual(Object.values(c).reduce((a, b) => a + b, 0), n + 3);
  assert.ok(c.n_loup === 2 && c.n_villageois >= 1);
  assert.ok(!c.n_macon || c.n_macon === 2, 'Francs-Maçons par deux');
  assert.ok(room.viewFor(ps[1].id).compo.n_double === 1, 'la composition reste secrète');
  if (t === 0) { for (const p of ps) room.act(p.id, {}); assert.strictEqual(room.phaseSteps.length, 9, 'tous les rôles sont appelés'); clearTimeout(room.timer); }
}
console.log('OK  Anarchie : tirage secret, 2 loups + 1 villageois, maçons par deux');

// 2. Voleur puis Noiseuse : les cartes finales décident ; un loup éliminé → le village gagne.
{
  const { room, ps } = setup(['n_voyante', 'n_voleur', 'n_noiseuse', 'n_loup'], ['n_loup', 'n_villageois', 'n_villageois']);
  until(room, 'n_voleur');
  room.act(ps[1].id, { target: ps[3].id });
  until(room, 'n_noiseuse');
  room.act(ps[2].id, { targets: [ps[0].id, ps[1].id] });
  until(room, 'vote');
  assert.strictEqual(room.phase, 'day');
  assert.strictEqual(ps[0].card, 'n_loup', 'la Voyante a reçu le loup sans le savoir');
  vote(room, ps, [1, 0, 0, 0]);
  assert.strictEqual(room.phase, 'end');
  assert.strictEqual(room.winner.team, 'village');
  assert.ok(!room.winner.winners.includes(ps[0].id), 'le loup final perd');
  console.log('OK  Voleur et Noiseuse : on joue avec sa carte finale');
}
// 3. Personne n'a plus d'une voix : personne ne meurt ; les loups gagnent.
{
  const { room, ps } = setup(['n_loup', 'n_villageois', 'n_villageois', 'n_voyante'], ['n_loup', 'n_voleur', 'n_noiseuse']);
  until(room, 'vote');
  vote(room, ps, [1, 2, 3, 0]);
  assert.deepStrictEqual(room.lastVote.dead, []);
  assert.strictEqual(room.winner.team, 'loups');
  console.log("OK  une voix chacun : personne ne meurt, les loups gagnent");
}
// 4. Tanneur éliminé, aucun loup mort : le Tanneur gagne seul.
{
  const { room, ps } = setup(['n_tanneur', 'n_loup', 'n_villageois'], ['n_loup', 'n_voyante', 'n_villageois']);
  until(room, 'vote');
  vote(room, ps, [1, 0, 0]);
  assert.strictEqual(room.winner.team, 'tanneur');
  assert.deepStrictEqual(room.winner.winners, [ps[0].id]);
  console.log('OK  Tanneur : gagne seul s\'il est éliminé');
}
// 5. Chasseur éliminé : celui pour qui il a voté meurt aussi.
{
  const { room, ps } = setup(['n_chasseur', 'n_loup', 'n_villageois', 'n_villageois'], ['n_loup', 'n_voyante', 'n_villageois']);
  until(room, 'vote');
  vote(room, ps, [1, 0, 0, 0]);
  assert.deepStrictEqual(room.lastVote.dead.sort(), [ps[0].id, ps[1].id].sort());
  assert.strictEqual(room.winner.team, 'village');
  console.log('OK  Chasseur : emporte celui pour qui il a voté');
}
// 6. Aucun loup parmi les joueurs et personne ne meurt : le village gagne.
{
  const { room, ps } = setup(['n_villageois', 'n_voyante', 'n_villageois'], ['n_loup', 'n_loup', 'n_voleur']);
  until(room, 'vote');
  vote(room, ps, [null, null, null]);
  assert.strictEqual(room.winner.team, 'village');
  console.log('OK  aucun loup en jeu et personne ne meurt : le village gagne');
}
// 7. Doppelgänger qui copie la Voyante : il joue aussitôt son action ; Soûlard échange avec le centre.
{
  const { room, ps } = setup(['n_double', 'n_voyante', 'n_soulard', 'n_loup'], ['n_villageois', 'n_loup', 'n_villageois']);
  assert.strictEqual(room.step.type, 'n_double');
  room.act(ps[0].id, { target: ps[1].id });
  room.resolveStep();
  assert.strictEqual(room.step.type, 'n_voyante');
  assert.deepStrictEqual(room.step.actors, [ps[0].id], 'le Doppelgänger joue la Voyante');
  room.act(ps[0].id, { target: ps[3].id });
  assert.strictEqual(ps[0].known[ps[3].id], 'n_loup');
  until(room, 'n_soulard');
  room.resolveStep(); // sans choix : le site prend une carte au hasard
  assert.ok(['n_villageois', 'n_loup'].includes(ps[2].card));
  assert.strictEqual(room.finalRole('n_double'), 'n_voyante');
  console.log('OK  Doppelgänger (copie la Voyante) et Soûlard');
}
// 8. Loup seul : peut regarder une carte du centre ; les loups se reconnaissent sinon.
{
  const { room, ps } = setup(['n_loup', 'n_loup', 'n_sbire', 'n_villageois'], ['n_voyante', 'n_villageois', 'n_villageois']);
  assert.strictEqual(room.step.type, 'n_loups');
  assert.ok(!room.step.lone);
  assert.strictEqual(ps[0].known[ps[1].id], 'n_loup');
  room.resolveStep();
  assert.strictEqual(room.step.type, 'n_sbire');
  assert.strictEqual(ps[2].known[ps[0].id], 'n_loup', 'le Sbire voit les loups');
  assert.ok(!ps[0].known[ps[2].id], 'les loups ne connaissent pas le Sbire');
  console.log('OK  loups et Sbire');
}
process.exit(0);
