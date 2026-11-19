// Loup-Garou pour une nuit : une seule nuit, un seul vote. Cartes = joueurs + 3 (trois au centre).
// Les rôles agissent dans l'ordre selon la carte reçue au départ ; les échanges changent la carte (et le camp) finale.
const crypto = require('crypto');
const { Room, shuffle, pick, F } = require('./game');

const ROLES = {
  n_double:      { name: 'Doppelgänger',        team: 'variable', max: 1, desc: "Regarde la carte d'un joueur et devient ce rôle.",
    how: ["Au début de la nuit, touche un joueur : tu découvres sa carte et tu deviens ce rôle.", 'Voyante, Voleur, Noiseuse ou Soûlard : tu joues aussitôt son action.', 'Loup-Garou, Sbire, Franc-Maçon ou Insomniaque : tu te réveilles plus tard avec eux.', 'Tu gagnes avec le camp du rôle copié.'] },
  n_loup:        { name: 'Loup-Garou',     team: 'loups',    max: 2, desc: "Les loups se reconnaissent. Seul, il peut regarder une carte du centre.",
    how: ['La nuit, tu vois les autres loups.', "Si tu es le seul loup, tu peux regarder une carte du centre.", "Le jour, bluffe : les loups gagnent si aucun loup n'est éliminé."] },
  n_sbire:       { name: 'Sbire',          team: 'loups',    max: 1, desc: 'Voit les loups, qui ne le connaissent pas. Gagne avec eux.',
    how: ['La nuit, tu vois qui sont les loups (eux ne te connaissent pas).', "Tu gagnes avec les loups, même si tu es éliminé.", "S'il n'y a aucun loup parmi les joueurs, tu gagnes si quelqu'un d'autre est éliminé."] },
  n_macon:       { name: 'Franc-Maçon',    team: 'village',  max: 2, count: 2, desc: 'Les deux Francs-Maçons se reconnaissent.',
    how: ["La nuit, tu vois l'autre Franc-Maçon.", "Seul ? L'autre carte est au centre."] },
  n_voyante:     { name: 'Voyante',        team: 'village',  max: 1, desc: "Regarde la carte d'un joueur, ou deux cartes du centre.",
    how: ["Touche un joueur pour voir sa carte, ou deux cartes du centre.", 'Tu ne déplaces rien.'] },
  n_voleur:      { name: 'Voleur',         team: 'village',  max: 1, desc: 'Échange sa carte avec celle d’un joueur, puis la regarde.',
    how: ['Touche un joueur : vous échangez vos cartes et tu vois ta nouvelle carte.', "Tu joues désormais ce rôle (sans son action de nuit) et tu changes de camp avec lui.", 'Tu peux aussi passer.'] },
  n_noiseuse:    { name: 'Noiseuse',       team: 'village',  max: 1, desc: 'Échange les cartes de deux autres joueurs, sans les regarder.',
    how: ["Touche deux autres joueurs : leurs cartes sont échangées, sans que personne ne les voie.", 'Ils changent de rôle et de camp sans le savoir.', 'Tu peux aussi passer.'] },
  n_soulard:     { name: 'Soûlard',        team: 'village',  max: 1, desc: 'Échange sa carte avec une carte du centre, sans la regarder.',
    how: ['Touche une carte du centre : elle devient la tienne, sans que tu la voies.', 'Obligatoire.'] },
  n_insomniaque: { name: 'Insomniaque',    team: 'village',  max: 1, desc: 'Se réveille en dernier et regarde sa propre carte.',
    how: ['En fin de nuit, tu vois ta carte : a-t-elle changé ?'] },
  n_villageois:  { name: 'Villageois',     team: 'village',  max: 3, desc: 'Aucun pouvoir. Doit trouver un loup.',
    how: ['La nuit, tu dors.', "Le jour, trouve un loup : le village gagne si au moins un loup est éliminé."] },
  n_chasseur:    { name: 'Chasseur',       team: 'village',  max: 1, desc: 'S’il est éliminé, celui pour qui il a voté meurt aussi.',
    how: ['La nuit, tu dors.', "Si tu es éliminé, le joueur pour qui tu as voté est éliminé aussi."] },
  n_tanneur:     { name: 'Tanneur',        team: 'solitaire', max: 1, desc: 'Déteste son métier : gagne s’il est éliminé.',
    how: ["Tu gagnes si tu es éliminé. Fais-toi soupçonner !", "Si tu es éliminé et aucun loup, les loups ne gagnent pas."] }
};
for (const r of Object.values(ROLES)) { r.ext = 'onenight'; r.game = 'onenight'; r.impl = true; }

