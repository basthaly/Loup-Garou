// Moteur de jeu : un salon (Room) = une partie.
const crypto = require('crypto');
const { ROLES, WOLF_ROLES, MAX_PLAYERS, autoComposition, votedComposition, compoSize, extAllowed, cardStep, cardsNeeded } = require('./roles');

const MIN_PLAYERS = Math.max(2, parseInt(process.env.MIN_PLAYERS || '3', 10));
const RECOMMENDED_PLAYERS = 6;
// LG_FAST=1 accélère tous les délais (tests automatiques).
const F = process.env.LG_FAST ? 0.01 : parseFloat(process.env.LG_SPEED || '1');

const DEFAULT_SETTINGS = {
  mjMode: 'site',            // 'site' | 'joueur'
  mjId: null,
  distribution: 'auto',      // 'auto' | 'vote'
  extensions: { nouvelleLune: true, personnages: true },
  revealOnDeath: true,
  deadSeeRoles: true,
  debateSeconds: 180,
  voteSeconds: 60,
  nightSeconds: 40
};

// Temps d'affichage (s) après la résolution d'une étape, en mode MJ automatique.
const SHOW_DELAY = {
  // La nuit, on enchaîne : seuls la Voyante et le Renard ont un résultat à lire.
  roles_reveal: 0, compoVote: 6, cupidon: 0, salvateur: 0, voyante: 3, loups: 0, sorciere: 0,
  voleur: 0, soeurs: 0, amoureux: 0, enfant: 0, renard: 3, infect: 0, grandloup: 0, loupblanc: 0, flute: 0,
  dawn: 7, captain_vote: 8, debate: 0, vote: 9, hunter: 5, successor: 4, check: 0
};

const NARRATION = {
  compoVote: 'Chacun vote pour les rôles à inclure dans la partie.',
  roles_reveal: 'Découvrez votre rôle en secret.',
  cupidon: 'Cupidon se réveille et désigne deux amoureux.',
  salvateur: 'Le Salvateur se réveille et choisit qui protéger.',
  voyante: 'La Voyante se réveille et sonde un joueur.',
  loups: 'Les Loups-Garous se réveillent et désignent leur victime.',
  sorciere: 'La Sorcière se réveille.',
  dawn: 'Le jour se lève sur le village…',
  captain_vote: 'Le village élit son Capitaine. Son vote comptera double.',
  debate: 'Le village débat. Qui est le loup ?',
  vote: 'Le village débat et vote pour éliminer un suspect.',
  hunter: 'Le Chasseur, en mourant, choisit qui emporter avec lui.',
  successor: 'Le Capitaine désigne son successeur.',
  voleur: 'Le Voleur se réveille et peut échanger sa carte.',
  soeurs: 'Les Sœurs se réveillent et se concertent.',
  amoureux: 'Les Amoureux se réveillent et se découvrent.',
  enfant: "L'Enfant Sauvage se réveille et choisit son modèle.",
  renard: 'Le Renard se réveille et flaire un joueur.',
  infect: "L'Infect Père des Loups peut infecter la victime.",
  grandloup: 'Le Grand Méchant Loup choisit une autre victime.',
  loupblanc: 'Le Loup-Garou Blanc se réveille.',
  flute: 'Le Joueur de flûte charme deux joueurs.'
};

const NIGHT_TYPES = ['voleur', 'cupidon', 'amoureux', 'soeurs', 'enfant', 'salvateur', 'voyante', 'renard', 'loups', 'infect', 'grandloup', 'loupblanc', 'sorciere', 'flute'];
// Rôle de chaque étape de nuit (les acteurs sont calculés au début de l'étape).
const STEP_ROLE = { voleur: 'voleur', cupidon: 'cupidon', soeurs: 'soeur', enfant: 'enfant', salvateur: 'salvateur', voyante: 'voyante', renard: 'renard', infect: 'infect', grandloup: 'grandloup', loupblanc: 'loupblanc', sorciere: 'sorciere', flute: 'flute' };
const MAX_NIGHTS = 40;
const PUBLIC_STEPS = ['compoVote', 'roles_reveal', 'captain_vote', 'debate', 'vote'];
const DAY_STEPS = ['dawn', 'captain_vote', 'debate', 'vote', 'hunter', 'successor'];
const FULL = { audio: true, video: true, blur: false };
const NONE = { audio: false, video: false, blur: false };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = (arr) => arr[crypto.randomInt(arr.length)];

class Room {
  constructor(code, onChange) {
    this.code = code;
    this.game = 'thiercelieux';
    this.speed = 1;   // page de test : minuteurs accélérés
    this.test = null; // page de test : { me, roles, reveal, auto }
    this.NIGHT = NIGHT_TYPES;
    this.DAY = DAY_STEPS;
    this.onChange = onChange || (() => {});
    this.players = new Map();
    this.order = [];
    this.hostId = null;
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.customCompo = null;
    this.lastActivity = Date.now();
    this.resetGame();
  }

  resetGame() {
    clearTimeout(this.timer);
    for (const [id, p] of this.players) if (p.kicked) { this.players.delete(id); this.order = this.order.filter((x) => x !== id); }
    this.timer = null;
    this.phase = 'lobby';
    this.step = null;
    this.queue = [];
    this.waitingMJ = false;
    this.log = [];
    this.night = 0;
    this.day = 0;
    this.compo = null;
    this.lovers = null;
    this.captainId = null;
    this.potions = { life: true, death: true };
    this.lastProtected = null;
    this.powersLost = false;
    this.winner = null;
    this.compoVoteResult = null;
    this.extraCards = [];
    this.thiefId = null;
    this.wolfDied = false;
    this.infectUsed = false;
    this.foxLost = false;
    this.rustyPending = null;
    this.angelWin = false;
    this.phaseSteps = [];
    this.phaseCursor = -1;
    for (const p of this.players.values()) {
      Object.assign(p, { alive: true, role: null, lover: null, seen: {}, idiotRevealed: false, ancienHit: false, canVote: true, death: null, infected: false, model: null, wildTurned: false, charmed: false, origRole: null, foxNotes: [] });
    }
  }

  // ---------- Joueurs ----------
  addPlayer(name) {
    if (this.phase !== 'lobby') throw new Error('La partie a déjà commencé.');
    if (this.players.size >= MAX_PLAYERS + 1) throw new Error('Le salon est plein.');
    name = String(name || '').trim().slice(0, 20);
    if (!name) throw new Error('Choisis un pseudo.');
    for (const p of this.players.values()) if (p.name.toLowerCase() === name.toLowerCase()) throw new Error('Ce pseudo est déjà pris.');
    const p = {
      id: crypto.randomBytes(6).toString('hex'), token: crypto.randomBytes(16).toString('hex'), name,
      connected: true, alive: true, role: null, lover: null, seen: {}, idiotRevealed: false, ancienHit: false, canVote: true,
      death: null, cam: false, mic: false, conn: null
    };
    this.players.set(p.id, p);
    this.order.push(p.id);
    if (!this.hostId) this.hostId = p.id;
    this.changed();
    return p;
  }

  removePlayer(id) {
    if (this.phase !== 'lobby') return;
    this.players.delete(id);
    this.order = this.order.filter((x) => x !== id);
    if (this.settings.mjId === id) this.settings.mjId = null;
    if (this.hostId === id) this.hostId = null;
    this.ensureHost(true);
    this.changed();
  }

