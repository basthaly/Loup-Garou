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
    assert.deepStrictEqual(room.mediaAllowed(w1, pf), { audio: true, video: true, blur: true, distort: true }, 'Petite Fille : loups floutés, voix déformée');
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
  // 5. Petite Fille : tout le village flouté pendant le tour des loups.
  {
    const { room, ps } = setup(4, ['loup', 'petitefille', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    room.phase = 'night'; room.night = 1; room.queue = [];
    room.startStep({ type: 'loups', actors: [ps[0].id] });
    assert.deepStrictEqual(room.mediaAllowed(ps[2], ps[1]), { audio: false, video: true, blur: true, distort: false }, 'villageois flouté, muet');
    assert.deepStrictEqual(room.mediaAllowed(ps[0], ps[1]), { audio: true, video: true, blur: true, distort: true }, 'loup flouté, voix déformée');
    clearTimeout(room.timer);
    // Sorcière réveillée : elle voit tous les vivants (sans les entendre), les dormeurs ne voient rien.
    room.queue = [];
    ps[3].role = 'sorciere';
    room.startStep({ type: 'sorciere', actors: [], roleStep: true });
    assert.deepStrictEqual(room.mediaAllowed(ps[2], ps[3]), { audio: false, video: true, blur: false }, 'la Sorcière voit les autres');
    assert.strictEqual(room.mediaAllowed(ps[3], ps[2]).video, false, 'les dormeurs ne la voient pas');
    clearTimeout(room.timer);
    console.log('OK  Petite Fille : village flouté, loups entendus déformés ; Sorcière voit les vivants');
  }

  // 6. Chasseur mort : il ne voit pas les rôles tant qu'il n'a pas tiré.
  {
    const { room, ps } = setup(4, ['loup', 'chasseur', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    room.phase = 'day'; room.day = 1; room.queue = []; room.deaths = [];
    const trig = [];
    room.kill(ps[1].id, 'vote', trig);
    room.queue.unshift(...trig);
    assert.strictEqual(room.seesAll(ps[1]), false, 'pas de rôles avant le tir');
    room.next();
    assert.strictEqual(room.step.type, 'hunter');
    assert.strictEqual(room.roleVisible(ps[1], ps[0]), false, 'le rôle du loup reste caché');
    room.act(ps[1].id, { target: ps[2].id });
    assert.strictEqual(room.seesAll(ps[1]), true, 'après le tir, il voit tout');
    clearTimeout(room.timer);
    console.log('OK  Chasseur : rôles cachés jusqu\'à son tir');
  }

  // 7. Ancien éliminé par le village : plus de pouvoirs (pas de tir du Chasseur, pas de Voyante).
  {
    const { room, ps } = setup(6, ['loup', 'loup', 'ancien', 'chasseur', 'voyante', 'villageois']);
    clearTimeout(room.timer);
    room.phase = 'day'; room.day = 1; room.queue = []; room.deaths = [];
    const trig = [];
    room.kill(ps[2].id, 'vote', trig);
    assert.ok(room.powersLost, 'pouvoirs perdus');
    room.kill(ps[3].id, 'vote', trig);
    assert.ok(!trig.some((t) => t.type === 'hunter'), 'le Chasseur ne tire plus');
    room.queue = [];
    room.planNight();
    assert.ok(!room.phaseSteps.includes('voyante'), 'la Voyante ne se réveille plus');
    clearTimeout(room.timer);
    console.log('OK  Ancien éliminé par le vote : pouvoirs perdus');
  }

  // 8. L'hôte arrête la partie : retour au salon.
  {
    const { room, ps } = setup(4, ['loup', 'villageois', 'villageois', 'villageois']);
    assert.throws(() => room.abort(ps[1].id), 'seul l\'hôte');
    room.abort(ps[0].id);
    assert.strictEqual(room.phase, 'lobby');
    assert.ok(ps.every((p) => p.alive && !p.role), 'joueurs remis à zéro');
    console.log('OK  arrêt de la partie par l\'hôte');
  }
  // 9. L'hôte quitte : un autre joueur connecté devient hôte ; le MJ joueur parti → le site reprend.
  {
    const room = new Room('TEST', () => {});
    const a = room.addPlayer('A'); const b = room.addPlayer('B'); const c = room.addPlayer('C');
    a.connected = false;
    room.ensureHost();
    assert.strictEqual(room.hostId, b.id, 'B devient hôte');
    room.removePlayer(b.id);
    assert.strictEqual(room.hostId, c.id, 'C devient hôte (A toujours déconnecté)');
    const { room: r2, ps } = setup(4, ['loup', 'villageois', 'villageois', 'villageois']);
    r2.settings.mjMode = 'joueur'; r2.settings.mjId = ps[3].id;
    ps[3].connected = false;
    r2.ensureHost();
    assert.strictEqual(r2.settings.mjMode, 'site', 'le site reprend le rôle de MJ');
    clearTimeout(r2.timer);
    console.log('OK  départ de l\'hôte / du MJ : la main passe');
  }
  // 10. Passer la main à un autre joueur.
  {
    const room = new Room('TEST', () => {});
    const a = room.addPlayer('A'); const b = room.addPlayer('B');
    assert.throws(() => room.transferHost(b.id, a.id), 'seul l\'hôte');
    room.transferHost(a.id, b.id);
    assert.strictEqual(room.hostId, b.id);
    console.log('OK  passer la main à un autre joueur');
  }

  // 11. Voleur : prend une carte du centre ; deux loups au centre, il doit en prendre un.
  {
    const room = new Room('TEST', () => {});
    const ps = [0, 1, 2, 3].map((i) => room.addPlayer('J' + i));
    room.customCompo = { voleur: 1, loup: 2, villageois: 2, voyante: 1 };
    room.start(ps[0].id);
    clearTimeout(room.timer);
    ['voleur', 'loup', 'villageois', 'villageois'].forEach((r, i) => { ps[i].role = r; });
    room.extraCards = ['loup', 'voyante'];
    room.phase = 'night'; room.night = 1; room.queue = [];
    room.startStep({ type: 'voleur', actors: [], roleStep: true });
    assert.deepStrictEqual(room.step.actors, [ps[0].id]);
    room.act(ps[0].id, { take: 1 });
    assert.strictEqual(ps[0].role, 'voyante', 'le Voleur devient Voyante');
    clearTimeout(room.timer);
    room.extraCards = ['loup', 'grandloup'];
    ps[0].role = 'voleur';
    room.startStep({ type: 'voleur', actors: [], roleStep: true });
    assert.throws(() => room.act(ps[0].id, { take: null }), /Deux loups/);
    clearTimeout(room.timer);
    console.log('OK  Voleur : échange de carte, obligé de prendre un loup');
  }
  // 12. Infect Père des Loups : la victime devient loup au lieu de mourir.
  {
    const { room, ps } = setup(5, ['infect', 'loup', 'villageois', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    room.phase = 'night'; room.night = 1; room.queue = [];
    room.victim = ps[2].id;
    room.startStep({ type: 'infect', actors: [], roleStep: true, seconds: 25 });
    room.showDelay = () => 2; // la nuit enchaîne sans pause : on la remet pour examiner l'étape
    room.act(ps[0].id, { infect: true });
    clearTimeout(room.timer);
    room.queue = [];
    room.startStep({ type: 'dawn', actors: [] });
    clearTimeout(room.timer);
    assert.ok(ps[2].alive && ps[2].infected, 'la victime est vivante et infectée');
    assert.ok(room.isWolf(ps[2]));
    assert.ok(room.viewFor(ps[1].id).me.wolves.includes(ps[2].id), 'les loups la reconnaissent');
    assert.strictEqual(room.viewFor(ps[1].id).players[0].role, 'loup', "l'Infect apparaît comme loup");
    console.log("OK  Infect : la victime rejoint les loups");
  }
  // 13. Enfant Sauvage : son modèle meurt, il devient loup.
  {
    const { room, ps } = setup(5, ['loup', 'enfant', 'villageois', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    ps[1].model = ps[2].id;
    room.deaths = [];
    room.kill(ps[2].id, 'vote', []);
    assert.ok(ps[1].wildTurned && room.isWolf(ps[1]));
    console.log('OK  Enfant Sauvage : devient loup à la mort de son modèle');
  }
  // 14. Renard : flaire un joueur et ses deux voisins ; sans loup, il perd son flair.
  {
    const { room, ps } = setup(6, ['renard', 'villageois', 'villageois', 'villageois', 'loup', 'villageois']);
    clearTimeout(room.timer);
    room.phase = 'night'; room.night = 1; room.queue = [{ type: 'dawn', actors: [] }];
    room.startStep({ type: 'renard', actors: [], roleStep: true });
    room.act(ps[0].id, { target: ps[2].id });
    clearTimeout(room.timer);
    assert.deepStrictEqual(room.step.result.fox.ids, [ps[2].id, ps[1].id, ps[3].id]);
    assert.strictEqual(room.step.result.fox.hasWolf, false);
    assert.ok(room.foxLost, 'le Renard perd son flair');
    assert.ok(room.neighbors(ps[0].id).includes(ps[5].id), 'la table est circulaire');
    console.log('OK  Renard : voisins en cercle, perte du flair');
  }
  // 15. Chevalier : tué par les loups, le premier loup après lui meurt à l'aube suivante.
  {
    const { room, ps } = setup(6, ['chevalier', 'villageois', 'loup', 'loup', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    room.phase = 'night'; room.night = 1; room.queue = [];
    room.victim = ps[0].id;
    room.startStep({ type: 'dawn', actors: [] });
    clearTimeout(room.timer);
    assert.ok(!ps[0].alive && room.rustyPending === ps[2].id, 'le premier loup est blessé');
    room.queue = []; room.victim = null; room.night = 2;
    room.startStep({ type: 'dawn', actors: [] });
    clearTimeout(room.timer);
    assert.ok(!ps[2].alive && ps[2].death.cause === 'rouille');
    console.log('OK  Chevalier : le loup blessé meurt la nuit suivante');
  }
  // 16. Ange : éliminé au premier vote, il gagne seul.
  {
    const { room, ps } = setup(5, ['ange', 'loup', 'villageois', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    room.phase = 'day'; room.day = 1; room.queue = [];
    room.startStep({ type: 'vote', actors: [], seconds: 60, dynamicActors: true });
    for (const p of ps.slice(1)) room.act(p.id, { target: ps[0].id });
    room.act(ps[0].id, { target: ps[1].id });
    await wait(300);
    assert.strictEqual(room.phase, 'end');
    assert.strictEqual(room.winner.team, 'ange');
    console.log('OK  Ange : victoire au premier vote');
  }
  // 17. Joueur de flûte : tous les vivants charmés, il gagne.
  {
    const { room, ps } = setup(4, ['flute', 'loup', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    ps[1].charmed = true; ps[2].charmed = true;
    assert.strictEqual(room.checkWin(), null);
    ps[3].charmed = true;
    assert.strictEqual(room.checkWin().team, 'flute');
    assert.ok(room.viewFor(ps[2].id).players[1].charmed, 'les charmés se voient');
    assert.ok(!room.viewFor(ps[0].id).players[0].charmed);
    console.log('OK  Joueur de flûte : victoire quand tout le monde est charmé');
  }
  // 18. Loup-Garou Blanc : les loups ne gagnent pas tant qu'il vit ; seul survivant, il gagne.
  {
    const { room, ps } = setup(4, ['loupblanc', 'loup', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    ps[3].alive = false;
    assert.strictEqual(room.checkWin(), null, 'pas de victoire des loups avec le Loup Blanc vivant');
    ps[2].alive = false;
    assert.strictEqual(room.checkWin(), null);
    assert.deepStrictEqual(room.optionsFor({ type: 'loupblanc' }, ps[0].id), [ps[1].id]);
    ps[1].alive = false;
    assert.strictEqual(room.checkWin().team, 'loupblanc');
    console.log('OK  Loup-Garou Blanc : victoire seul');
  }
  // 19. Sœurs : elles se reconnaissent. Composition : villageois ajustés, Sœurs par deux, Voleur +2 cartes.
  {
    const { room, ps } = setup(5, ['soeur', 'soeur', 'loup', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    assert.strictEqual(room.viewFor(ps[0].id).players[1].role, 'soeur');
    assert.strictEqual(room.viewFor(ps[3].id).players[1].role, null);
    const r = new Room('T', () => {});
    const a = r.addPlayer('A'); for (let i = 0; i < 7; i++) r.addPlayer('P' + i);
    const n = r.effectiveCompo().villageois || 0;
    r.changeCompo(a.id, 'soeur', 1);
    assert.strictEqual(r.effectiveCompo().soeur, 2);
    assert.strictEqual(r.effectiveCompo().villageois || 0, Math.max(0, n - 2), 'deux villageois en moins');
    r.changeCompo(a.id, 'voleur', 1);
    assert.strictEqual(Object.values(r.effectiveCompo()).reduce((x, y) => x + y, 0), 10, '8 joueurs + 2 cartes au centre');
    console.log('OK  Sœurs et composition équilibrée');
  }

  // 20. Amoureux : après Cupidon, ils se réveillent ensemble, se voient et s'entendent.
  {
    const { room, ps } = setup(5, ['cupidon', 'loup', 'villageois', 'villageois', 'villageois']);
    clearTimeout(room.timer);
    room.phase = 'night'; room.night = 1;
    room.queue = [{ type: 'amoureux', actors: [], seconds: 15 }, { type: 'dawn', actors: [] }];
    room.startStep({ type: 'cupidon', actors: [], roleStep: true });
    room.act(ps[0].id, { targets: [ps[1].id, ps[2].id] });
    await wait(50);
    assert.strictEqual(room.step.type, 'amoureux');
    assert.deepStrictEqual(room.step.actors.sort(), [ps[1].id, ps[2].id].sort());
    assert.strictEqual(room.viewFor(ps[1].id).step.partner, ps[2].id);
    assert.strictEqual(room.mediaAllowed(ps[1], ps[2]).audio, true, 'ils s\'entendent');
    assert.strictEqual(room.mediaAllowed(ps[1], ps[3]).video, false, 'les autres dorment');
    room.act(ps[1].id, {}); room.act(ps[2].id, {});
    await wait(50);
    assert.notStrictEqual(room.step.type, 'amoureux', 'fini quand les deux ont terminé');
    clearTimeout(room.timer);
    console.log('OK  Amoureux : se réveillent ensemble après Cupidon');
  }
  process.exit(0);
})().catch((e) => { console.error('ÉCHEC :', e.message); process.exit(1); });

// Compositions toutes faites : la bonne taille pour chaque nombre de joueurs, et elles suivent les arrivées.
{
  const Roles = require('../server/roles');
  for (let n = 4; n <= 18; n++) for (const p of Roles.presetsFor(n)) assert.strictEqual(Object.values(p.compo).reduce((a, b) => a + b, 0), n, `${p.name} à ${n}`);
  const room = new Room('PRES', () => {});
  const ps = Array.from({ length: 8 }, (_, i) => room.addPlayer('P' + i));
  const meute = room.presetsFor(8).find((p) => p.name === 'Personnages');
  room.applyPreset(ps[0].id, meute.id);
  assert.ok(room.settings.extensions.personnages, 'extension activée');
  assert.strictEqual(room.effectiveCompo().infect, 1);
  room.addPlayer('P8'); room.addPlayer('P9');
  assert.strictEqual(Object.values(room.effectiveCompo()).reduce((a, b) => a + b, 0), 10, 'elle suit le nombre de joueurs');
  assert.strictEqual(room.effectiveCompo().soeur, 2);
  room.changeCompo(ps[0].id, 'chasseur', 1);
  assert.strictEqual(room.presetId, null, 'modifiée à la main : elle ne bouge plus');
  console.log('OK  compositions toutes faites (Thiercelieux)');
}