const RULES = [
  'Chacun reçoit une carte. Trois cartes restent au centre, face cachée.',
  "La nuit, les rôles se réveillent un par un. Certains échangent des cartes : ta carte finale n'est peut-être plus celle du départ.",
  'Au réveil, tout le monde débat puis vote en même temps.',
  "Le plus désigné est éliminé (tous en cas d'égalité). Si personne n'a plus d'une voix, personne ne meurt.",
  "Le village gagne si au moins un loup est éliminé. Les loups gagnent si aucun loup ne l'est.",
  'On joue avec sa carte finale : on peut avoir changé de camp sans le savoir.'
];

// Scénarios officiels (livret du jeu) : composition de base + ajouts selon le nombre de joueurs.
// Toujours joueurs + 3 cartes. Anarchie : 2 loups + 1 villageois, le reste tiré au hasard au lancement.
const L = { n_loup: 2 };
const SCENARIOS = [
  { name: 'La Première Nuit', level: 'Initiation', min: 3, max: 5, base: { ...L, n_voyante: 1, n_voleur: 1, n_noiseuse: 1, n_villageois: 1 },
    add: { 4: { n_villageois: 1 }, 5: { n_villageois: 2 } } },
  { name: 'Pleine Lune', level: 'Facile', min: 3, max: 6, base: { ...L, n_insomniaque: 1, n_voleur: 1, n_noiseuse: 1, n_villageois: 1 },
    add: { 4: { n_villageois: 1 }, 5: { n_villageois: 1, n_voyante: 1 }, 6: { n_villageois: 2, n_voyante: 1 } } },
  { name: 'Nuit solitaire', level: 'Facile', min: 3, max: 4, base: { n_loup: 1, n_voyante: 1, n_voleur: 1, n_noiseuse: 1, n_villageois: 2 },
    add: { 4: { n_villageois: 1 } } },
  { name: 'Confusion', level: 'Moyen', min: 3, max: 9, base: { ...L, n_soulard: 1, n_voleur: 1, n_noiseuse: 1, n_insomniaque: 1 },
    add: { 4: { n_villageois: 1 }, 5: { n_villageois: 1, n_voyante: 1 }, 6: { n_villageois: 2, n_voyante: 1 }, 7: { n_villageois: 3, n_voyante: 1 },
      8: { n_villageois: 3, n_voyante: 1, n_sbire: 1 }, 9: { n_villageois: 2, n_voyante: 1, n_sbire: 1, n_macon: 2 } } },
  { name: 'Bénéfice', level: 'Moyen', min: 4, max: 7, base: { ...L, n_chasseur: 1, n_voyante: 1, n_voleur: 1, n_soulard: 1, n_insomniaque: 1 },
    add: { 5: { n_noiseuse: 1 }, 6: { n_noiseuse: 1, n_villageois: 1 }, 7: { n_noiseuse: 1, n_villageois: 2 } } },
  { name: 'Mystérieux compagnons', level: 'Moyen', min: 6, max: 7, base: { ...L, n_sbire: 1, n_chasseur: 1, n_voyante: 1, n_voleur: 1, n_noiseuse: 1, n_macon: 2 },
    add: { 7: { n_villageois: 1 } } },
  { name: 'Incertitudes', level: 'Moyen', min: 4, max: 10, base: { ...L, n_tanneur: 1, n_voyante: 1, n_voleur: 1, n_soulard: 1, n_insomniaque: 1 },
    add: { 5: { n_noiseuse: 1 }, 6: { n_noiseuse: 1, n_villageois: 1 }, 7: { n_noiseuse: 1, n_macon: 2 }, 8: { n_noiseuse: 1, n_macon: 2, n_chasseur: 1 },
      9: { n_noiseuse: 1, n_macon: 2, n_chasseur: 1, n_sbire: 1 }, 10: { n_noiseuse: 1, n_macon: 2, n_chasseur: 1, n_sbire: 1, n_villageois: 1 } } },
  { name: 'Alliance dans la pénombre', level: 'Difficile', min: 5, max: 10, base: { ...L, n_macon: 2, n_sbire: 1, n_voleur: 1, n_noiseuse: 1, n_insomniaque: 1 },
    add: { 6: { n_soulard: 1 }, 7: { n_soulard: 1, n_voyante: 1 }, 8: { n_soulard: 1, n_voyante: 1, n_villageois: 1 }, 9: { n_soulard: 1, n_voyante: 1, n_villageois: 2 },
      10: { n_soulard: 1, n_voyante: 1, n_villageois: 2, n_tanneur: 1 } } },
  { name: 'Revenants', level: 'Difficile', min: 8, max: 10,
    base: { ...L, n_double: 1, n_sbire: 1, n_chasseur: 1, n_voyante: 1, n_voleur: 1, n_noiseuse: 1, n_villageois: 1, n_macon: 2 },
    add: { 9: { n_insomniaque: 1 }, 10: { n_insomniaque: 1, n_soulard: 1 } } },
  { name: 'Anarchie', level: 'Difficile', min: 3, max: 10, random: true, base: { ...L, n_villageois: 1 }, add: {} }
];
// La boîte complète, d'où Anarchie tire ses cartes (hors 2 loups + 1 villageois mis de côté).
const BOX = { n_double: 1, n_loup: 2, n_sbire: 1, n_macon: 2, n_voyante: 1, n_voleur: 1, n_noiseuse: 1, n_soulard: 1, n_insomniaque: 1, n_chasseur: 1, n_tanneur: 1, n_villageois: 3 };
function scenarioCompo(sc, n) {
  const c = { ...sc.base };
  for (const [r, k] of Object.entries(sc.add[n] || {})) c[r] = (c[r] || 0) + k;
  return c;
}
const PRESETS = {};
for (let n = 3; n <= 10; n++) {
  PRESETS[n] = SCENARIOS.filter((sc) => n >= sc.min && n <= sc.max).map((sc) => [sc.name, scenarioCompo(sc, n), sc]);
}
// Anarchie : une carte par joueur tirée parmi les autres ; les Francs-Maçons restent par deux.
function drawAnarchy(n) {
  const rest = [];
  for (const [r, k] of Object.entries(BOX)) for (let i = 0; i < k - (r === 'n_loup' ? 2 : r === 'n_villageois' ? 1 : 0); i++) rest.push(r);
  const deck = shuffle(rest);
  const take = deck.slice(0, n), left = deck.slice(n);
  if (take.filter((r) => r === 'n_macon').length === 1) {
    const other = left.findIndex((r) => r !== 'n_macon');
    take[take.indexOf('n_macon')] = left[other];
  }
  const c = { n_loup: 2, n_villageois: 1 };
  for (const r of take) c[r] = (c[r] || 0) + 1;
  return c;
}
const MIN = 3;
const MAX = 10;
const size = (c) => Object.values(c).reduce((a, b) => a + b, 0);
for (const [n, list] of Object.entries(PRESETS)) for (const [name, c, sc] of list) {
  if (!sc.random && size(c) !== +n + 3) throw new Error(`Deck ${name} (${n} joueurs) : ${size(c)} cartes`);
}