  // L'hôte donne la main à un autre joueur connecté.
  transferHost(byId, targetId) {
    if (byId !== this.hostId) throw new Error("Seul l'hôte peut passer la main.");
    const t = this.players.get(targetId);
    if (!t || t.kicked || !t.connected) throw new Error('Ce joueur n\'est pas connecté.');
    if (targetId === byId) return;
    this.hostId = targetId;
    this.addLog(`${t.name} devient l'hôte.`, true);
    this.changed();
  }

  // Si l'hôte (ou le MJ joueur) est parti, on passe la main pour que personne ne reste bloqué.
  ensureHost(silent) {
    let changed = false;
    const host = this.players.get(this.hostId);
    if (!host || !host.connected || host.kicked) {
      const next = this.order.map((id) => this.players.get(id)).find((p) => p && p.connected && !p.kicked);
      if (next && next.id !== this.hostId) {
        this.hostId = next.id;
        this.addLog(`${next.name} devient l'hôte.`, true);
        changed = true;
      }
    }
    if (this.settings.mjMode === 'joueur') {
      const mj = this.players.get(this.settings.mjId);
      if (!mj || !mj.connected) {
        if (this.phase === 'lobby') this.settings.mjId = null;
        else {
          this.settings.mjMode = 'site';
          this.settings.mjId = null;
          this.addLog('Le MJ est parti : le site reprend la main.', true);
          if (this.waitingMJ) { this.waitingMJ = false; this.next(); return true; }
        }
        changed = true;
      }
    }
    if (changed && !silent) this.changed();
    return changed;
  }

  byToken(token) {
    for (const p of this.players.values()) if (p.token === token) return p;
    return null;
  }

  // Infos publiques d'un salon (écran « Rejoindre ») : qui est déconnecté, peut-on entrer ?
  publicInfo() {
    return {
      code: this.code, game: this.game, phase: this.phase, canJoin: this.phase === 'lobby',
      players: this.order.map((id) => this.players.get(id)).filter((p) => p && !p.kicked)
        .map((p) => ({ id: p.id, name: p.name, connected: p.connected }))
    };
  }

  // Reprendre la place d'un joueur déconnecté (onglet fermé, bug, changement d'appareil).
  reclaim(playerId) {
    const p = this.players.get(playerId);
    if (!p || p.kicked) throw new Error('Ce joueur n\'existe plus.');
    if (p.connected) throw new Error('Ce joueur est déjà connecté.');
    p.token = crypto.randomBytes(16).toString('hex');
    return p;
  }

  kick(byId, targetId) {
    if (byId !== this.hostId && !this.isMJ(byId)) throw new Error("Seul l'hôte peut exclure un joueur.");
    if (byId === targetId) throw new Error('Tu ne peux pas t\'exclure toi-même.');
    const p = this.players.get(targetId);
    if (!p) throw new Error('Joueur introuvable.');
    if (this.phase === 'lobby') { this.removePlayer(targetId); return p; }
    p.kicked = true;
    p.connected = false;
    p.token = crypto.randomBytes(16).toString('hex');
    this.addLog(`${p.name} a été exclu(e) de la partie.`, true);
    if (this.isMJ(targetId)) {
      this.settings.mjMode = 'site';
      this.settings.mjId = null;
      this.addLog('Le site reprend le rôle de maître du jeu.', true);
    }
    if (this.phase === 'end') { this.changed(); return p; }
    if (p.alive) {
      this.deaths = [];
      const triggers = [];
      this.kill(targetId, 'exclu', triggers);
      // Un exclu ne tire pas et ne désigne personne : on garde seulement les déclenchements des autres morts (amoureux).
      const keep = triggers.filter((t) => !t.actors.includes(targetId));
      if (this.captainId === null && triggers.some((t) => t.type === 'successor' && t.actors.includes(targetId))) {
        const alive = this.alive();
        if (alive.length) this.captainId = pick(alive).id;
      }
      this.queue.unshift(...keep);
    }
    const s = this.step;
    if (s && !s.resolved && s.actors.includes(targetId)) {
      s.actors = s.actors.filter((a) => a !== targetId);
      delete s.inputs[targetId];
    }
    const w = this.checkWin();
    if (w) { this.endGame(w); return p; }
    if (s && !s.resolved && s.actors.length && s.actors.every((a) => a in s.inputs)) this.resolveStep();
    else this.changed();
    return p;
  }

  setMedia(id, m) {
    const p = this.players.get(id);
    if (!p) return;
    p.cam = !!m.cam;
    p.mic = !!m.mic;
    this.changed();
  }

  isMJ(id) { return this.settings.mjMode === 'joueur' && this.settings.mjId === id; }
  canControl(id) { return this.settings.mjMode === 'joueur' ? this.isMJ(id) : id === this.hostId; }
  gamePlayers() { return this.order.map((id) => this.players.get(id)).filter((p) => p && !this.isMJ(p.id)); }
  alive() { return this.gamePlayers().filter((p) => p.alive); }
  name(id) { const p = this.players.get(id); return p ? p.name : '?'; }
  hasRoleInGame(role) { return this.gamePlayers().some((p) => p.role === role); }
  aliveWithRole(role) { return this.alive().filter((p) => p.role === role); }
  // Loup = carte de loup, joueur infecté, ou Enfant Sauvage dont le modèle est mort.
  isWolf(p) { return !!p && (WOLF_ROLES.includes(p.role) || p.infected || (p.role === 'enfant' && p.wildTurned)); }
  // Camp des loups pour la victoire (le Loup-Garou Blanc joue seul).
  wolfTeam(p) { return this.isWolf(p) && p.role !== 'loupblanc'; }
  aliveWolves() { return this.alive().filter((p) => this.isWolf(p)); }
  // Cibles des loups : les non-loups ; s'il n'en reste aucun, les loups s'entre-dévorent.
  wolfTargets(selfId) {
    const prey = this.alive().filter((p) => !this.isWolf(p));
    return (prey.length ? prey : this.alive().filter((p) => p.id !== selfId)).map((p) => p.id);
  }
  // Voisins vivants (ordre de la table, en cercle).
  neighbors(id) {
    const ring = this.alive().map((p) => p.id);
    const i = ring.indexOf(id);
    if (i < 0 || ring.length < 2) return [];
    const out = [ring[(i - 1 + ring.length) % ring.length], ring[(i + 1) % ring.length]];
    return [...new Set(out)].filter((x) => x !== id);
  }
  cardsNeeded(compo) { return cardsNeeded(this.gamePlayers().length, compo || this.effectiveCompo()); }

  // ---------- Réglages et composition (salon) ----------
  updateSettings(id, patch) {
    if (id !== this.hostId) throw new Error("Seul l'hôte peut modifier les réglages.");
    if (this.phase !== 'lobby') throw new Error('La partie a commencé.');
    const s = this.settings;
    if (patch.mjMode === 'site' || patch.mjMode === 'joueur') s.mjMode = patch.mjMode;
    if ('mjId' in patch) s.mjId = this.players.has(patch.mjId) ? patch.mjId : null;
    if (patch.distribution === 'auto' || patch.distribution === 'vote') s.distribution = patch.distribution;
    if (patch.extensions) {
      for (const k of ['nouvelleLune', 'personnages']) if (k in patch.extensions) s.extensions[k] = !!patch.extensions[k];
    }
    for (const k of ['revealOnDeath', 'deadSeeRoles']) if (k in patch) s[k] = !!patch[k];
    if ('debateSeconds' in patch) s.debateSeconds = Math.min(1800, Math.max(30, parseInt(patch.debateSeconds, 10) || 180));
    if (this.customCompo) {
      for (const r of Object.keys(this.customCompo)) if (!extAllowed(r, s.extensions)) delete this.customCompo[r];
    }
    this.changed();
  }

