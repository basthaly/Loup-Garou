// Mise à jour du site : les salons enregistrés à l'arrêt sont recréés au redémarrage, avec les mêmes jetons.
process.env.DATA_DIR = require('path').join(require('os').tmpdir(), 'lg-persist-' + process.pid);
const assert = require('assert');
const fs = require('fs');
const Persist = require('../server/persist');
const { Room } = require('../server/game');
const ON = require('../server/onenight');
const make = (game, code) => (game === 'onenight' ? new ON.OneNightRoom(code, () => {}) : new Room(code, () => {}));

const rooms = new Map();
const a = new Room('ABCD', () => {});
const pa = ['Ana', 'Bob', 'Cléa', 'Dan'].map((n) => a.addPlayer(n));
a.updateSettings(pa[0].id, { debateSeconds: 120 });
a.start(pa[0].id); clearTimeout(a.timer);
rooms.set('ABCD', a);
const b = new ON.OneNightRoom('WXYZ', () => {});
const pb = ['Eve', 'Fil', 'Gus'].map((n) => b.addPlayer(n));
b.applyPreset(pb[0].id, b.presetsFor(3).findIndex((p) => p.random));
b.transferHost(pb[0].id, pb[1].id);
rooms.set('WXYZ', b);
const t = new Room('TEST', () => {}); t.test = { me: 'x' }; t.addPlayer('Testeur'); rooms.set('TEST', t);

assert.strictEqual(Persist.save(rooms), 2, 'la page de test n\'est pas gardée');
const next = new Map();
assert.strictEqual(Persist.restore(next, make), 2);
const a2 = next.get('ABCD'), b2 = next.get('WXYZ');
assert.strictEqual(a2.phase, 'lobby', 'une partie en cours revient au salon');
assert.strictEqual(a2.settings.debateSeconds, 120);
assert.deepStrictEqual(a2.order, a.order);
assert.strictEqual(a2.byToken(pa[2].token).name, 'Cléa', 'même jeton : reconnexion automatique');
assert.strictEqual(a2.hostId, pa[0].id);
assert.ok(a2.notice.includes('interrompue') && a2.log.some((l) => l.text.includes('mis à jour')));
assert.strictEqual(b2.game, 'onenight');
assert.strictEqual(b2.hostId, pb[1].id, "l'hôte est gardé");
assert.ok(b2.anarchy, 'le scénario est gardé');
assert.ok([...b2.players.values()].every((p) => !p.connected));
assert.strictEqual(Persist.restore(new Map(), make), 0, 'le fichier ne sert qu\'une fois');
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
console.log('OK  mise à jour : salons recréés, mêmes joueurs et jetons, retour au salon');