// Étapes de nuit, dans l'ordre d'appel, et le rôle (carte de départ) qui agit.
const NIGHT = ['n_double', 'n_loups', 'n_sbire', 'n_macons', 'n_voyante', 'n_voleur', 'n_noiseuse', 'n_soulard', 'n_insomniaque'];
const STEP_ROLE = { n_double: 'n_double', n_loups: 'n_loup', n_sbire: 'n_sbire', n_macons: 'n_macon', n_voyante: 'n_voyante', n_voleur: 'n_voleur', n_noiseuse: 'n_noiseuse', n_soulard: 'n_soulard', n_insomniaque: 'n_insomniaque' };
const ACTION_STEP = { n_voyante: 'n_voyante', n_voleur: 'n_voleur', n_noiseuse: 'n_noiseuse', n_soulard: 'n_soulard' };
const NARRATION = {
  roles_reveal: 'Découvrez votre carte en secret.',
  n_double: 'Le Doppelgänger se réveille et copie un joueur.',
  n_loups: 'Les Loups-Garous se réveillent et se reconnaissent.',
  n_sbire: 'Le Sbire se réveille et découvre les loups.',
  n_macons: 'Les Francs-Maçons se réveillent et se reconnaissent.',
  n_voyante: 'La Voyante se réveille.',
  n_voleur: 'Le Voleur se réveille.',
  n_noiseuse: 'La Noiseuse se réveille.',
  n_soulard: 'Le Soûlard se réveille.',
  n_insomniaque: "L'Insomniaque se réveille et regarde sa carte.",
  vote: 'Tout le monde se réveille. Débattez, puis votez !'
};
const VILLAGE = Object.keys(ROLES).filter((k) => ROLES[k].team === 'village');

class OneNightRoom extends Room {
  constructor(code, onChange) {
    super(code, onChange);
    this.game = 'onenight';
    this.NIGHT = NIGHT;
    this.DAY = ['vote'];
    Object.assign(this.settings, { mjMode: 'site', mjId: null, distribution: 'auto', extensions: {}, debateSeconds: 300, nightSeconds: 20 });
  }

  resetGame() {
    super.resetGame();
    this.center = [];
    this.doppelRole = null;
    this.nightLog = [];
    this.lastVote = null;
    for (const p of (this.players || new Map()).values()) Object.assign(p, { card: null, startRole: null, known: {}, knownCenter: {}, knownSelf: null, notes: [] });
  }

  addPlayer(name) {
    if (this.gamePlayers().length >= MAX) throw new Error(`${MAX} joueurs maximum pour une nuit.`);
    const p = super.addPlayer(name);
    Object.assign(p, { card: null, startRole: null, known: {}, knownCenter: {}, knownSelf: null, notes: [] });
    return p;
  }

