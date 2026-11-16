// Moteur de jeu : un salon (Room) = une partie.
const crypto = require('crypto');
const { ROLES, MAX_PLAYERS, autoComposition, votedComposition, compoSize, extAllowed } = require('./roles');

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
  roles_reveal: 0, compoVote: 8, cupidon: 3, salvateur: 2, voyante: 4, loups: 4, sorciere: 2,
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
  vote: 'Le village vote pour éliminer un suspect.',
  hunter: 'Le Chasseur, en mourant, choisit qui emporter avec lui.',
  successor: 'Le Capitaine désigne son successeur.'
};

const NIGHT_TYPES = ['cupidon', 'salvateur', 'voyante', 'loups', 'sorciere'];
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
    this.winner = null;
    this.compoVoteResult = null;
    this.phaseSteps = [];
    this.phaseCursor = -1;
    for (const p of this.players.values()) {
      Object.assign(p, { alive: true, role: null, lover: null, seen: {}, idiotRevealed: false, ancienHit: false, canVote: true, death: null });
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
    if (this.hostId === id) this.hostId = this.order[0] || null;
    this.changed();
  }

  byToken(token) {
    for (const p of this.players.values()) if (p.token === token) return p;
    return null;
  }

  // Infos publiques d'un salon (écran « Rejoindre ») : qui est déconnecté, peut-on entrer ?
  publicInfo() {
    return {
      code: this.code, phase: this.phase, canJoin: this.phase === 'lobby',
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
    const max = role === 'loup' || role === 'villageois' ? MAX_PLAYERS : 1;
    c[role] = Math.min(max, Math.max(0, (c[role] || 0) + (delta > 0 ? 1 : -1)));
    if (!c[role]) delete c[role];
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
      if (compoSize(c) !== n) throw new Error(`La composition compte ${compoSize(c)} cartes pour ${n} joueurs.`);
      if (!c.loup) throw new Error('Il faut au moins un Loup-Garou.');
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
    this.gamePlayers().forEach((p, i) => { p.role = shuffled[i]; });
    this.phase = 'setup';
    if (!this.phaseSteps.includes('roles_reveal')) this.phaseSteps = ['roles_reveal'];
    this.startStep({ type: 'roles_reveal', actors: this.gamePlayers().map((p) => p.id), seconds: 20 });
  }

  // ---------- Machine à étapes ----------
  startStep(step) {
    this.startStepHook(step);
    const idx = this.phaseSteps.indexOf(step.type);
    if (idx >= 0) this.phaseCursor = idx;
    clearTimeout(this.timer);
    this.waitingMJ = false;
    step.inputs = {};
    step.resolved = false;
    step.round = step.round || 1;
    step.rounds = step.rounds || [];
    if (step.type === 'check') { this.step = step; return this.resolveStep(); }
    const secs = step.actors.length ? (step.seconds || this.settings.nightSeconds) : (step.seconds || 6 + crypto.randomInt(5));
    step.deadline = Date.now() + secs * 1000 * F;
    this.step = step;
    if (step.type === 'dawn') return this.resolveStep();
    this.timer = setTimeout(() => this.resolveStep(), secs * 1000 * F);
    this.changed();
  }

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
        value = true; break;
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
        if (!isAlive(payload.target) || this.players.get(payload.target).role === 'loup') throw new Error('Cible invalide.');
        value = payload.target; break;
      case 'sorciere': {
        const save = !!payload.save && this.potions.life && !!s.victim;
        let kill = payload.kill || null;
        if (kill && (!this.potions.death || !isAlive(kill))) throw new Error('Cible invalide.');
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
        if (t && t.length === 2) {
          this.lovers = t;
          this.players.get(t[0]).lover = t[1];
          this.players.get(t[1]).lover = t[0];
          this.addLog(`Cupidon unit ${this.name(t[0])} et ${this.name(t[1])}.`, false);
        }
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
          s.deadline = Date.now() + 30000 * F;
          this.timer = setTimeout(() => this.resolveStep(), 30000 * F);
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
        const v = this.victim;
        if (v && this.protected !== v && !this.saved) {
          const vp = this.players.get(v);
          if (vp.role === 'ancien' && !vp.ancienHit) {
            vp.ancienHit = true;
            this.addLog("L'Ancien résiste à l'attaque des loups.", false);
          } else this.kill(v, 'loups', triggers);
        } else if (v) this.addLog(`${this.name(v)} est sauvé(e) cette nuit.`, false);
        if (this.witchKill) this.kill(this.witchKill, 'sorciere', triggers);
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
          const bouc = this.aliveWithRole('bouc')[0];
          if (bouc) {
            this.kill(bouc.id, 'bouc', triggers);
            res.text = `Égalité : le Bouc émissaire, ${bouc.name}, est sacrifié.`;
          } else res.text = "Égalité : personne n'est éliminé.";
        } else {
          const t = this.players.get(res.top[0]);
          if (t.role === 'idiot' && !t.idiotRevealed) {
            t.idiotRevealed = true;
            t.canVote = false;
            res.text = `${t.name} est l'Idiot du village : gracié, mais il ne votera plus.`;
          } else {
            this.kill(t.id, 'vote', triggers);
            res.text = this.deathText(this.deaths, 'par le village');
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
    this.afterResolve(SHOW_DELAY[s.type] || 0);
  }

  afterResolve(delay) {
    if (this.settings.mjMode === 'joueur' && delay > 0) {
      this.waitingMJ = true;
      return this.changed();
    }
    if (delay > 0) {
      this.step.nextAt = Date.now() + delay * 1000 * F;
      this.timer = setTimeout(() => this.next(), delay * 1000 * F);
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
    this.victim = null; this.protected = null; this.saved = false; this.witchKill = null;
    this.addLog(`Nuit ${this.night} : le village s'endort.`, true);
    const steps = [];
    const actorsOf = (role) => this.aliveWithRole(role).map((p) => p.id);
    const add = (type, role) => { if (this.hasRoleInGame(role)) steps.push({ type, actors: actorsOf(role) }); };
    if (this.night === 1) add('cupidon', 'cupidon');
    add('salvateur', 'salvateur');
    add('voyante', 'voyante');
    steps.push({ type: 'loups', actors: actorsOf('loup') });
    if (this.hasRoleInGame('sorciere')) steps.push({ type: 'sorciere', actors: actorsOf('sorciere') });
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
    if (this.day === 1 && !this.captainId) steps.push({ type: 'captain_vote', actors: alive, seconds: this.settings.voteSeconds });
    steps.push({ type: 'debate', actors: alive, seconds: this.settings.debateSeconds });
    steps.push({ type: 'vote', actors: [], seconds: this.settings.voteSeconds, dynamicActors: true });
    this.phaseSteps = ['dawn', ...steps.map((x) => x.type)];
    this.phaseCursor = 0;
    this.queue.push(...steps);
  }

  // Les votants du vote sont calculés au moment du vote (un joueur a pu mourir entre-temps).
  startStepHook(step) {
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
    if (p.role === 'chasseur') triggers.push({ type: 'hunter', actors: [id], seconds: 40 });
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
      chagrin: "meurt de chagrin d'amour", exclu: 'a été exclu(e)'
    };
    return deaths.map((d) => {
      const role = this.settings.revealOnDeath ? ` Il/elle était ${ROLES[d.role].name}.` : '';
      return `${this.name(d.id)} ${phrase[d.cause] || 'meurt'}.${role}`;
    }).join(' ');
  }

  checkWin() {
    const alive = this.alive();
    if (!alive.length) return { team: 'personne', text: 'Tout le monde est mort. Personne ne gagne.' };
    if (this.lovers && alive.length === 2 && this.lovers.every((l) => alive.some((p) => p.id === l))) {
      const roles = this.lovers.map((l) => this.players.get(l).role);
      if (roles.includes('loup') && roles.some((r) => r !== 'loup')) return { team: 'amoureux', text: 'Les Amoureux gagnent ensemble !' };
    }
    const wolves = alive.filter((p) => p.role === 'loup').length;
    if (wolves === 0) return { team: 'village', text: 'Le Village a éliminé tous les loups !' };
    if (wolves >= alive.length - wolves) return { team: 'loups', text: 'Les Loups-Garous dévorent le village !' };
    return null;
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
    if (this.phase === 'day' || (st && DAY_STEPS.includes(st.type))) return FULL;
    // La nuit : les joueurs réveillés (acteurs de l'étape) voient tout le monde
    // et s'entendent entre eux ; les autres dorment et ne voient ni n'entendent personne.
    const awake = st && NIGHT_TYPES.includes(st.type) ? st.actors : [];
    if (awake.includes(r.id)) return { audio: awake.includes(s.id), video: true, blur: false };
    if (st && st.type === 'loups' && s.role === 'loup' && r.role === 'petitefille') return { audio: false, video: true, blur: true };
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
  roleVisible(viewer, target) {
    if (!viewer) return false;
    if (this.phase === 'end') return true;
    if (viewer.id === target.id) return true;
    if (this.isMJ(viewer.id)) return true;
    if (!viewer.alive && this.settings.deadSeeRoles && this.phase !== 'lobby') return true;
    if (!target.alive && this.settings.revealOnDeath) return true;
    if (target.idiotRevealed) return true;
    if (viewer.role === 'loup' && target.role === 'loup') return true;
    if (viewer.seen && viewer.seen[target.id]) return true;
    return false;
  }

  viewFor(id) {
    const me = this.players.get(id);
    if (!me) return null;
    const omniscient = this.isMJ(id) || (!me.alive && this.settings.deadSeeRoles && this.phase !== 'lobby') || this.phase === 'end';
    const players = this.order.map((pid) => {
      const p = this.players.get(pid);
      const vis = this.phase !== 'lobby' && this.roleVisible(me, p);
      return {
        id: p.id, name: p.name, connected: p.connected, alive: p.alive, isMJ: this.isMJ(p.id),
        captain: this.captainId === p.id, idiotRevealed: p.idiotRevealed, cam: p.cam, mic: p.mic, conn: p.conn, kicked: !!p.kicked,
        death: p.death,
        role: vis ? p.role : null,
        lover: (omniscient || pid === id || me.lover === pid) && p.lover ? p.lover : null
      };
    });
    const view = {
      me: {
        id, name: me.name, isHost: id === this.hostId, isMJ: this.isMJ(id), canControl: this.canControl(id),
        alive: me.alive, role: me.role, lover: me.lover, canVote: me.canVote, conn: me.conn,
        seen: Object.entries(me.seen || {}).map(([t, r]) => ({ id: t, name: this.name(t), role: r })),
        wolves: me.role === 'loup' ? this.gamePlayers().filter((p) => p.role === 'loup').map((p) => p.id) : []
      },
      room: {
        code: this.code, phase: this.phase, hostId: this.hostId, settings: this.settings, night: this.night, day: this.day,
        minPlayers: MIN_PLAYERS, recommended: RECOMMENDED_PLAYERS, maxPlayers: MAX_PLAYERS, captainId: this.captainId,
        potions: me.role === 'sorciere' || this.isMJ(id) ? this.potions : null,
        waitingMJ: this.waitingMJ, winner: this.winner, serverNow: Date.now(),
        phaseSteps: this.phaseSteps.map((t, i) => ({
          type: t,
          state: i < this.phaseCursor || (i === this.phaseCursor && this.step && this.step.resolved && this.step.type === t) ? 'done' : i === this.phaseCursor ? 'now' : 'next'
        }))
      },
      media: this.mediaFor(me),
      players,
      compo: this.effectiveCompo(),
      customCompo: !!this.customCompo,
      compoVoteResult: this.compoVoteResult,
      log: this.log.filter((l) => l.pub || omniscient).slice(-40),
      step: this.stepView(me, omniscient)
    };
    return view;
  }

  stepView(me, omniscient) {
    const s = this.step;
    if (!s) return null;
    const isActor = s.actors.includes(me.id);
    const night = NIGHT_TYPES.includes(s.type);
    // La nuit, seuls les acteurs (et les omniscients) savent qui agit.
    const showProgress = !night || omniscient || isActor;
    const v = {
      type: s.type, narration: NARRATION[s.type] || '', deadline: s.deadline, nextAt: s.nextAt || null,
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
    if (s.resolved && s.result) {
      const r = s.result;
      if (['captain_vote', 'vote'].includes(s.type)) v.result = { choices: r.choices, tally: r.tally, text: r.text };
      else if (['dawn', 'hunter', 'successor'].includes(s.type)) v.result = { text: r.text };
      else if (s.type === 'voyante' && (isActor || omniscient)) v.result = { seen: r.seen };
      else if (s.type === 'loups' && (isActor || omniscient)) v.result = { victim: r.victim };
      else if (s.type === 'compoVote') v.result = { counts: r.counts, compo: r.compo };
    }
    // Vote : les choix restent cachés jusqu'à la révélation (même pour le MJ, sauf les siens).
    return v;
  }
}

module.exports = { Room, MIN_PLAYERS };