  effectiveCompo() {
    if (this.compo) return this.compo;
    if (this.customCompo) return this.customCompo;
    return autoComposition(this.gamePlayers().length, this.settings.extensions);
  }

  changeCompo(id, role, delta) {
    if (id !== this.hostId || this.phase !== 'lobby') throw new Error("Seul l'hôte peut modifier la composition.");
    const def = ROLES[role];
    if (!def || !def.impl) throw new Error('Rôle pas encore disponible.');
    if (!extAllowed(role, this.settings.extensions)) throw new Error('Extension désactivée.');
    const c = Object.assign({}, this.effectiveCompo());
    const step = cardStep(role);
    const max = role === 'loup' || role === 'villageois' ? MAX_PLAYERS : step;
    c[role] = Math.min(max, Math.max(0, (c[role] || 0) + (delta > 0 ? step : -step)));
    if (!c[role]) delete c[role];
    // On garde le bon nombre de cartes en ajustant les simples villageois.
    if (role !== 'villageois') {
      const v = (c.villageois || 0) + this.cardsNeeded(c) - compoSize(c);
      if (v > 0) c.villageois = v; else delete c.villageois;
    }
    this.customCompo = c;
    this.changed();
  }

  resetCompo(id) {
    if (id !== this.hostId) return;
    this.customCompo = null;
    this.changed();
  }

  start(id) {
    if (id !== this.hostId) throw new Error("Seul l'hôte peut lancer la partie.");
    if (this.phase !== 'lobby') throw new Error('Déjà lancée.');
    if (this.settings.mjMode === 'joueur' && !this.players.has(this.settings.mjId)) throw new Error('Choisis le joueur qui sera MJ.');
    const n = this.gamePlayers().length;
    if (n < MIN_PLAYERS) throw new Error(`Il faut au moins ${MIN_PLAYERS} joueurs.`);
    if (n > MAX_PLAYERS) throw new Error(`${MAX_PLAYERS} joueurs maximum.`);
    if (this.settings.distribution === 'auto') {
      const c = this.effectiveCompo();
      const need = cardsNeeded(n, c);
      if (compoSize(c) !== need) throw new Error(`La composition compte ${compoSize(c)} cartes, il en faut ${need}.`);
      if (!WOLF_ROLES.some((r) => c[r] && r !== 'loupblanc')) throw new Error('Il faut au moins un Loup-Garou.');
      if (c.soeur && c.soeur !== 2) throw new Error('Les Sœurs vont par deux.');
      this.compo = Object.assign({}, c);
      this.addLog('La partie commence.', true);
      this.deal();
    } else {
      this.phase = 'setup';
      this.addLog('La partie commence : vote de la composition.', true);
      this.phaseSteps = ['compoVote', 'roles_reveal'];
      this.startStep({ type: 'compoVote', actors: this.gamePlayers().map((p) => p.id), seconds: 90 });
    }
  }

  deal() {
    const cards = [];
    for (const [r, k] of Object.entries(this.compo)) for (let i = 0; i < k; i++) cards.push(r);
    const shuffled = shuffle(cards);
    const gp = this.gamePlayers();
    gp.forEach((p, i) => { p.role = shuffled[i]; });
    // Les cartes en trop restent au centre pour le Voleur.
    this.extraCards = shuffled.slice(gp.length);
    this.applyForced();
    gp.forEach((p) => { p.origRole = p.role; p.foxNotes = []; });
    this.phase = 'setup';
    if (!this.phaseSteps.includes('roles_reveal')) this.phaseSteps = ['roles_reveal'];
    this.startStep({ type: 'roles_reveal', actors: this.gamePlayers().map((p) => p.id), seconds: 20 });
  }

  // ---------- Machine à étapes ----------
  startStep(step) {
    this.startStepHook(step);
    const idx = this.phaseSteps.indexOf(step.phaseType || step.type);
    if (idx >= 0) this.phaseCursor = idx;
    clearTimeout(this.timer);
    this.waitingMJ = false;
    step.inputs = {};
    step.resolved = false;
    step.round = step.round || 1;
    step.rounds = step.rounds || [];
    if (step.type === 'check') { this.step = step; return this.resolveStep(); }
    const secs = this.stepSeconds(step);
    step.deadline = Date.now() + secs * 1000 * F * this.speed;
    this.step = step;
    if (step.type === 'dawn') return this.resolveStep();
    this.timer = setTimeout(() => this.resolveStep(), secs * 1000 * F * this.speed);
    this.changed();
  }

  // Sans acteur (rôle mort ou absent), on attend quelques secondes pour ne rien dévoiler.
  stepSeconds(step) {
    if (step.actors.length) return step.seconds || this.settings.nightSeconds;
    return this.NIGHT.includes(step.type) || !step.seconds ? 6 + crypto.randomInt(5) : step.seconds;
  }
  narration(type) { return NARRATION[type] || ''; }
  showDelay(type) { return SHOW_DELAY[type] || 0; }

  act(id, payload) {
    const s = this.step;
    if (!s || s.resolved) throw new Error("Rien à faire pour l'instant.");
    if (!s.actors.includes(id)) throw new Error("Ce n'est pas ton tour.");
    payload = payload || {};
    const p = this.players.get(id);
    const isAlive = (t) => this.players.has(t) && this.players.get(t).alive && !this.isMJ(t);
    let value;
    switch (s.type) {
      case 'roles_reveal':
      case 'debate':
      case 'soeurs':
      case 'amoureux':
        value = true; break;
      case 'voleur': {
        const i = payload.take;
        if (i === null || i === undefined) {
          if (this.extraCards.length && this.extraCards.every((r) => WOLF_ROLES.includes(r))) throw new Error('Deux loups : tu dois en prendre un.');
          value = null;
        } else if (i === 0 || i === 1) value = i;
        else throw new Error('Carte invalide.');
        break;
      }
      case 'enfant':
        if (!isAlive(payload.target) || payload.target === id) throw new Error('Cible invalide.');
        value = payload.target; break;
      case 'renard':
        if (payload.target !== null && !isAlive(payload.target)) throw new Error('Cible invalide.');
        value = payload.target; break;
      case 'infect':
        value = !!payload.infect; break;
      case 'grandloup':
        if (!this.wolfTargets(id).includes(payload.target) || payload.target === this.victim) throw new Error('Cible invalide.');
        value = payload.target; break;
      case 'loupblanc':
        if (payload.target !== null && (!isAlive(payload.target) || payload.target === id || !this.isWolf(this.players.get(payload.target)))) throw new Error('Cible invalide.');
        value = payload.target; break;
      case 'flute': {
        const t = Array.isArray(payload.targets) ? [...new Set(payload.targets)] : [];
        const ok = this.fluteOptions(id);
        if (!t.length || t.length > 2 || !t.every((x) => ok.includes(x))) throw new Error('Choisis deux joueurs non charmés.');
        if (t.length < Math.min(2, ok.length)) throw new Error('Choisis deux joueurs.');
        value = t; break;
      }
      case 'compoVote': {
        const roles = Array.isArray(payload.roles) ? payload.roles : [];
        value = roles.filter((r) => ROLES[r] && ROLES[r].impl && r !== 'loup' && r !== 'villageois' && extAllowed(r, this.settings.extensions));
        break;
      }
      case 'cupidon': {
        const t = Array.isArray(payload.targets) ? payload.targets : [];
        if (t.length !== 2 || t[0] === t[1] || !t.every(isAlive)) throw new Error('Choisis deux joueurs différents.');
        value = t; break;
      }
      case 'salvateur':
        if (!isAlive(payload.target) || payload.target === this.lastProtected) throw new Error('Cible invalide.');
        value = payload.target; break;
      case 'voyante':
        if (!isAlive(payload.target) || payload.target === id) throw new Error('Cible invalide.');
        value = payload.target; break;
      case 'loups':
        if (!this.wolfTargets(id).includes(payload.target)) throw new Error('Cible invalide.');
        value = payload.target; break;
      case 'sorciere': {
        const save = !!payload.save && this.potions.life && !!s.victim;
        let kill = payload.kill || null;
        if (kill && (!this.potions.death || !isAlive(kill) || kill === id)) throw new Error('Cible invalide.');
        value = { save, kill }; break;
      }
      case 'captain_vote':
      case 'vote':
        if (payload.target !== null && !isAlive(payload.target)) throw new Error('Cible invalide.');
        if (s.type === 'vote' && payload.target === id) throw new Error('Tu ne peux pas voter contre toi.');
        value = payload.target; break;
      case 'hunter':
      case 'successor':
        if (!isAlive(payload.target)) throw new Error('Cible invalide.');
        value = payload.target; break;
      default:
        throw new Error('Action inconnue.');
    }
    s.inputs[id] = value;
    if (!p) return;
    if (s.actors.every((a) => a in s.inputs)) this.resolveStep();
    else this.changed();
  }