  narration(type) { return NARRATION[type] || ''; }
  showDelay() { return 0; }
  // Durée fixe par rôle, qu'il y ait quelqu'un ou non : le temps ne trahit rien.
  stepSeconds(step) {
    if (step.type === 'vote') return this.settings.debateSeconds;
    if (step.type === 'roles_reveal') return 20;
    return step.seconds || this.settings.nightSeconds;
  }

  finalRole(card) { return card === 'n_double' ? (this.doppelRole || 'n_double') : card; }

  // ---------- Salon ----------
  updateSettings(id, patch) {
    if (id !== this.hostId) throw new Error("Seul l'hôte peut modifier les réglages.");
    if (this.phase !== 'lobby') throw new Error('La partie a commencé.');
    if ('debateSeconds' in patch) this.settings.debateSeconds = Math.min(1200, Math.max(60, parseInt(patch.debateSeconds, 10) || 300));
    if ('nightSeconds' in patch) this.settings.nightSeconds = Math.min(60, Math.max(8, parseInt(patch.nightSeconds, 10) || 15));
    this.changed();
  }

  presetsFor(n) {
    const k = Math.min(MAX, Math.max(MIN, n));
    return (PRESETS[k] || []).map(([name, compo, sc], i) => ({ id: i, name, compo, level: sc.level, random: sc.random ? k : 0 }));
  }
  effectiveCompo() {
    if (this.compo) return this.compo;
    if (this.customCompo) return this.customCompo;
    const p = this.presetsFor(this.gamePlayers().length)[0];
    return p ? Object.assign({}, p.compo) : {};
  }
  cardsNeeded() { return this.gamePlayers().length + 3; }
  resetCompo(id) { if (id === this.hostId) this.anarchy = false; super.resetCompo(id); }

  applyPreset(id, index) {
    if (id !== this.hostId || this.phase !== 'lobby') throw new Error("Seul l'hôte peut choisir le deck.");
    const p = this.presetsFor(this.gamePlayers().length)[index];
    if (!p) throw new Error('Deck inconnu.');
    this.customCompo = Object.assign({}, p.compo);
    this.anarchy = !!p.random;
    this.changed();
  }

  changeCompo(id, role, delta) {
    if (id !== this.hostId || this.phase !== 'lobby') throw new Error("Seul l'hôte peut modifier la composition.");
    const def = ROLES[role];
    if (!def) throw new Error('Rôle inconnu.');
    const c = Object.assign({}, this.effectiveCompo());
    this.anarchy = false;
    const step = def.count || 1;
    c[role] = Math.min(def.max, Math.max(0, (c[role] || 0) + (delta > 0 ? step : -step)));
    if (!c[role]) delete c[role];
    if (role !== 'n_villageois') {
      const v = Math.min(3, Math.max(0, (c.n_villageois || 0) + this.cardsNeeded() - size(c)));
      if (v) c.n_villageois = v; else delete c.n_villageois;
    }
    this.customCompo = c;
    this.changed();
  }

  start(id) {
    if (id !== this.hostId) throw new Error("Seul l'hôte peut lancer la partie.");
    if (this.phase !== 'lobby') throw new Error('Déjà lancée.');
    const n = this.gamePlayers().length;
    if (n < MIN) throw new Error(`Il faut au moins ${MIN} joueurs.`);
    if (n > MAX) throw new Error(`${MAX} joueurs maximum.`);
    const c = this.anarchy ? drawAnarchy(n) : this.effectiveCompo();
    if (size(c) !== n + 3) throw new Error(`Le deck compte ${size(c)} cartes, il en faut ${n + 3}.`);
    if (!c.n_loup) throw new Error('Il faut au moins un Loup-Garou dans le deck.');
    if (c.n_macon && c.n_macon !== 2) throw new Error('Les Francs-Maçons vont par deux.');
    this.compo = Object.assign({}, c);
    const cards = [];
    for (const [r, k] of Object.entries(this.compo)) for (let i = 0; i < k; i++) cards.push(r);
    const deck = shuffle(cards);
    this.gamePlayers().forEach((p, i) => { p.card = deck[i]; });
    this.center = deck.slice(n);
    // Page de test : le testeur reçoit la carte choisie.
    const f = this.test && this.test.roles;
    if (f) for (const [pid, role] of Object.entries(f)) {
      const p = this.players.get(pid);
      if (!p || p.card === role) continue;
      const holder = this.gamePlayers().find((q) => q.card === role && f[q.id] !== role);
      if (holder) [p.card, holder.card] = [holder.card, p.card];
      else { const i = this.center.indexOf(role); if (i >= 0) [p.card, this.center[i]] = [this.center[i], p.card]; }
    }
    for (const p of this.gamePlayers()) p.startRole = p.role = p.card;
    this.phase = 'setup';
    this.addLog('La partie commence.', true);
    this.phaseSteps = ['roles_reveal'];
    this.startStep({ type: 'roles_reveal', actors: this.gamePlayers().map((p) => p.id) });
  }

  // ---------- Nuit ----------
  planNight() {
    this.phase = 'night';
    this.night = 1;
    this.addLog("La nuit tombe sur le village.", true);
    // Anarchie : personne ne sait quelles cartes sont en jeu, donc tous les rôles sont appelés.
    const steps = NIGHT.filter((t) => (this.anarchy ? BOX : this.compo)[STEP_ROLE[t]]).map((type) => ({ type, actors: [] }));
    this.phaseSteps = steps.map((s) => s.type);
    this.nightOrder = this.phaseSteps.slice();
    this.phaseCursor = -1;
    this.queue = steps;
    this.next();
  }

  planDay() {
    this.phase = 'day';
    this.day = 1;
    this.phaseSteps = ['vote'];
    this.phaseCursor = -1;
    this.queue = [{ type: 'vote', actors: [], dynamicActors: true }];
    this.next();
  }

  // Qui se réveille : la carte de départ (le Doppelgänger copié compte pour le rôle copié).
  wakes(p, role) { return p.startRole === role || (p.startRole === 'n_double' && this.doppelRole === role); }

  startStepHook(step) {
    if (step.dynamicActors) step.actors = this.gamePlayers().filter((p) => !p.kicked).map((p) => p.id);
    if (step.fixedActors || !STEP_ROLE[step.type]) return;
    const role = STEP_ROLE[step.type];
    // Le Doppelgänger agit à sa propre étape : on ne le rappelle pas avec la Voyante, le Voleur…
    const solo = ['n_double', 'n_voyante', 'n_voleur', 'n_noiseuse', 'n_soulard'].includes(step.type);
    step.actors = this.gamePlayers().filter((p) => !p.kicked && (solo ? p.startRole === role : this.wakes(p, role))).map((p) => p.id);
    step.priv = {};
    // Ceux qui se réveillent ensemble se reconnaissent ; le Sbire découvre les loups.
    const mark = (ids, viewers, role) => { for (const v of viewers) for (const x of ids) if (x !== v) this.players.get(v).known[x] = role; };
    if (step.type === 'n_loups') { step.lone = step.actors.length === 1; mark(step.actors, step.actors, 'n_loup'); }
    if (step.type === 'n_macons') mark(step.actors, step.actors, 'n_macon');
    if (step.type === 'n_sbire') mark(this.wolfIds(), step.actors, 'n_loup');
  }

  wolfIds() { return this.gamePlayers().filter((p) => this.wakes(p, 'n_loup')).map((p) => p.id); }
  others(id) { return this.gamePlayers().filter((p) => p.id !== id && !p.kicked).map((p) => p.id); }

  act(id, payload) {
    const s = this.step;
    if (!s || s.resolved || !s.actors.includes(id)) throw new Error('Trop tard : ton tour est passé.');
    payload = payload || {};
    const p = this.players.get(id);
    if (s.type === 'roles_reveal' || s.type === 'vote') {
      if (s.type === 'vote') {
        const t = payload.target;
        if (t !== null && (!this.others(id).includes(t))) throw new Error('Cible invalide.');
        s.inputs[id] = t;
      } else s.inputs[id] = true;
      if (s.actors.every((a) => a in s.inputs)) this.resolveStep(); else this.changed();
      return;
    }
    if (id in s.inputs) throw new Error('Déjà fait.');
    s.priv = s.priv || {};
    const centerIdx = (v) => Number.isInteger(v) && v >= 0 && v < this.center.length;
    const pl = (x) => this.players.get(x);
    switch (s.type) {
      case 'n_double': {
        if (!this.others(id).includes(payload.target)) throw new Error('Choisis un joueur.');
        this.doppel(p, payload.target, s);
        break;
      }
      case 'n_loups': {
        if (s.lone && payload.center !== undefined && payload.center !== null) {
          if (!centerIdx(payload.center)) throw new Error('Carte invalide.');
          p.knownCenter[payload.center] = this.center[payload.center];
          s.priv[id] = { center: [{ i: payload.center, role: this.center[payload.center] }] };
          this.nightLog.push(`${p.name} (loup seul) regarde la carte ${payload.center + 1} du centre : ${ROLES[this.center[payload.center]].name}.`);
        }
        break;
      }
      case 'n_voyante': {
        if (Array.isArray(payload.center)) {
          const c = [...new Set(payload.center)];
          if (c.length !== 2 || !c.every(centerIdx)) throw new Error('Choisis deux cartes du centre.');
          for (const i of c) p.knownCenter[i] = this.center[i];
          s.priv[id] = { center: c.map((i) => ({ i, role: this.center[i] })) };
          this.nightLog.push(`${p.name} (Voyante) regarde les cartes ${c.map((i) => i + 1).join(' et ')} du centre : ${c.map((i) => ROLES[this.center[i]].name).join(', ')}.`);
        } else if (payload.target) {
          if (!this.others(id).includes(payload.target)) throw new Error('Cible invalide.');
          const t = pl(payload.target);
          p.known[t.id] = t.card;
          s.priv[id] = { players: [{ id: t.id, role: t.card }] };
          this.nightLog.push(`${p.name} (Voyante) regarde la carte de ${t.name} : ${ROLES[t.card].name}.`);
        } else if (payload.target !== null) throw new Error('Choisis un joueur ou deux cartes.');
        break;
      }
      case 'n_voleur': {
        if (payload.target) {
          if (!this.others(id).includes(payload.target)) throw new Error('Cible invalide.');
          const t = pl(payload.target);
          [p.card, t.card] = [t.card, p.card];
          p.knownSelf = p.card;
          s.priv[id] = { took: p.card, from: t.id };
          this.nightLog.push(`${p.name} (Voleur) échange sa carte avec ${t.name} et devient ${ROLES[p.card].name}.`);
        } else if (payload.target !== null) throw new Error('Choisis un joueur.');
        break;
      }
      case 'n_noiseuse': {
        if (payload.targets !== null) {
          const t = Array.isArray(payload.targets) ? [...new Set(payload.targets)] : [];
          if (t.length !== 2 || !t.every((x) => this.others(id).includes(x))) throw new Error('Choisis deux autres joueurs.');
          const [a, b] = t.map(pl);
          [a.card, b.card] = [b.card, a.card];
          s.priv[id] = { swapped: t };
          this.nightLog.push(`${p.name} (Noiseuse) échange les cartes de ${a.name} et ${b.name}.`);
        }
        break;
      }
      case 'n_soulard': {
        if (!centerIdx(payload.center)) throw new Error('Choisis une carte du centre.');
        this.drunk(p, payload.center, s);
        break;
      }
      case 'n_sbire': case 'n_macons': case 'n_insomniaque':
        break;
      default:
        throw new Error('Action inconnue.');
    }
    s.inputs[id] = payload;
    this.note(p, s);
    // Pas de fin anticipée la nuit : chaque rôle dure le même temps.
    this.changed();
  }