  resolveStep() {
    const s = this.step;
    if (!s || s.resolved) return;
    clearTimeout(this.timer);
    const triggers = [];
    const inputs = s.inputs;
    s.result = {};
    switch (s.type) {
      case 'compoVote': {
        const ballots = s.actors.map((a) => inputs[a] || []);
        const { compo, counts } = votedComposition(s.actors.length, this.settings.extensions, ballots);
        this.compo = compo;
        s.result = { counts, compo };
        this.compoVoteResult = { counts, voters: s.actors.length };
        this.queue.push({ type: 'deal' });
        break;
      }
      case 'roles_reveal':
        break;
      case 'cupidon': {
        let t = Object.values(inputs)[0];
        if (!t) t = shuffle(this.alive().map((p) => p.id)).slice(0, 2);
        t = this.testLovers(t);
        if (t && t.length === 2) {
          this.lovers = t;
          this.players.get(t[0]).lover = t[1];
          this.players.get(t[1]).lover = t[0];
          this.addLog(`Cupidon unit ${this.name(t[0])} et ${this.name(t[1])}.`, false);
        }
        break;
      }
      case 'voleur': {
        const thief = this.players.get(s.actors[0]);
        if (thief) this.thiefId = thief.id;
        let take = Object.values(inputs)[0];
        if (take === undefined && this.extraCards.length && this.extraCards.every((r) => WOLF_ROLES.includes(r))) take = crypto.randomInt(2);
        if (thief && (take === 0 || take === 1) && this.extraCards[take]) {
          const card = this.extraCards[take];
          this.extraCards[take] = 'voleur';
          thief.role = card;
          s.result.took = card;
          this.addLog(`Le Voleur devient ${ROLES[card].name}.`, false);
        } else if (thief) this.addLog('Le Voleur garde sa carte.', false);
        break;
      }
      case 'soeurs':
      case 'amoureux':
        break;
      case 'enfant': {
        const kid = this.players.get(s.actors[0]);
        if (kid) {
          let t = Object.values(inputs)[0];
          if (!t) { const o = this.alive().filter((p) => p.id !== kid.id); t = o.length ? pick(o).id : null; }
          kid.model = t;
          if (t) this.addLog(`L'Enfant Sauvage prend ${this.name(t)} pour modèle.`, false);
        }
        break;
      }
      case 'renard': {
        const t = Object.values(inputs)[0];
        if (t) {
          const ids = [t, ...this.neighbors(t)];
          const hasWolf = ids.some((x) => this.isWolf(this.players.get(x)));
          s.result.fox = { ids, hasWolf };
          for (const fp of s.actors.map((x) => this.players.get(x)).filter(Boolean)) (fp.foxNotes = fp.foxNotes || []).push({ ids, hasWolf, night: this.night });
          if (!hasWolf) this.foxLost = true;
          this.addLog(`Le Renard flaire ${ids.map((x) => this.name(x)).join(', ')} : ${hasWolf ? 'il y a un loup' : 'aucun loup, il perd son flair'}.`, false);
        }
        break;
      }
      case 'infect': {
        if (Object.values(inputs)[0] && this.victim && !this.infectUsed) {
          this.infectUsed = true;
          this.infecting = true;
          this.addLog(`L'Infect Père des Loups infecte ${this.name(this.victim)}.`, false);
          const w = this.queue.find((q) => q.type === 'sorciere');
          if (w) w.victim = null;
        }
        break;
      }
      case 'grandloup': {
        const t = Object.values(inputs)[0];
        if (t && t !== this.victim) { this.bigBadKill = t; this.addLog(`Le Grand Méchant Loup dévore aussi ${this.name(t)}.`, false); }
        break;
      }
      case 'loupblanc': {
        const t = Object.values(inputs)[0];
        if (t) { this.whiteKill = t; this.addLog(`Le Loup-Garou Blanc tue ${this.name(t)}.`, false); }
        break;
      }
      case 'flute': {
        const t = Object.values(inputs)[0] || [];
        for (const x of t) this.players.get(x).charmed = true;
        if (t.length) this.addLog(`Le Joueur de flûte charme ${t.map((x) => this.name(x)).join(' et ')}.`, false);
        s.result.charmed = t;
        break;
      }
      case 'salvateur': {
        const t = Object.values(inputs)[0] || null;
        this.protected = t;
        this.lastProtected = t;
        if (t) this.addLog(`Le Salvateur protège ${this.name(t)}.`, false);
        break;
      }
      case 'voyante': {
        for (const [seer, t] of Object.entries(inputs)) {
          const sp = this.players.get(seer);
          sp.seen[t] = this.players.get(t).role;
          s.result.seen = { id: t, role: sp.seen[t] };
          this.addLog(`La Voyante regarde ${this.name(t)} : ${ROLES[sp.seen[t]].name}.`, false);
        }
        break;
      }
      case 'loups': {
        const choices = s.actors.map((a) => ({ voter: a, target: inputs[a] || null }));
        const targets = choices.map((c) => c.target).filter(Boolean);
        s.rounds.push(choices);
        const unanimous = targets.length === s.actors.length && targets.every((t) => t === targets[0]);
        if (!unanimous && s.round < 2 && s.actors.length > 1 && targets.length > 0) {
          // Désaccord : les choix sont révélés aux loups, nouveau tour.
          s.round = 2;
          s.inputs = {};
          s.deadline = Date.now() + 30000 * F * this.speed;
          this.timer = setTimeout(() => this.resolveStep(), 30000 * F * this.speed);
          return this.changed();
        }
        let victim = null;
        if (targets.length) {
          const tally = {};
          for (const t of targets) tally[t] = (tally[t] || 0) + 1;
          const max = Math.max(...Object.values(tally));
          victim = pick(Object.keys(tally).filter((t) => tally[t] === max));
        }
        this.victim = victim;
        s.result.victim = victim;
        this.addLog(victim ? `Les loups choisissent ${this.name(victim)}.` : 'Les loups ne choisissent personne.', false);
        // La sorcière doit connaître la victime.
        const next = this.queue.find((q) => q.type === 'sorciere');
        if (next) next.victim = victim;
        break;
      }
      case 'sorciere': {
        const v = Object.values(inputs)[0];
        if (v) {
          if (v.save && this.potions.life && this.victim) {
            this.saved = true;
            this.potions.life = false;
            this.addLog(`La Sorcière sauve ${this.name(this.victim)}.`, false);
          }
          if (v.kill && this.potions.death) {
            this.witchKill = v.kill;
            this.potions.death = false;
            this.addLog(`La Sorcière empoisonne ${this.name(v.kill)}.`, false);
          }
        }
        break;
      }
      case 'dawn': {
        this.deaths = [];
        const rust = this.rustyPending;
        this.rustyPending = null;
        const attack = (id) => {
          const vp = this.players.get(id);
          if (!vp || !vp.alive) return;
          if (this.protected === id) return this.addLog(`${vp.name} est protégé(e) par le Salvateur.`, false);
          if (vp.role === 'ancien' && !vp.ancienHit) {
            vp.ancienHit = true;
            return this.addLog("L'Ancien résiste à l'attaque des loups.", false);
          }
          this.kill(id, 'loups', triggers);
        };
        const v = this.victim;
        if (v && this.infecting) {
          const vp = this.players.get(v);
          if (this.protected !== v && vp && vp.alive) { vp.infected = true; this.addLog(`${vp.name} devient loup.`, false); }
        } else if (v && !this.saved) attack(v);
        else if (v) this.addLog(`${this.name(v)} est sauvé(e) cette nuit.`, false);
        if (this.bigBadKill) attack(this.bigBadKill);
        if (this.whiteKill && this.protected !== this.whiteKill) this.kill(this.whiteKill, 'loupblanc', triggers);
        if (this.witchKill) this.kill(this.witchKill, 'sorciere', triggers);
        if (rust) this.kill(rust, 'rouille', triggers);
        s.result.deaths = this.deaths.slice();
        s.result.text = this.deathText(this.deaths, 'cette nuit');
        this.addLog(s.result.text, true);
        this.queue.unshift(...triggers, { type: 'check', then: 'day' });
        triggers.length = 0;
        break;
      }
      case 'captain_vote': {
        const res = this.countVotes(s, false);
        s.result = res;
        let cap = null;
        if (res.top.length) cap = res.top.length === 1 ? res.top[0] : pick(res.top);
        if (cap) {
          this.captainId = cap;
          res.text = `${this.name(cap)} est élu(e) Capitaine${res.top.length > 1 ? ' (tirage au sort entre les ex æquo)' : ''}.`;
        } else res.text = "Aucun Capitaine n'est élu.";
        this.addLog(res.text, true);
        break;
      }
      case 'debate':
        break;
      case 'vote': {
        this.deaths = [];
        const res = this.countVotes(s, true);
        s.result = res;
        if (!res.top.length) res.text = "Personne n'est éliminé.";
        else if (res.top.length > 1) {
          const bouc = this.powersLost ? null : this.aliveWithRole('bouc')[0];
          if (bouc) {
            this.kill(bouc.id, 'bouc', triggers);
            res.text = `Égalité : le Bouc émissaire, ${bouc.name}, est sacrifié.`;
          } else res.text = "Égalité : personne n'est éliminé.";
        } else {
          const t = this.players.get(res.top[0]);
          if (t.role === 'idiot' && !t.idiotRevealed && !this.powersLost) {
            t.idiotRevealed = true;
            t.canVote = false;
            res.text = `${t.name} est l'Idiot du village : gracié, mais il ne votera plus.`;
          } else {
            this.kill(t.id, 'vote', triggers);
            res.text = this.deathText(this.deaths, 'par le village');
            if (t.role === 'ange' && this.day === 1) this.angelWin = true;
          }
        }
        res.deaths = this.deaths.slice();
        this.addLog(res.text, true);
        this.queue.unshift(...triggers, { type: 'check', then: 'night' });
        triggers.length = 0;
        break;
      }
      case 'hunter': {
        this.deaths = [];
        const t = Object.values(inputs)[0];
        if (t) {
          this.kill(t, 'chasseur', triggers);
          s.result.text = this.deathText(this.deaths, 'par le Chasseur');
        } else s.result.text = "Le Chasseur n'a tiré sur personne.";
        this.addLog(s.result.text, true);
        break;
      }
      case 'successor': {
        let t = Object.values(inputs)[0];
        if (!t && this.alive().length) t = pick(this.alive()).id;
        this.captainId = t || null;
        s.result.text = t ? `${this.name(t)} devient Capitaine.` : '';
        if (t) this.addLog(s.result.text, true);
        break;
      }
      case 'check': {
        const w = this.checkWin();
        if (w) return this.endGame(w);
        this.queue = this.queue.filter((q) => q.type !== 'check');
        if (s.then === 'day') { this.planDay(); return this.next(); }
        return this.planNight();
      }
    }
    if (triggers.length) this.queue.unshift(...triggers);
    s.resolved = true;
    this.afterResolve(this.showDelay(s.type));
  }