  // Ce que le joueur a appris cette nuit : rappelé pendant le reste de la nuit et le débat.
  note(p, s) {
    const r = (s.priv || {})[p.id];
    if (r && !p.notes.includes(r)) p.notes.push(r);
  }

  doppel(p, targetId, s) {
    const t = this.players.get(targetId);
    this.doppelRole = t.card;
    p.known[t.id] = t.card;
    s.priv[p.id] = { players: [{ id: t.id, role: t.card }], copied: t.card };
    this.nightLog.push(`${p.name} (Doppelgänger) copie ${t.name} : ${ROLES[t.card].name}.`);
    // Rôle à action immédiate : le Doppelgänger la joue juste après.
    const action = ACTION_STEP[t.card];
    if (action) this.queue.unshift({ type: action, actors: [p.id], fixedActors: true, doppel: true, phaseType: 'n_double' });
  }

  drunk(p, i, s) {
    [p.card, this.center[i]] = [this.center[i], p.card];
    s.priv[p.id] = { center: [{ i, role: null }] };
    this.nightLog.push(`${p.name} (Soûlard) échange sa carte avec la carte ${i + 1} du centre.`);
  }

  resolveStep() {
    const s = this.step;
    if (!s || s.resolved) return;
    clearTimeout(this.timer);
    s.result = {};
    // Actions obligatoires non faites : le site choisit au hasard.
    for (const a of s.actors) {
      if (a in s.inputs) continue;
      const p = this.players.get(a);
      if (s.type === 'n_double' && this.others(a).length) { this.doppel(p, pick(this.others(a)), s); this.note(p, s); }
      if (s.type === 'n_soulard' && this.center.length) { this.drunk(p, crypto.randomInt(this.center.length), s); this.note(p, s); }
    }
    if (s.type === 'n_insomniaque') {
      for (const a of s.actors) {
        const p = this.players.get(a);
        p.knownSelf = p.card;
        p.notes.push({ self: p.card });
        this.nightLog.push(`${p.name} (Insomniaque) voit sa carte : ${ROLES[p.card].name}.`);
      }
    }
    if (s.type === 'vote') return this.resolveVote(s);
    s.resolved = true;
    this.next();
  }

  next() {
    clearTimeout(this.timer);
    this.waitingMJ = false;
    if (this.phase === 'end') return this.changed();
    const nxt = this.queue.shift();
    if (nxt) return this.startStep(nxt);
    if (this.phase === 'setup') return this.planNight();
    if (this.phase === 'night') return this.planDay();
    this.changed();
  }