  afterResolve(delay) {
    if (this.settings.mjMode === 'joueur' && delay > 0) {
      this.waitingMJ = true;
      return this.changed();
    }
    if (delay > 0) {
      this.step.nextAt = Date.now() + delay * 1000 * F * this.speed;
      this.timer = setTimeout(() => this.next(), delay * 1000 * F * this.speed);
      return this.changed();
    }
    this.next();
  }

  // Bouton « Continuer » du MJ / de l'hôte, ou fin d'affichage.
  control(id) {
    if (!this.canControl(id)) throw new Error('Réservé au MJ.');
    if (this.step && !this.step.resolved) {
      // En mode automatique, l'hôte (qui joue) ne peut écourter que les étapes publiques.
      if (this.settings.mjMode === 'site' && !PUBLIC_STEPS.includes(this.step.type)) throw new Error("Impossible d'écourter une étape de nuit.");
      return this.resolveStep();
    }
    this.next();
  }

  next() {
    clearTimeout(this.timer);
    this.waitingMJ = false;
    if (this.phase === 'end') return this.changed();
    let nxt = this.queue.shift();
    if (!nxt) {
      if (this.step && this.step.type === 'roles_reveal') return this.planNight();
      return this.planNight();
    }
    if (nxt.type === 'deal') return this.deal();
    if (nxt.type === 'night_start') return this.planNight();
    // Partie déjà gagnée : pas de nouveau Capitaine à désigner. Le Chasseur tire seulement
    // si son tir peut encore changer l'issue (victoire des loups à l'égalité).
    if (nxt.type === 'successor' || nxt.type === 'hunter') {
      const w = this.checkWin();
      if (w && (nxt.type === 'successor' || w.team !== 'loups')) return this.endGame(w);
    }
    this.startStep(nxt);
  }

  planNight() {
    this.phase = 'night';
    this.night++;
    if (this.night > MAX_NIGHTS) return this.endGame({ team: 'personne', text: 'La partie s\'éternise : match nul.' });
    this.victim = null; this.protected = null; this.saved = false; this.witchKill = null;
    this.infecting = false; this.bigBadKill = null; this.whiteKill = null;
    this.addLog(`Nuit ${this.night} : le village s'endort.`, true);
    const n1 = this.night === 1;
    // Un rôle est appelé s'il est en jeu (même mort, pour ne rien dévoiler) ; la nuit 1, aussi s'il est au centre (Voleur).
    const inPlay = (role) => this.hasRoleInGame(role) || (n1 && this.extraCards.includes(role));
    const steps = [];
    const add = (type, extra) => { if (inPlay(STEP_ROLE[type])) steps.push(Object.assign({ type, actors: [], roleStep: true }, extra || {})); };
    const villagePowers = !this.powersLost;
    if (n1) {
      add('voleur'); add('cupidon');
      // Les Amoureux se réveillent ensemble pour se voir et se parler un instant.
      if (inPlay('cupidon')) steps.push({ type: 'amoureux', actors: [], seconds: 15 });
    }
    if (villagePowers && this.night % 2 === 1) add('soeurs', { seconds: 45 });
    if (n1) add('enfant');
    if (villagePowers) { add('salvateur'); add('voyante'); }
    if (villagePowers && !this.foxLost) add('renard');
    steps.push({ type: 'loups', actors: [], wolves: true });
    if (!this.infectUsed) add('infect', { seconds: 25 });
    if (!this.wolfDied) add('grandloup');
    if (this.night % 2 === 0) add('loupblanc');
    if (villagePowers) add('sorciere');
    add('flute');
    steps.push({ type: 'dawn', actors: [] });
    this.phaseSteps = steps.map((x) => x.type);
    this.phaseCursor = -1;
    this.queue = steps;
    this.next();
  }

  planDay() {
    this.phase = 'day';
    this.day++;
    const alive = this.alive().map((p) => p.id);
    const steps = [];
    // Pas d'étape de débat séparée : le vote s'ouvre tout de suite, on débat pendant qu'il est ouvert,
    // et il se clôt dès que tout le monde a voté (ou à la fin du temps réglé par l'hôte).
    if (this.day === 1 && !this.captainId) steps.push({ type: 'captain_vote', actors: alive, seconds: Math.max(this.settings.voteSeconds, 90) });
    steps.push({ type: 'vote', actors: [], seconds: this.settings.debateSeconds, dynamicActors: true });
    this.phaseSteps = ['dawn', ...steps.map((x) => x.type)];
    this.phaseCursor = 0;
    this.queue.push(...steps);
  }

  // Les votants du vote sont calculés au moment du vote (un joueur a pu mourir entre-temps).
  // Page de test : le testeur reçoit le rôle qu'il a choisi (échange avec la carte qui le portait).
  applyForced() {
    const f = this.test && this.test.roles;
    if (!f) return;
    const gp = this.gamePlayers();
    for (const [pid, role] of Object.entries(f)) {
      const p = this.players.get(pid);
      if (!p || p.role === role) continue;
      const holder = gp.find((q) => q.role === role && f[q.id] !== role);
      if (holder) { [p.role, holder.role] = [holder.role, p.role]; continue; }
      const i = this.extraCards.indexOf(role);
      if (i >= 0) [p.role, this.extraCards[i]] = [this.extraCards[i], p.role];
    }
  }

  // Page de test : le testeur peut être l'un des amoureux (avec un loup, un villageois ou au hasard).
  testLovers(t) {
    const want = this.test && this.test.lover;
    const me = want && this.players.get(this.test.me);
    if (!me || !me.alive) return t;
    const others = this.alive().filter((p) => p.id !== me.id);
    let pool = others;
    if (want === 'loup') pool = others.filter((p) => this.isWolf(p));
    if (want === 'village') pool = others.filter((p) => !this.isWolf(p));
    if (!pool.length) pool = others;
    const keep = (t || []).find((x) => x !== me.id && pool.some((p) => p.id === x));
    return [me.id, keep || pick(pool).id];
  }

  startStepHook(step) {
    // Étapes de nuit : les acteurs sont ceux qui ont le rôle au moment de l'étape (le Voleur a pu en changer).
    if (step.roleStep) step.actors = this.aliveWithRole(STEP_ROLE[step.type]).map((p) => p.id);
    if (step.wolves) step.actors = this.aliveWolves().map((p) => p.id);
    if (step.type === 'amoureux') step.actors = (this.lovers || []).filter((x) => this.players.get(x) && this.players.get(x).alive);
    if (step.type === 'infect' && (!this.victim || this.infectUsed)) step.actors = [];
    if (step.type === 'grandloup' && (this.wolfDied || !this.wolfTargets().some((t) => t !== this.victim))) step.actors = [];
    if (step.type === 'loupblanc' && !this.aliveWolves().some((p) => p.role !== 'loupblanc')) step.actors = [];
    if (step.type === 'flute' && step.actors.length && !this.fluteOptions(step.actors[0]).length) step.actors = [];
    if (step.dynamicActors) step.actors = this.alive().filter((p) => p.canVote).map((p) => p.id);
    if (step.type === 'captain_vote' || step.type === 'debate') step.actors = step.actors.filter((id) => this.players.get(id).alive);
  }

  countVotes(s, captainDouble) {
    const choices = s.actors.map((a) => ({ voter: a, target: s.inputs[a] === undefined ? null : s.inputs[a], double: captainDouble && a === this.captainId }));
    const tally = {};
    for (const c of choices) if (c.target) tally[c.target] = (tally[c.target] || 0) + (c.double ? 2 : 1);
    const max = Object.keys(tally).length ? Math.max(...Object.values(tally)) : 0;
    const top = max ? Object.keys(tally).filter((t) => tally[t] === max) : [];
    return { choices, tally, top };
  }