  // ---------- Vote et fin ----------
  resolveVote(s) {
    const choices = s.actors.map((a) => ({ voter: a, target: s.inputs[a] === undefined ? null : s.inputs[a] }));
    const tally = {};
    for (const c of choices) if (c.target) tally[c.target] = (tally[c.target] || 0) + 1;
    const max = Object.keys(tally).length ? Math.max(...Object.values(tally)) : 0;
    const dead = max >= 2 ? Object.keys(tally).filter((t) => tally[t] === max) : [];
    // Chasseur éliminé : celui pour qui il a voté meurt aussi.
    let grew = true;
    const hunterKills = [];
    while (grew) {
      grew = false;
      for (const d of [...dead]) {
        const p = this.players.get(d);
        const c = choices.find((x) => x.voter === d);
        if (this.finalRole(p.card) === 'n_chasseur' && c && c.target && !dead.includes(c.target)) { dead.push(c.target); hunterKills.push(c.target); grew = true; }
      }
    }
    for (const d of dead) { const p = this.players.get(d); p.alive = false; p.death = { cause: hunterKills.includes(d) ? 'chasseur' : 'vote', when: 'Jour' }; }
    s.result = { choices, tally, dead };
    s.resolved = true;
    this.lastVote = { choices, tally, dead };
    this.endGame(this.outcome(dead));
  }

  outcome(dead) {
    const gp = this.gamePlayers();
    const role = (p) => this.finalRole(p.card);
    const wolvesInPlay = gp.some((p) => role(p) === 'n_loup');
    const wolfDied = dead.some((d) => role(this.players.get(d)) === 'n_loup');
    const tannerDied = dead.some((d) => role(this.players.get(d)) === 'n_tanneur');
    const villageWin = wolfDied || (!wolvesInPlay && dead.length === 0);
    const wolfWin = wolvesInPlay && !wolfDied && !tannerDied;
    const minionNoWolf = !wolvesInPlay && dead.some((d) => role(this.players.get(d)) !== 'n_sbire');
    const winners = gp.filter((p) => {
      const r = role(p);
      if (r === 'n_tanneur') return dead.includes(p.id);
      if (r === 'n_loup') return wolfWin;
      if (r === 'n_sbire') return wolvesInPlay ? wolfWin : minionNoWolf;
      return VILLAGE.includes(r) || r === 'n_double' ? villageWin : false;
    }).map((p) => p.id);
    const names = (ids) => ids.map((x) => this.name(x)).join(', ');
    const deadTxt = dead.length ? `Éliminé${dead.length > 1 ? 's' : ''} : ${names(dead)}.` : 'Personne n\'est éliminé.';
    let text, team;
    if (villageWin && tannerDied) { team = 'village'; text = 'Le village et le Tanneur gagnent !'; }
    else if (villageWin) { team = 'village'; text = wolvesInPlay ? 'Le village gagne : un loup est tombé !' : "Le village gagne : il n'y avait aucun loup."; }
    else if (wolfWin) { team = 'loups'; text = 'Les loups gagnent : aucun loup éliminé.'; }
    else if (tannerDied) { team = 'tanneur'; text = 'Le Tanneur gagne : il voulait mourir !'; }
    else if (minionNoWolf && winners.length) { team = 'loups'; text = 'Le Sbire gagne : aucun loup, mais quelqu\'un est tombé.'; }
    else { team = 'personne'; text = "Personne ne gagne : il n'y avait aucun loup et quelqu'un est mort."; }
    return { team, text: `${deadTxt} ${text}`, winners };
  }

  endGame(w) {
    clearTimeout(this.timer);
    this.addLog(w.text, true);
    this.phase = 'end';
    this.winner = w;
    this.queue = [];
    for (const p of this.gamePlayers()) p.role = this.finalRole(p.card);
    this.changed();
  }

  kick(byId, targetId) {
    if (byId !== this.hostId) throw new Error("Seul l'hôte peut exclure un joueur.");
    if (byId === targetId) throw new Error('Tu ne peux pas t\'exclure toi-même.');
    const p = this.players.get(targetId);
    if (!p) throw new Error('Joueur introuvable.');
    if (this.phase === 'lobby') { this.removePlayer(targetId); return p; }
    p.kicked = true; p.connected = false;
    p.token = crypto.randomBytes(16).toString('hex');
    this.addLog(`${p.name} a été exclu(e) de la partie.`, true);
    const s = this.step;
    if (s && !s.resolved && s.actors.includes(targetId)) {
      s.actors = s.actors.filter((a) => a !== targetId);
      delete s.inputs[targetId];
      if (s.type === 'vote' && s.actors.length && s.actors.every((a) => a in s.inputs)) { this.resolveStep(); return p; }
    }
    this.changed();
    return p;
  }

  // ---------- Vue de chaque joueur ----------
  roleVisible() { return false; }