  kill(id, cause, triggers) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    p.alive = false;
    p.death = { cause, when: this.whenLabel() };
    this.deaths.push({ id, cause, role: p.role });
    if (this.isWolf(p)) this.wolfDied = true;
    // Enfant Sauvage : son modèle meurt, il devient loup.
    for (const k of this.alive()) {
      if (k.role === 'enfant' && k.model === id && !k.wildTurned) { k.wildTurned = true; this.addLog(`${k.name}, l'Enfant Sauvage, devient loup.`, false); }
    }
    // Chevalier tué par les loups : le premier loup après lui mourra la nuit suivante.
    if (p.role === 'chevalier' && cause === 'loups' && !this.powersLost) {
      const ring = this.order.filter((x) => x === id || (this.players.get(x).alive && !this.isMJ(x)));
      const i = ring.indexOf(id);
      for (let k = 1; k < ring.length; k++) {
        const w = this.players.get(ring[(i + k) % ring.length]);
        if (this.isWolf(w)) { this.rustyPending = w.id; this.addLog(`L'épée rouillée blesse ${w.name}.`, false); break; }
      }
    }
    if (p.role === 'ancien' && cause === 'vote' && !this.powersLost) {
      this.powersLost = true;
      this.addLog("Le village a éliminé l'Ancien : les villageois perdent leurs pouvoirs.", true);
    }
    if (p.role === 'chasseur' && !this.powersLost) triggers.push({ type: 'hunter', actors: [id], seconds: 40 });
    if (this.captainId === id) {
      this.captainId = null;
      if (this.alive().length) triggers.push({ type: 'successor', actors: [id], seconds: 40 });
    }
    if (p.lover) {
      const other = this.players.get(p.lover);
      if (other && other.alive) this.kill(other.id, 'chagrin', triggers);
    }
  }

  deathText(deaths, when) {
    if (!deaths.length) return when === 'cette nuit' ? "Personne n'est mort cette nuit." : "Personne n'est mort.";
    const phrase = {
      loups: 'est retrouvé(e) mort(e) ce matin', sorciere: 'est retrouvé(e) mort(e) ce matin',
      vote: 'est éliminé(e) par le village', bouc: 'est sacrifié(e)', chasseur: 'est abattu(e) par le Chasseur',
      chagrin: "meurt de chagrin d'amour", exclu: 'a été exclu(e)',
      loupblanc: 'est retrouvé(e) mort(e) ce matin', rouille: 'est retrouvé(e) mort(e) ce matin'
    };
    return deaths.map((d) => {
      const role = this.settings.revealOnDeath ? ` Il/elle était ${ROLES[d.role].name}.` : '';
      return `${this.name(d.id)} ${phrase[d.cause] || 'meurt'}.${role}`;
    }).join(' ');
  }

  checkWin() {
    const alive = this.alive();
    if (!alive.length) return { team: 'personne', text: 'Tout le monde est mort. Personne ne gagne.' };
    if (this.angelWin) return { team: 'ange', text: "L'Ange a été éliminé au premier vote : il gagne seul !" };
    if (this.lovers && alive.length === 2 && this.lovers.every((l) => alive.some((p) => p.id === l))) {
      const lv = this.lovers.map((l) => this.players.get(l));
      if (lv.some((p) => this.isWolf(p)) && lv.some((p) => !this.isWolf(p))) return { team: 'amoureux', text: 'Les Amoureux gagnent ensemble !' };
    }
    if (alive.length === 1 && alive[0].role === 'loupblanc') return { team: 'loupblanc', text: 'Le Loup-Garou Blanc reste seul : il gagne !' };
    const piper = alive.find((p) => p.role === 'flute');
    if (piper && alive.every((p) => p.id === piper.id || p.charmed)) return { team: 'flute', text: 'Tout le village est charmé : le Joueur de flûte gagne !' };
    const wolves = alive.filter((p) => this.isWolf(p)).length;
    if (wolves === 0) return piper ? null : { team: 'village', text: 'Le Village a éliminé tous les loups !' };
    const white = alive.some((p) => p.role === 'loupblanc');
    const pack = alive.filter((p) => this.wolfTeam(p)).length;
    if (!white && pack >= alive.length - pack) return { team: 'loups', text: 'Les Loups-Garous dévorent le village !' };
    return null;
  }

  fluteOptions(selfId) { return this.alive().filter((p) => p.id !== selfId && !p.charmed).map((p) => p.id); }

  // Cibles valides de l'étape pour un acteur (le client s'en sert pour savoir quelles tuiles toucher).
  optionsFor(s, id) {
    const alive = this.alive().map((p) => p.id);
    const others = alive.filter((x) => x !== id);
    switch (s.type) {
      case 'cupidon': case 'captain_vote': case 'renard': return alive;
      case 'salvateur': return alive.filter((x) => x !== this.lastProtected);
      case 'voyante': case 'vote': case 'enfant': case 'hunter': case 'successor': return others;
      case 'loups': return this.wolfTargets(id);
      case 'grandloup': return this.wolfTargets(id).filter((x) => x !== this.victim);
      case 'loupblanc': return others.filter((x) => this.isWolf(this.players.get(x)));
      case 'sorciere': return this.potions.death ? others : [];
      case 'flute': return this.fluteOptions(id);
      default: return null;
    }
  }

  endGame(w) {
    clearTimeout(this.timer);
    this.addLog(w.text, true);
    this.phase = 'end';
    this.winner = w;
    this.queue = [];
    this.step = null;
    this.changed();
  }

  // L'hôte arrête la partie en cours et ramène tout le monde au salon.
  abort(id) {
    if (id !== this.hostId) throw new Error("Seul l'hôte peut arrêter la partie.");
    if (this.phase === 'lobby') return;
    this.resetGame();
    this.addLog("L'hôte a arrêté la partie.", true);
    this.changed();
  }

  restart(id) {
    if (id !== this.hostId) throw new Error("Seul l'hôte peut relancer.");
    this.resetGame();
    this.changed();
  }

  whenLabel() {
    if (this.phase === 'night') return `Nuit ${this.night}`;
    if (this.phase === 'day') return `Jour ${this.day}`;
    return '';
  }

  addLog(text, pub) { this.log.push({ t: Date.now(), text, pub, when: this.whenLabel() }); }

  // ---------- Audio / vidéo : qui voit et entend qui ----------
  mediaAllowed(s, r) {
    if (!s || !r || s.id === r.id) return NONE;
    if (['lobby', 'setup', 'end'].includes(this.phase)) return FULL;
    if (this.isMJ(r.id) || this.isMJ(s.id)) return FULL;
    if (!s.alive) return r.alive ? NONE : FULL;      // un mort ne parle qu'aux morts
    if (!r.alive) return FULL;                         // les morts suivent tout
    const st = this.step;
    if (this.phase === 'day' || (st && this.DAY.includes(st.type))) return FULL;
    // La nuit : les joueurs réveillés (acteurs de l'étape) voient tout le monde
    // et s'entendent entre eux ; les autres dorment et ne voient ni n'entendent personne.
    const awake = st && this.NIGHT.includes(st.type) ? st.actors : [];
    if (awake.includes(r.id)) return { audio: awake.includes(s.id), video: true, blur: false };
    // Petite Fille : pendant le tour des loups, elle entrouvre les yeux et voit tout le village, flou,
    // et entend les loups de loin : voix très déformée et faible (traitée dans son navigateur).
    if (st && st.type === 'loups' && r.role === 'petitefille' && !this.powersLost) {
      const wolf = awake.includes(s.id);
      return { audio: wolf, video: true, blur: true, distort: wolf };
    }
    return NONE;
  }

  mediaFor(me) {
    const out = {};
    for (const p of this.players.values()) {
      if (p.id === me.id) continue;
      out[p.id] = { send: this.mediaAllowed(me, p), recv: this.mediaAllowed(p, me) };
    }
    return out;
  }

  changed() {
    this.lastActivity = Date.now();
    this.onChange(this);
  }

  // ---------- Ce que voit chaque joueur ----------
  // Un mort voit tous les rôles (option), sauf tant qu'il a encore une action (Chasseur, Capitaine).
  hasPendingAction(id) {
    const s = this.step;
    if (s && !s.resolved && s.actors.includes(id)) return true;
    return this.queue.some((q) => (q.type === 'hunter' || q.type === 'successor') && q.actors && q.actors.includes(id));
  }

  seesAll(p) {
    return !p.alive && this.settings.deadSeeRoles && this.phase !== 'lobby' && !this.hasPendingAction(p.id);
  }

  roleVisible(viewer, target) {
    if (!viewer) return false;
    if (this.phase === 'end') return true;
    if (viewer.id === target.id) return true;
    if (this.isMJ(viewer.id)) return true;
    if (this.test && this.test.reveal && this.test.me === viewer.id) return true;
    if (this.seesAll(viewer)) return true;
    if (!target.alive && this.settings.revealOnDeath) return true;
    if (target.idiotRevealed) return true;
    if (viewer.seen && viewer.seen[target.id]) return true;
    return false;
  }

  viewFor(id) {
    const me = this.players.get(id);
    if (!me) return null;
    const omniscient = this.isMJ(id) || this.seesAll(me) || this.phase === 'end' || !!(this.test && this.test.reveal && this.test.me === id);
    const meWolf = this.isWolf(me);
    const seeCharm = omniscient || me.charmed || me.role === 'flute';
    const players = this.order.map((pid) => {
      const p = this.players.get(pid);
      const started = this.phase !== 'lobby';
      let role = started && this.roleVisible(me, p) ? p.role : null;
      // Les loups se reconnaissent (sans connaître le rôle exact), les Sœurs aussi.
      if (started && !role && meWolf && this.isWolf(p)) role = 'loup';
      if (started && !role && me.role === 'soeur' && p.role === 'soeur') role = 'soeur';
      return {
        id: p.id, name: p.name, connected: p.connected, alive: p.alive, isMJ: this.isMJ(p.id),
        captain: this.captainId === p.id, idiotRevealed: p.idiotRevealed, cam: p.cam, mic: p.mic, conn: p.conn, kicked: !!p.kicked,
        death: p.death,
        role, bot: !!p.bot,
        charmed: seeCharm && p.charmed,
        infected: (omniscient || pid === id) && (p.infected || (p.role === 'enfant' && p.wildTurned)),
        // Cupidon voit le couple qu'il a formé.
        lover: (omniscient || pid === id || me.lover === pid || (me.origRole === 'cupidon' && this.lovers && this.lovers.includes(pid))) && p.lover ? p.lover : null
      };
    });
    const view = {
      me: {
        id, name: me.name, isHost: id === this.hostId, isMJ: this.isMJ(id), canControl: this.canControl(id),
        alive: me.alive, role: me.role, lover: me.lover, canVote: me.canVote, conn: me.conn, seesAll: this.seesAll(me),
        seen: Object.entries(me.seen || {}).map(([t, r]) => ({ id: t, name: this.name(t), role: r })),
        wolves: meWolf ? this.gamePlayers().filter((p) => this.isWolf(p)).map((p) => p.id) : [],
        isWolf: meWolf, infected: !!me.infected, charmed: !!me.charmed,
        model: me.role === 'enfant' ? me.model : null, wild: me.role === 'enfant' && me.wildTurned,
        foxLost: me.role === 'renard' && this.foxLost,
        origRole: this.phase !== 'lobby' ? me.origRole || null : null,
        // Salvateur : le joueur protégé cette nuit (et celui de la nuit dernière, qu'on ne peut pas reprendre).
        protects: me.role === 'salvateur' && this.phase === 'night' ? this.protected || null : null,
        foxNotes: me.role === 'renard' ? me.foxNotes || [] : []
      },
      room: {
        code: this.code, game: this.game, phase: this.phase, hostId: this.hostId, settings: this.settings, night: this.night, day: this.day,
        minPlayers: MIN_PLAYERS, recommended: RECOMMENDED_PLAYERS, maxPlayers: MAX_PLAYERS, captainId: this.captainId,
        potions: me.role === 'sorciere' || this.isMJ(id) ? this.potions : null,
        waitingMJ: this.waitingMJ, winner: this.winner, serverNow: Date.now(), powersLost: this.powersLost,
        phaseSteps: this.phaseSteps.map((t, i) => ({
          type: t,
          state: i < this.phaseCursor || (i === this.phaseCursor && this.step && this.step.resolved && this.step.type === t) ? 'done' : i === this.phaseCursor ? 'now' : 'next'
        }))
      },
      media: this.mediaFor(me),
      players,
      compo: this.effectiveCompo(),
      expectedCards: this.cardsNeeded(),
      center: this.centerView(me, omniscient),
      customCompo: !!this.customCompo,
      compoVoteResult: this.compoVoteResult,
      log: this.log.filter((l) => l.pub || omniscient).slice(-40),
      step: this.stepView(me, omniscient)
    };
    return view;
  }

  // Cartes au centre (Voleur) : face cachée pour tous, visibles par le Voleur qui les a vues, et à la fin.
  centerView(me, omniscient) {
    if (!this.extraCards.length || this.phase === 'lobby') return null;
    const known = omniscient || this.phase === 'end' || me.id === this.thiefId;
    return { cards: this.extraCards.map((c) => (known ? c : null)), label: 'Au centre' };
  }

  stepView(me, omniscient) {
    const s = this.step;
    if (!s) return null;
    const isActor = s.actors.includes(me.id);
    const night = this.NIGHT.includes(s.type);
    // La nuit, seuls les acteurs (et les omniscients) savent qui agit.
    const showProgress = !night || omniscient || isActor;
    const v = {
      type: s.type, narration: this.narration(s.type), deadline: s.deadline, nextAt: s.nextAt || null,
      resolved: s.resolved, round: s.round, isActor,
      submitted: isActor && me.id in s.inputs,
      myInput: isActor ? s.inputs[me.id] : undefined,
      done: showProgress ? Object.keys(s.inputs) : [],
      actorsCount: showProgress ? s.actors.length : null,
      actors: showProgress && !night ? s.actors : (omniscient || (isActor && s.type === 'loups') ? s.actors : []),
      result: null
    };
    if (s.type === 'loups' && (isActor || omniscient)) {
      v.rounds = s.rounds.map((r) => r.map((c) => ({ voter: c.voter, target: c.target })));
    }
    if (s.type === 'sorciere' && (isActor || omniscient)) {
      v.victim = s.victim || null;
      v.potions = this.potions;
    }
    if (s.type === 'salvateur' && (isActor || omniscient)) v.lastProtected = this.lastProtected;
    if (isActor && !s.resolved) { const o = this.optionsFor(s, me.id); if (o) v.options = o; }
    if (s.type === 'voleur' && (isActor || omniscient)) {
      v.cards = this.extraCards.slice();
      v.mustTake = this.extraCards.length > 0 && this.extraCards.every((r) => WOLF_ROLES.includes(r));
    }
    if (['infect', 'grandloup'].includes(s.type) && (isActor || omniscient)) v.victim = this.victim;
    if (s.type === 'amoureux' && isActor) v.partner = me.lover;
    if (s.resolved && s.result) {
      const r = s.result;
      if (['captain_vote', 'vote'].includes(s.type)) v.result = { choices: r.choices, tally: r.tally, text: r.text };
      else if (['dawn', 'hunter', 'successor'].includes(s.type)) v.result = { text: r.text };
      else if (s.type === 'voyante' && (isActor || omniscient)) v.result = { seen: r.seen };
      else if (s.type === 'renard' && (isActor || omniscient)) v.result = { fox: r.fox || null };
      else if (s.type === 'voleur' && (isActor || omniscient)) v.result = { took: r.took || null };
      else if (s.type === 'loups' && (isActor || omniscient)) v.result = { victim: r.victim };
      else if (s.type === 'compoVote') v.result = { counts: r.counts, compo: r.compo };
    }
    // Vote : les choix restent cachés jusqu'à la révélation (même pour le MJ, sauf les siens).
    return v;
  }
}

module.exports = { Room, MIN_PLAYERS, FULL, NONE, shuffle, pick, F };