  viewFor(id) {
    const me = this.players.get(id);
    if (!me) return null;
    const end = this.phase === 'end';
    const started = this.phase !== 'lobby';
    const reveal = !!(this.test && this.test.reveal && this.test.me === id) && started;
    const winners = end && this.winner ? this.winner.winners || [] : [];
    const n = this.gamePlayers().length;
    const players = this.order.map((pid) => {
      const p = this.players.get(pid);
      let role = null;
      const known = me.known || {};
      if (p.waiting) role = null;
      else if (end || reveal) role = this.finalRole(p.card);
      else if (started && pid === id) role = p.startRole;
      else if (started && known[pid]) role = known[pid];
      return {
        id: p.id, name: p.name, connected: p.connected, alive: p.waiting ? false : end ? p.alive : true, isMJ: false, captain: false, idiotRevealed: false,
        cam: p.cam, mic: p.mic, conn: p.conn, kicked: !!p.kicked, death: p.death, role, lover: null, waiting: !!p.waiting,
        startRole: end || reveal ? p.startRole : null, bot: !!p.bot, won: winners.includes(p.id), seenRole: !end && pid !== id && !!known[pid]
      };
    });
    const s = this.step;
    return {
      me: {
        id, name: me.name, isHost: id === this.hostId, isMJ: false, canControl: id === this.hostId,
        alive: !me.waiting, waiting: !!me.waiting, role: started && !me.waiting ? me.startRole : null, lover: null, canVote: !me.waiting, conn: me.conn, seesAll: end,
        seen: [], wolves: [], isWolf: false, knownSelf: me.knownSelf, finalRole: end ? this.finalRole(me.card) : null,
        won: winners.includes(id), notes: me.notes || []
      },
      room: {
        code: this.code, game: this.game, phase: this.phase, hostId: this.hostId, settings: this.settings, night: this.night, day: this.day,
        minPlayers: MIN, recommended: 4, maxPlayers: MAX, captainId: null, potions: null, waitingMJ: false,
        winner: this.winner, serverNow: Date.now(), powersLost: false,
        nightOrder: (this.phase === 'day' || end) && this.nightOrder ? this.nightOrder : null,
        phaseSteps: this.phaseSteps.map((t, i) => ({ type: t, state: i < this.phaseCursor || (i === this.phaseCursor && s && s.resolved) ? 'done' : i === this.phaseCursor ? 'now' : 'next' }))
      },
      media: this.mediaFor(me),
      players,
      compo: this.anarchy && started && !end ? BOX : this.effectiveCompo(),
      customCompo: !!this.customCompo,
      anarchy: !!this.anarchy,
      presets: this.phase === 'lobby' ? this.presetsFor(n) : [],
      expectedCards: n + 3,
      compoVoteResult: null,
      log: this.log.filter((l) => l.pub || end).slice(-40),
      nightLog: end ? this.nightLog : null,
      lastVote: end ? this.lastVote : null,
      center: started ? {
        label: 'Au centre',
        cards: this.center.map((c, i) => (end || reveal ? c : (me.knownCenter || {})[i] || null)),
        startCards: null
      } : null,
      step: this.stepView(me, end)
    };
  }

  stepView(me) {
    const s = this.step;
    if (!s || this.phase === 'end') return null;
    const isActor = s.actors.includes(me.id);
    const night = NIGHT.includes(s.type);
    const v = {
      type: s.type, narration: this.narration(s.type), deadline: s.deadline, nextAt: null, resolved: s.resolved, round: 1, isActor,
      submitted: isActor && me.id in s.inputs, myInput: isActor ? s.inputs[me.id] : undefined,
      done: night ? (isActor ? Object.keys(s.inputs).filter((x) => x === me.id) : []) : Object.keys(s.inputs),
      actorsCount: night ? null : s.actors.length,
      actors: night ? [] : s.actors,
      result: null, doppel: !!s.doppel
    };
    if (!isActor || s.resolved) {
      if (s.type === 'vote' && s.resolved && s.result) v.result = { choices: s.result.choices, tally: s.result.tally };
      return v;
    }
    const others = this.others(me.id);
    const priv = (s.priv || {})[me.id] || null;
    switch (s.type) {
      case 'n_double': case 'n_voleur': case 'vote': v.options = others; break;
      case 'n_voyante': v.options = others; v.centerPick = 2; break;
      case 'n_noiseuse': v.options = others; break;
      case 'n_soulard': v.centerPick = 1; break;
      case 'n_loups':
        v.mates = s.actors.filter((x) => x !== me.id);
        v.lone = !!s.lone;
        if (s.lone) v.centerPick = 1;
        break;
      case 'n_sbire':
        v.wolves = this.wolfIds();
        break;
      case 'n_macons':
        v.mates = s.actors.filter((x) => x !== me.id);
        break;
      case 'n_insomniaque':
        v.result = { self: me.card };
        break;
    }
    if (priv) v.result = priv;
    if (v.submitted) { delete v.options; delete v.centerPick; }
    return v;
  }
}

module.exports = { OneNightRoom, ROLES: ROLES, RULES, PRESETS };
