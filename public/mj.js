// Page cachée « MJ » : l'assistant du meneur pour une vraie partie de Loup-Garou autour d'une table.
// Le MJ note ce qui se passe ; l'app lui dit quoi lire, qui appeler, et tient le suivi.
// Tout reste dans ce navigateur (localStorage) : aucune connexion au serveur de jeu.
(() => {
  const KEY = 'lg-mj';
  const $root = document.getElementById('mj');
  const $toast = document.getElementById('toast');
  let R = {};            // rôles de Thiercelieux (depuis /api/roles)
  let S = null;          // la partie
  let undo = [];         // pile d'états pour « Annuler la dernière action »
  let ui = { sel: [], menu: null, voteMode: 'note', counts: {}, sorc: { save: false, kill: null }, choice: null, showSuivi: false };

  // ---------- Petits outils ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON = {
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    skip: '<path d="M5 5l9 7-9 7zM17 5v14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    skull: '<path d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3z"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    note: '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    wolf: '<path d="M4 4l4 5h8l4-5v9a8 8 0 0 1-16 0z"/><path d="M9 14h.01M15 14h.01"/>',
    quote: '<path d="M7 7h4v4H8a3 3 0 0 0 3 3v2a5 5 0 0 1-5-5V8zM14 7h4v4h-3a3 3 0 0 0 3 3v2a5 5 0 0 1-5-5V8z"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 5"/>',
    revive: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/><path d="M12 9v5M9.5 11.5h5"/>'
  };
  const icon = (k, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`;
  const card = (role, cls = 'mj-card') => `<img class="${cls}" src="${role ? `/cards/${role}.webp` : '/img/carte-dos.svg'}" alt="">`;
  const rn = (role) => (R[role] && R[role].name) || role || '?';
  const team = (role) => (R[role] && R[role].team) || 'village';
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const COLORS = ['#E8A75D', '#8DB4F0', '#C7A6E8', '#7FC8A9', '#F08A6C', '#E8C25D', '#F7A2AE', '#9CC0F0', '#B7D98A', '#F2B4E0', '#7FD1C8', '#D9A3F0'];
  const P = (id) => S.players.find((p) => p.id === id);
  const name = (id) => (P(id) || {}).name || '?';
  const avatar = (p, s = 28) => S.nameless && p.baseRole ? `<span class="mj-av card" style="width:${s}px;height:${s}px"><img src="/cards/${p.baseRole}.webp" alt=""></span>` : `<span class="mj-av" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.42)}px;background:${COLORS[S.players.indexOf(p) % COLORS.length]}">${esc(p.name[0] || '?')}</span>`;
  function toast(m) { $toast.textContent = m; $toast.classList.add('show', 'info'); clearTimeout(toast.t); toast.t = setTimeout(() => $toast.classList.remove('show'), 3500); }

  const WOLF_ROLES = ['loup', 'grandloup', 'infect', 'loupblanc'];
  const isWolf = (p) => WOLF_ROLES.includes(p.role) || p.infected || p.wild;
  const alive = () => S.players.filter((p) => p.alive);
  const holders = (role) => S.players.filter((p) => p.role === role);
  const inGame = (role) => (S.compo[role] || 0) > 0;

  // ---------- Sauvegarde ----------
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* plein ou privé */ } }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
  function snap() { undo.push(JSON.stringify(S)); if (undo.length > 60) undo.shift(); }
  function newState() {
    return { phase: 'setup', setupStep: 1, players: [], compo: { loup: 2, voyante: 1, sorciere: 1, chasseur: 1, cupidon: 1, villageois: 0 }, distrib: 'random', callDead: true,
      extra: [], night: 0, day: 0, steps: [], cursor: 0, potions: { life: true, death: true }, lastProtected: null, protected: null, victim: null,
      bigbad: null, white: null, poison: null, saved: false, infectNow: false, infectUsed: false, wolfDied: false, foxLost: false, rusty: null,
      firstVote: true, powersLost: false, log: [], winner: null, ignoreWin: false };
  }
  const log = (t) => { S.log.push({ when: S.phase === 'night' ? `Nuit ${S.night}` : S.phase === 'day' ? `Jour ${S.day}` : '', t }); };

  // ---------- Étapes ----------
  const NIGHT = ['voleur', 'cupidon', 'amoureux', 'soeurs', 'enfant', 'salvateur', 'voyante', 'renard', 'loups', 'infect', 'grandloup', 'loupblanc', 'sorciere', 'flute'];
  const LABEL = { voleur: 'Voleur', cupidon: 'Cupidon', amoureux: 'Amoureux', soeurs: 'Sœurs', enfant: 'Enfant sauvage', salvateur: 'Salvateur', voyante: 'Voyante', renard: 'Renard',
    loups: 'Loups-Garous', infect: 'Infect Père des Loups', grandloup: 'Grand Méchant Loup', loupblanc: 'Loup Blanc', sorciere: 'Sorcière', flute: 'Joueur de flûte',
    dawn: 'Aube', quick: 'Morts de la nuit', captain: 'Capitaine', vote: 'Vote', hunter: 'Chasseur', successor: 'Successeur' };
  const STEP_ROLE = { voleur: 'voleur', cupidon: 'cupidon', soeurs: 'soeur', enfant: 'enfant', salvateur: 'salvateur', voyante: 'voyante', renard: 'renard', loups: 'loup',
    infect: 'infect', grandloup: 'grandloup', loupblanc: 'loupblanc', sorciere: 'sorciere', flute: 'flute' };
  const SCRIPT = {
    voleur: '« Voleur, réveille-toi. Tu peux échanger ta carte contre l\'une des deux cartes du centre. »',
    cupidon: '« Cupidon, réveille-toi. Désigne les deux joueurs qui tomberont amoureux. »',
    amoureux: '« Je vais toucher la tête des amoureux. Amoureux, réveillez-vous et reconnaissez-vous. »',
    soeurs: '« Les deux Sœurs, réveillez-vous et reconnaissez-vous. »',
    enfant: '« Enfant sauvage, réveille-toi. Désigne ton modèle. »',
    salvateur: '« Salvateur, réveille-toi. Désigne le joueur que tu protèges cette nuit. »',
    voyante: '« Voyante, réveille-toi. Désigne le joueur dont tu veux connaître le rôle. »',
    renard: '« Renard, réveille-toi. Désigne un joueur : je te dirai s\'il y a un loup parmi lui et ses deux voisins. »',
    loups: '« Loups-Garous, réveillez-vous. Mettez-vous d\'accord sur une victime. »',
    infect: '« Infect Père des Loups, veux-tu infecter la victime ? Elle deviendrait l\'un des vôtres. »',
    grandloup: '« Grand Méchant Loup, réveille-toi. Désigne une seconde victime. »',
    loupblanc: '« Loup-Garou Blanc, réveille-toi. Tu peux dévorer un autre loup. »',
    sorciere: '« Sorcière, réveille-toi. Voici la victime de cette nuit. Veux-tu la sauver ? Veux-tu empoisonner quelqu\'un ? »',
    flute: '« Joueur de flûte, réveille-toi. Désigne deux joueurs à charmer. »',
    dawn: '« Le village se réveille… »',
    quick: '« Le village se réveille… »',
    captain: '« Le village élit son Capitaine. Sa voix comptera double lors des votes. »',
    vote: '« Le débat est terminé. À trois, chacun pointe du doigt le joueur qu\'il veut éliminer. Un, deux, trois ! »',
    hunter: '« Chasseur, avant de mourir, désigne un joueur qui t\'accompagne. »',
    successor: '« Capitaine, avant de partir, désigne ton successeur. »'
  };
  const SLEEP = { voleur: 'Voleur', cupidon: 'Cupidon', amoureux: 'Amoureux', soeurs: 'Sœurs', enfant: 'Enfant sauvage', salvateur: 'Salvateur', voyante: 'Voyante', renard: 'Renard',
    loups: 'Loups-Garous', infect: 'Infect Père des Loups', grandloup: 'Grand Méchant Loup', loupblanc: 'Loup-Garou Blanc', sorciere: 'Sorcière', flute: 'Joueur de flûte' };

  // Les étapes d'une nuit : seulement les rôles en jeu (morts compris si « appeler les morts »).
  function planNight() {
    if (S.quick) return ['quick'];
    const n = S.night;
    const has = (role) => inGame(role) && (S.callDead || holders(role).some((p) => p.alive));
    const st = [];
    for (const t of NIGHT) {
      if (t === 'voleur' && !(n === 1 && has('voleur'))) continue;
      if (t === 'cupidon' && !(n === 1 && has('cupidon'))) continue;
      if (t === 'amoureux' && !(n === 1 && inGame('cupidon'))) continue;
      if (t === 'soeurs' && !(n === 1 && has('soeur'))) continue;
      if (t === 'enfant' && !(n === 1 && has('enfant'))) continue;
      if (t === 'salvateur' && !has('salvateur')) continue;
      if (t === 'voyante' && !has('voyante')) continue;
      if (t === 'renard' && !has('renard')) continue;
      if (t === 'loups' && !S.players.some(isWolf)) continue;
      if (t === 'infect' && !has('infect')) continue;
      if (t === 'grandloup' && !has('grandloup')) continue;
      if (t === 'loupblanc' && !(n % 2 === 0 && has('loupblanc'))) continue;
      if (t === 'sorciere' && !has('sorciere')) continue;
      if (t === 'flute' && !has('flute')) continue;
      st.push(t);
    }
    st.push('dawn');
    return st;
  }
  function planDay() { return (S.day === 1 && !S.players.some((p) => p.captain) ? ['captain'] : []).concat(['vote']); }

  function startNight() {
    S.phase = 'night'; S.night += 1;
    Object.assign(S, { victim: null, bigbad: null, white: null, poison: null, saved: false, infectNow: false, protected: null });
    S.steps = planNight(); S.cursor = 0; resetUi();
    log(`Nuit ${S.night} : le village s'endort.`);
  }
  function startDay() { S.phase = 'day'; S.day += 1; S.steps = planDay(); S.cursor = 0; resetUi(); }
  function resetUi() { ui.sel = []; ui.counts = {}; ui.sorc = { save: false, kill: null }; ui.choice = null; ui.menu = null; }
  const cur = () => S.steps[S.cursor];
  function next() {
    resetUi();
    S.dawnDone = false; S.voteDone = false;
    if (S.cursor < S.steps.length - 1) S.cursor += 1;
    else if (S.phase === 'night') startDay();
    else startNight();
    save(); render(); window.scrollTo(0, 0);
  }
  // Une étape ajoutée juste après celle en cours (Chasseur, successeur du Capitaine).
  function insertNext(t) { if (!S.steps.slice(S.cursor + 1).includes(t)) S.steps.splice(S.cursor + 1, 0, t); }

  // ---------- Morts, victoire ----------
  function kill(id, cause) {
    const p = P(id);
    if (!p || !p.alive) return [];
    p.alive = false; p.death = { cause, when: S.phase === 'night' || cur() === 'dawn' ? `nuit ${S.night}` : `jour ${S.day}` };
    const out = [p];
    if (isWolf(p)) S.wolfDied = true;
    if (p.role === 'chasseur' && !S.powersLost) insertNext('hunter');
    if (p.captain) insertNext('successor');
    if (p.role === 'chevalier' && cause === 'loups') {
      if (S.nameless) log('Épée rouillée : le premier loup à gauche du Chevalier mourra la nuit prochaine. Marque-le mort dans le suivi.');
      else S.rusty = p.id;
    }
    // Enfant sauvage : son modèle meurt, il devient loup.
    for (const k of S.players) if (k.alive && k.role === 'enfant' && k.model === id && !k.wild) { k.wild = true; log(`${k.name}, l'Enfant sauvage, devient loup (son modèle est mort).`); }
    if (p.lover) for (const l of S.players) if (l.lover && l.id !== id && l.alive) { out.push(...kill(l.id, 'chagrin')); }
    return out;
  }
  function checkWin() {
    const a = alive();
    if (!a.length) return 'Tout le monde est mort : personne ne gagne.';
    const lovers = S.players.filter((p) => p.lover);
    if (lovers.length === 2 && a.length === 2 && lovers.every((p) => p.alive) && lovers.some(isWolf) && lovers.some((p) => !isWolf(p))) return 'Les Amoureux gagnent ensemble !';
    if (a.length === 1 && a[0].role === 'loupblanc') return 'Le Loup-Garou Blanc reste seul : il gagne !';
    const piper = a.find((p) => p.role === 'flute');
    if (piper && a.every((p) => p.id === piper.id || p.charmed)) return 'Tout le village est charmé : le Joueur de flûte gagne !';
    const wolves = a.filter(isWolf).length;
    if (!wolves) return piper ? null : 'Le village a éliminé tous les loups !';
    const pack = a.filter((p) => isWolf(p) && p.role !== 'loupblanc').length;
    if (!a.some((p) => p.role === 'loupblanc') && pack >= a.length - pack) return 'Les Loups-Garous dévorent le village !';
    return null;
  }
  const deadLine = (list) => list.map((p) => (S.nameless && p.role === p.baseRole ? p.name : `${p.name} (${rn(p.role)})`)).join(', ') || 'personne';

  // ---------- Préparation ----------
  function setupHTML() {
    const step = S.setupStep;
    const nav = (S.nameless ? [[1, 'Les joueurs'], [2, 'Les cartes']] : [[1, 'Les joueurs, dans l\'ordre de la table'], [2, 'Les cartes'], [3, 'Qui a quelle carte']]).map(([n, t]) =>
      `<button class="mj-stepn ${n === step ? 'on' : ''} ${n < step ? 'done' : ''}" data-a="setup-go" data-v="${n}"><span>${n}</span>${t}</button>`).join('<i>—</i>');
    let body = '';
    const modeSeg = `<div class="seg"><button class="${S.nameless ? '' : 'on'}" data-a="nameless" data-v="0">Avec les prénoms</button><button class="${S.nameless ? 'on' : ''}" data-a="nameless" data-v="1">Juste les rôles</button></div>`;
    if (step === 1 && S.nameless) {
      body = `<section class="mj-panel grow"><div class="mj-row"><h2 class="grow">Les joueurs</h2>${modeSeg}</div>
        <p class="mj-muted">Sans prénoms : chaque joueur est désigné par sa carte (« Voyante », « Loup-Garou 2 »…). Choisis les cartes à l'étape suivante et distribue-les comme tu veux : l'app suit les rôles, pas les personnes.</p>
        <p class="mj-muted small">Sans l'ordre de la table, le Renard et l'épée rouillée du Chevalier se gèrent à l'œil : l'app te le rappellera.</p>
        <div class="mj-foot"><span class="grow"></span><button class="primary" data-a="setup-go" data-v="2">Suivant : les cartes</button></div></section>`;
    } else if (step === 1) {
      const rows = S.players.map((p, i) => `<li class="mj-prow">${avatar(p, 30)}<b>${i + 1}.</b><input value="${esc(p.name)}" data-a="pname" data-id="${p.id}" aria-label="Nom du joueur ${i + 1}" maxlength="20">
        <button class="mj-ib" data-a="pup" data-id="${p.id}" aria-label="Monter">${icon('up', 16)}</button><button class="mj-ib" data-a="pdown" data-id="${p.id}" aria-label="Descendre">${icon('down', 16)}</button>
        <button class="mj-ib" data-a="pdel" data-id="${p.id}" aria-label="Retirer">${icon('x', 16)}</button></li>`).join('');
      body = `<section class="mj-panel grow"><div class="mj-row"><h2 class="grow">Les joueurs, dans l'ordre autour de la table</h2>${modeSeg}</div>
        <p class="mj-muted">Commence par le joueur à ta gauche et fais le tour. L'ordre sert au Renard, au Chevalier et au suivi.</p>
        <ol class="mj-plist">${rows}</ol>
        <form class="mj-add" data-a="padd"><input id="mj-new" placeholder="Prénom du joueur" maxlength="20" autocomplete="off"><button class="primary" type="submit">${icon('plus', 16)} Ajouter</button></form>
        <div class="mj-foot"><span class="mj-muted">${S.players.length} joueur${S.players.length > 1 ? 's' : ''}</span><button class="primary" data-a="setup-go" data-v="2" ${S.players.length < 4 ? 'disabled' : ''}>Suivant : les cartes</button></div></section>`;
    } else if (step === 2) {
      const total = Object.values(S.compo).reduce((a, b) => a + b, 0);
      const need = S.nameless ? total : S.players.length + (inGame('voleur') ? 2 : 0);
      const nPlayers = total - (inGame('voleur') ? 2 : 0);
      const groups = { base: 'Jeu de base', nouvelleLune: 'Nouvelle Lune', personnages: 'Personnages' };
      const list = Object.entries(groups).map(([g, gt]) => `<h3>${gt}</h3><ul class="mj-compo">${Object.entries(R).filter(([, d]) => d.ext === g).map(([k, d]) => `
        <li class="${S.compo[k] ? 'on' : ''}">${card(k, 'mj-mini')}<b>${esc(d.name)}</b><span class="t-${d.team}">${d.team === 'loups' ? 'Loups' : d.team === 'solitaire' ? 'Solitaire' : 'Village'}</span>
        <span class="mj-count"><button class="mj-ib" data-a="cminus" data-r="${k}" aria-label="Moins">${icon('minus', 14)}</button><b>${S.compo[k] || 0}</b><button class="mj-ib" data-a="cplus" data-r="${k}" aria-label="Plus">${icon('plus', 14)}</button></span></li>`).join('')}</ul>`).join('');
      body = `<section class="mj-panel grow"><h2>Les cartes</h2><p class="mj-muted">${inGame('voleur') ? 'Avec le Voleur, 2 cartes de plus restent au centre.' : 'Une carte par joueur.'}</p>${list}
        <label class="check"><input type="checkbox" data-a="calldead" ${S.callDead ? 'checked' : ''}> Appeler aussi les rôles morts la nuit (pour ne rien révéler)</label>
        <label class="check"><input type="checkbox" data-a="quickmode" ${S.quick ? 'checked' : ''}> Mode rapide : je mène la nuit moi-même, je note seulement les morts</label>
        ${S.nameless && inGame('voleur') ? `<div class="mj-row wrap"><b class="mj-lbl">Les 2 cartes au centre (pour le Voleur)</b>${[0, 1].map((i) => `<select data-a="extra" data-i="${i}"><option value="">— carte —</option>${Object.keys(S.compo).filter((k) => S.compo[k] > 0 && k !== 'voleur').map((k) => `<option value="${k}" ${S.extra[i] === k ? 'selected' : ''}>${esc(rn(k))}</option>`).join('')}</select>`).join('')}</div>` : ''}
        ${S.nameless
          ? `<div class="mj-foot"><span class="${nPlayers >= 4 ? 'mj-ok' : 'mj-bad'}">${nPlayers} joueur${nPlayers > 1 ? 's' : ''}${inGame('voleur') ? ' + 2 cartes au centre' : ''}</span><button class="primary" data-a="begin-nameless" ${nPlayers < 4 || (inGame('voleur') && !(S.extra[0] && S.extra[1])) ? 'disabled' : ''}>Commencer la nuit 1</button></div></section>`
          : `<div class="mj-foot"><span class="${total === need ? 'mj-ok' : 'mj-bad'}">${total} carte${total > 1 ? 's' : ''} sur ${need}</span><button class="primary" data-a="setup-go" data-v="3" ${total !== need ? 'disabled' : ''}>Suivant : qui a quelle carte</button></div></section>`}`;
    } else {
      const deck = [];
      for (const [k, n] of Object.entries(S.compo)) for (let i = 0; i < n; i++) deck.push(k);
      const opts = [...new Set(deck)];
      const seats = S.players.map((p, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / S.players.length;
        return `<span class="mj-seat" style="left:${50 + 40 * Math.cos(a)}%;top:${50 + 40 * Math.sin(a)}%">${avatar(p, 40)}${p.role ? card(p.role, 'mj-seatcard') : ''}<b>${i + 1}. ${esc(p.name)}</b>${p.role ? `<small class="t-${team(p.role)}">${esc(rn(p.role))}</small>` : '<small class="mj-muted">?</small>'}</span>`;
      }).join('');
      const manual = S.players.map((p) => `<li class="mj-prow">${avatar(p, 28)}<b class="grow">${esc(p.name)}</b><select data-a="prole" data-id="${p.id}"><option value="">— carte —</option>${opts.map((k) => `<option value="${k}" ${p.role === k ? 'selected' : ''}>${esc(rn(k))}</option>`).join('')}</select></li>`).join('');
      const counts = {};
      for (const p of S.players) if (p.role) counts[p.role] = (counts[p.role] || 0) + 1;
      const okManual = S.players.every((p) => p.role) && Object.entries(counts).every(([k, n]) => n <= (S.compo[k] || 0));
      body = `<section class="mj-panel grow"><div class="mj-row"><h2 class="grow">Qui a quelle carte ?</h2>
          <div class="seg"><button class="${S.distrib === 'random' ? 'on' : ''}" data-a="distrib" data-v="random">L'app distribue au hasard</button><button class="${S.distrib === 'manual' ? 'on' : ''}" data-a="distrib" data-v="manual">J'ai distribué : je note</button></div></div>
        ${S.distrib === 'random' ? `<p class="mj-muted">L'app tire les cartes : donne à chaque joueur la carte indiquée. Toi seul vois cet écran.</p>
          <div class="mj-table">${seats}<span class="mj-tablec">La table<br><b>${S.players.length} joueurs</b>${S.extra.length ? `<br><small>Au centre : ${S.extra.map(rn).join(', ')}</small>` : ''}</span></div>
          <button data-a="deal">${icon('undo', 16)} Retirer au hasard</button>`
          : `<p class="mj-muted">Note la carte de chaque joueur.${inGame('voleur') ? ' Les 2 cartes restantes iront au centre pour le Voleur.' : ''}</p><ul class="mj-plist">${manual}</ul>`}
        <div class="mj-foot"><span class="grow"></span><button class="primary" data-a="begin" ${S.distrib === 'manual' && !okManual ? 'disabled' : ''}>Commencer la nuit 1</button></div></section>`;
    }
    return `${headerHTML('Préparation', '')}<main class="mj-main setup"><nav class="mj-steps">${nav}</nav>${body}</main>`;
  }

  // ---------- En jeu ----------
  function headerHTML(title, extra) {
    const day = S.phase === 'day';
    return `<header class="band mj-band ${day ? 'day' : ''}"><div class="in">
      <span class="mj-tag">MJ</span><span class="ph-title">${esc(title)}</span>${extra}<span class="grow"></span>
      ${S.phase === 'night' && cur() !== 'quick' ? `<button class="ghost small-btn" data-a="to-quick">${icon('skull', 15)} Noter les morts</button>` : ''}
      ${S.phase !== 'setup' ? `<button class="ghost small-btn" data-a="undo" ${undo.length ? '' : 'disabled'}>${icon('undo', 15)} Annuler la dernière action</button>
      <button class="ghost small-btn mj-suivi-btn" data-a="suivi">${icon('users', 15)} Suivi</button>` : ''}
      <button class="ghost small-btn" data-a="reset">Nouvelle partie</button></div></header>`;
  }
  function stepsHTML() {
    return `<ol class="mj-pills">${S.steps.map((t, i) => `<li><button class="${i === S.cursor ? 'now' : i < S.cursor ? 'done' : ''}" data-a="goto" data-v="${i}">${esc(LABEL[t] || t)}${i < S.cursor ? ' ✓' : ''}</button></li>`).join('')}</ol>`;
  }
  const btn = (label, act, primary, attrs = '') => `<button class="${primary ? 'primary' : 'ghost'}" data-a="${act}" ${attrs}>${label}</button>`;
  function pickGrid(cands, max, opts = {}) {
    return `<div class="mj-pick">${cands.map((p) => {
      const on = ui.sel.includes(p.id);
      return `<button class="mj-chip ${on ? 'on' : ''}" data-a="pick" data-id="${p.id}" data-max="${max}" aria-pressed="${on}">${avatar(p, 30)}<span>${esc(p.name)}${opts.sub ? `<small>${esc(opts.sub(p))}</small>` : ''}</span></button>`;
    }).join('')}</div>`;
  }
  function scriptCard(t, who, read, body, foot) {
    const role = STEP_ROLE[t] || (t === 'hunter' ? 'chasseur' : null);
    return `<section class="mj-panel mj-script">
      <div class="mj-row">${role ? card(role, 'mj-big') : `<span class="mj-bigic">${icon(t === 'dawn' || t === 'quick' ? 'sun' : t === 'vote' ? 'check' : 'crown', 30)}</span>`}
        <span class="mj-ttl"><b>${esc(LABEL[t] || t)}</b><span>${who}</span></span></div>
      ${read ? `<blockquote class="mj-read">${icon('quote', 22)}<span><small>À LIRE À VOIX HAUTE</small>${read}</span></blockquote>` : ''}
      ${body}<span class="grow"></span><div class="mj-foot">${foot}</div></section>`;
  }
  const whoTxt = (role) => {
    const h = holders(role);
    if (!h.length) return 'Personne n\'a cette carte';
    return h.map((p) => `<b>${esc(p.name)}</b>${p.alive ? '' : ' (mort)'}`).join(' et ');
  };
  const sleepLine = (t) => SLEEP[t] ? `<span class="mj-muted">Puis : « ${SLEEP[t]}, rendors-toi. »</span>` : '<span></span>';
  const rescue = (extraBtns = '') => `<div class="mj-rescue"><b>Si ça ne se passe pas comme prévu</b><div class="mj-row wrap">${btn(`${icon('x', 15)} Ils n'ont rien fait`, 'none')}${btn(`${icon('skip', 15)} Je ne sais plus : passer`, 'skipstep')}${S.cursor > 0 ? btn(`${icon('undo', 15)} Revenir à l'étape d'avant`, 'prev') : ''}${S.phase === 'night' ? btn(`${icon('skull', 15)} Noter directement les morts`, 'to-quick') : ''}${extraBtns}</div>
    <p class="mj-muted small">Touche un joueur dans le suivi pour le corriger à la main (mort, rôle, amour, Capitaine…).</p></div>`;

  function stepHTML() {
    const t = cur();
    const role = STEP_ROLE[t];
    // Rôle mort (ou carte au centre) : on l'appelle quand même, pour ne rien révéler.
    if (role && t !== 'loups' && !holders(role).some((p) => p.alive)) {
      return scriptCard(t, holders(role).length ? `${whoTxt(role)} · ne joue plus` : 'Carte au centre', SCRIPT[t],
        '<p class="mj-note">Personne ne se réveille. Appelle quand même le rôle et attends quelques secondes, pour ne rien révéler.</p>',
        `${sleepLine(t)}<span class="grow"></span>${btn('Suivant', 'skipstep', true)}`);
    }
    const others = (id) => alive().filter((p) => p.id !== id);
    const sel = ui.sel;
    const foot = (label, ok = true) => `${sleepLine(t)}<span class="grow"></span>${btn('Passer', 'none')}${btn(label, 'apply', true, ok ? '' : 'disabled')}`;
    switch (t) {
      case 'voleur': {
        const v = holders('voleur')[0];
        const opts = S.extra.map((r, i) => `<button class="mj-cardpick ${ui.choice === i ? 'on' : ''}" data-a="choice" data-v="${i}">${card(r, 'mj-big')}<b class="t-${team(r)}">${esc(rn(r))}</b></button>`).join('');
        return scriptCard(t, `Joué par ${whoTxt('voleur')}`, SCRIPT[t], `<b class="mj-lbl">Il prend</b><div class="mj-row wrap">${opts}<button class="mj-cardpick ${ui.choice === -1 ? 'on' : ''}" data-a="choice" data-v="-1">${card('voleur', 'mj-big')}<b>Il garde sa carte</b></button></div>
          ${S.extra.every((r) => WOLF_ROLES.includes(r)) ? '<p class="mj-note">Deux loups au centre : il doit en prendre un.</p>' : ''}${rescue()}`, foot('Valider', ui.choice !== null && v));
      }
      case 'cupidon':
        return scriptCard(t, `Joué par ${whoTxt('cupidon')}`, SCRIPT[t], `<b class="mj-lbl">Il désigne deux joueurs</b>${pickGrid(alive(), 2)}${rescue()}`, foot('Valider les amoureux', sel.length === 2));
      case 'amoureux': {
        const l = S.players.filter((p) => p.lover);
        return scriptCard(t, l.length ? l.map((p) => `<b>${esc(p.name)}</b>`).join(' et ') : 'Pas d\'amoureux', SCRIPT[t],
          `<p class="mj-note">${l.length ? `Touche la tête de ${l.map((p) => esc(p.name)).join(' et ')}. Ils ouvrent les yeux, se reconnaissent, puis se rendorment.` : 'Cupidon n\'a désigné personne.'}</p>`, `<span class="mj-muted">Puis : « Amoureux, rendormez-vous. »</span><span class="grow"></span>${btn('Suivant', 'skipstep', true)}`);
      }
      case 'soeurs':
        return scriptCard(t, whoTxt('soeur'), SCRIPT[t], '<p class="mj-note">Elles ouvrent les yeux, se reconnaissent et peuvent se parler en silence quelques instants.</p>', `<span class="mj-muted">Puis : « Les Sœurs, rendormez-vous. »</span><span class="grow"></span>${btn('Suivant', 'skipstep', true)}`);
      case 'enfant': {
        const k = holders('enfant')[0];
        return scriptCard(t, `Joué par ${whoTxt('enfant')}`, SCRIPT[t], `<b class="mj-lbl">Il choisit son modèle</b>${pickGrid(others(k && k.id), 1)}${rescue()}`, foot('Valider le modèle', sel.length === 1));
      }
      case 'salvateur': {
        const c = alive().filter((p) => p.id !== S.lastProtected);
        return scriptCard(t, `Joué par ${whoTxt('salvateur')}`, SCRIPT[t], `<b class="mj-lbl">Il protège</b>${pickGrid(c, 1)}${S.lastProtected ? `<p class="mj-muted small">Pas ${esc(name(S.lastProtected))} : protégé la nuit dernière.</p>` : ''}${rescue()}`, foot('Valider', sel.length === 1));
      }
      case 'voyante': {
        const me = holders('voyante')[0];
        const tgt = sel[0] ? P(sel[0]) : null;
        const show = tgt ? `<div class="mj-reveal">${card(tgt.role, 'mj-big')}<span><small>MONTRE-LUI LA CARTE</small><b>${esc(tgt.name)} est <span class="t-${team(tgt.role)}">${esc(rn(tgt.role))}</span></b></span></div>` : '';
        return scriptCard(t, `Jouée par ${whoTxt('voyante')}`, SCRIPT[t], `<b class="mj-lbl">Elle désigne</b>${pickGrid(others(me && me.id), 1)}${show}${rescue()}`, foot('Suivant', sel.length === 1));
      }
      case 'renard': {
        if (S.nameless && !S.foxLost) {
          return scriptCard(t, `Joué par ${whoTxt('renard')}`, SCRIPT[t], `<p class="mj-note">Sans les prénoms, l'app ne connaît pas l'ordre de la table : regarde le joueur désigné et ses deux voisins, puis réponds-lui d'un signe.</p>${rescue()}`,
            `${sleepLine(t)}<span class="grow"></span>${btn('Aucun loup : il perd son flair', 'fox-no')}${btn('Il y a un loup', 'fox-yes', true)}`);
        }
        if (S.foxLost) return scriptCard(t, whoTxt('renard'), SCRIPT[t], '<p class="mj-note">Le Renard a perdu son flair : appelle-le quand même, il ne peut plus rien faire.</p>', `${sleepLine(t)}<span class="grow"></span>${btn('Suivant', 'skipstep', true)}`);
        const tgt = sel[0];
        let show = '';
        if (tgt) {
          const trio = neighbours(tgt);
          const wolf = trio.some((id) => isWolf(P(id)));
          show = `<div class="mj-reveal">${icon('wolf', 30)}<span><small>DIS-LUI</small><b>${wolf ? 'Oui, il y a un loup' : 'Non, aucun loup'} parmi ${trio.map(name).map(esc).join(', ')}</b>${wolf ? '' : '<small>Il perd son flair.</small>'}</span></div>`;
        }
        return scriptCard(t, `Joué par ${whoTxt('renard')}`, SCRIPT[t], `<b class="mj-lbl">Il désigne</b>${pickGrid(alive(), 1)}${show}${rescue()}`, foot('Suivant', sel.length === 1));
      }
      case 'loups': {
        const w = S.players.filter((p) => isWolf(p) && p.alive);
        const pf = holders('petitefille').some((p) => p.alive);
        return scriptCard(t, w.length ? `${w.map((p) => `<b>${esc(p.name)}</b>`).join(', ')}` : 'Plus aucun loup en vie', SCRIPT[t],
          `<b class="mj-lbl">Ils désignent leur victime</b>${pickGrid(alive().filter((p) => !isWolf(p) || p.role === 'loupblanc'), 1)}${pf ? '<p class="mj-muted small">Petite Fille en jeu : elle peut entrouvrir les yeux. Surveille-la.</p>' : ''}${rescue()}`, foot('Valider la victime', sel.length === 1));
      }
      case 'infect':
        if (S.infectUsed || !S.victim) return scriptCard(t, whoTxt('infect'), SCRIPT[t], `<p class="mj-note">${S.infectUsed ? 'Il a déjà infecté une fois : appelle-le quand même.' : 'Pas de victime cette nuit.'}</p>`, `${sleepLine(t)}<span class="grow"></span>${btn('Suivant', 'skipstep', true)}`);
        return scriptCard(t, `Joué par ${whoTxt('infect')}`, SCRIPT[t], `<p class="mj-note">Victime : <b>${esc(name(S.victim))}</b>. Il lève le pouce pour infecter, le baisse sinon.</p>${rescue()}`,
          `${sleepLine(t)}<span class="grow"></span>${btn('Non', 'none')}${btn(`Oui : ${esc(name(S.victim))} devient loup`, 'infect-yes', true)}`);
      case 'grandloup':
        if (S.wolfDied) return scriptCard(t, whoTxt('grandloup'), SCRIPT[t], '<p class="mj-note">Un loup est déjà mort : il ne dévore plus de seconde victime. Appelle-le quand même.</p>', `${sleepLine(t)}<span class="grow"></span>${btn('Suivant', 'skipstep', true)}`);
        return scriptCard(t, `Joué par ${whoTxt('grandloup')}`, SCRIPT[t], `<b class="mj-lbl">Seconde victime</b>${pickGrid(alive().filter((p) => !isWolf(p) && p.id !== S.victim), 1)}${rescue()}`, foot('Valider', sel.length === 1));
      case 'loupblanc': {
        const me = holders('loupblanc')[0];
        return scriptCard(t, `Joué par ${whoTxt('loupblanc')}`, SCRIPT[t], `<b class="mj-lbl">Il dévore un loup (ou personne)</b>${pickGrid(alive().filter((p) => isWolf(p) && p.id !== (me && me.id)), 1)}${rescue()}`, foot('Valider', sel.length === 1));
      }
      case 'sorciere': {
        const v = S.victim && !S.saved ? P(S.victim) : null;
        const life = S.potions.life, death = S.potions.death;
        return scriptCard(t, `Jouée par ${whoTxt('sorciere')}`, SCRIPT[t], `
          <div class="mj-row wrap">
            <div class="mj-pot ${life ? '' : 'used'}"><b>Potion de vie</b>${!life ? '<small>Déjà utilisée</small>' : v ? `<label class="check"><input type="checkbox" data-a="sorc-save" ${ui.sorc.save ? 'checked' : ''}> Elle sauve ${esc(v.name)}</label>` : '<small>Personne à sauver</small>'}</div>
            <div class="mj-pot ${death ? '' : 'used'}"><b>Potion de mort</b>${!death ? '<small>Déjà utilisée</small>' : `<small>${ui.sorc.kill ? `Sur ${esc(name(ui.sorc.kill))}` : 'Touche un joueur ci-dessous'}</small>`}</div></div>
          <p class="mj-note">Montre-lui la victime : <b>${v ? esc(v.name) : 'personne'}</b>.</p>
          ${death ? `<b class="mj-lbl">Elle empoisonne (facultatif)</b><div class="mj-pick">${alive().map((p) => `<button class="mj-chip ${ui.sorc.kill === p.id ? 'on' : ''}" data-a="sorc-kill" data-id="${p.id}">${avatar(p, 30)}<span>${esc(p.name)}</span></button>`).join('')}</div>` : ''}${rescue()}`,
          `${sleepLine(t)}<span class="grow"></span>${btn('Elle ne fait rien', 'none')}${btn('Valider', 'apply', true)}`);
      }
      case 'flute': {
        const me = holders('flute')[0];
        return scriptCard(t, `Joué par ${whoTxt('flute')}`, SCRIPT[t], `<b class="mj-lbl">Il charme deux joueurs</b>${pickGrid(alive().filter((p) => !p.charmed && p.id !== (me && me.id)), 2)}<p class="mj-muted small">Ensuite : « Charmés, réveillez-vous et reconnaissez-vous. »</p>${rescue()}`, foot('Valider', sel.length >= 1));
      }
      case 'dawn': return dawnHTML();
      case 'quick': {
        if (S.dawnDone) return dawnHTML();
        const dead = ui.sel.map(P).filter(Boolean);
        const chain = [];
        for (const p of dead) if (p.lover) { const l = S.players.find((q) => q.lover && q.id !== p.id && q.alive && !ui.sel.includes(q.id)); if (l) chain.push(l); }
        return scriptCard('quick', S.quick ? 'Mode rapide : tu mènes la nuit, tu notes les morts' : 'Raccourci : seulement les morts', SCRIPT.quick,
          `<b class="mj-lbl">Qui est mort cette nuit ? (touche-les tous)</b>${pickGrid(alive(), alive().length)}
          ${chain.length ? `<p class="mj-note">${chain.map((p) => esc(p.name)).join(', ')} mourra aussi de chagrin (amoureux).</p>` : ''}
          ${dead.length ? `<ul class="mj-dawn">${dead.concat(chain).map((p) => `<li class="bad">${esc(p.name)}${S.nameless && p.role === p.baseRole ? '' : ` · il était <b class="t-${team(p.role)}">${esc(rn(p.role))}</b>`}</li>`).join('')}</ul>` : ''}
          <p class="mj-muted small">Un Chasseur ou le Capitaine parmi eux ? Leur étape s'ajoute juste après.</p>`,
          `<span class="grow"></span>${btn('Personne n\'est mort', 'quick-none')}${btn(dead.length ? `Valider : ${dead.length + chain.length} mort${dead.length + chain.length > 1 ? 's' : ''}` : 'Valider', 'quick-ok', true, dead.length ? '' : 'disabled')}`);
      }
      case 'captain':
        return scriptCard(t, 'Vote du village', SCRIPT[t], `<b class="mj-lbl">Le village élit</b>${pickGrid(alive(), 1)}${rescue()}`, `<span class="grow"></span>${btn('Pas de Capitaine', 'skipstep')}${btn('Valider le Capitaine', 'apply', true, sel.length === 1 ? '' : 'disabled')}`);
      case 'vote': return voteHTML();
      case 'hunter': {
        const h = S.players.find((p) => p.role === 'chasseur' && !p.alive && !p.shot);
        return scriptCard(t, h ? `<b>${esc(h.name)}</b> vient de mourir` : 'Chasseur', SCRIPT[t], `<b class="mj-lbl">Il emporte</b>${pickGrid(alive(), 1)}`, `<span class="grow"></span>${btn('Il ne tire sur personne', 'none')}${btn('Valider', 'apply', true, sel.length === 1 ? '' : 'disabled')}`);
      }
      case 'successor':
        return scriptCard(t, 'Le Capitaine est mort', SCRIPT[t], `<b class="mj-lbl">Il désigne</b>${pickGrid(alive(), 1)}`, `<span class="grow"></span>${btn('Personne', 'none')}${btn('Valider', 'apply', true, sel.length === 1 ? '' : 'disabled')}`);
      default: return '';
    }
  }
  // Le joueur et ses deux voisins vivants, dans l'ordre de la table.
  function neighbours(id) {
    const a = alive();
    const i = a.findIndex((p) => p.id === id);
    if (i < 0 || a.length < 3) return a.map((p) => p.id);
    return [a[(i - 1 + a.length) % a.length].id, id, a[(i + 1) % a.length].id];
  }

  // Aube : ce qui s'est passé cette nuit, calculé à partir de ce que le MJ a noté.
  function dawnPlan() {
    const list = [];
    if (S.victim && S.victim !== S.protected && !S.saved && !S.infectNow) {
      const v = P(S.victim);
      if (v && v.role === 'ancien' && !v.ancienHit) list.push({ id: v.id, cause: 'ancien' });
      else list.push({ id: S.victim, cause: 'loups' });
    }
    if (S.bigbad && S.bigbad !== S.protected) list.push({ id: S.bigbad, cause: 'loups' });
    if (S.white) list.push({ id: S.white, cause: 'loups' });
    if (S.poison) list.push({ id: S.poison, cause: 'poison' });
    if (S.rustyKill) list.push({ id: S.rustyKill, cause: 'rouille' });
    return list;
  }
  function dawnHTML() {
    if (S.dawnDone) {
      const w = !S.ignoreWin && checkWin();
      return scriptCard('dawn', `Matin du jour ${S.night}`, null, `<div class="mj-reveal">${icon('sun', 30)}<span><small>ANNONCÉ</small><b>${esc(S.dawnText)}</b></span></div>${winHTML(w)}`,
        `<span class="grow"></span>${btn(nextLabel('Le jour commence'), 'skipstep', true)}`);
    }
    const plan = dawnPlan().filter((x) => P(x.id) && P(x.id).alive);
    const lines = [];
    for (const x of plan) {
      const p = P(x.id);
      if (x.cause === 'ancien') lines.push(`<li class="ok">${esc(p.name)} (Ancien) résiste à l'attaque : il perd une vie.</li>`);
      else lines.push(`<li class="bad">${esc(p.name)} meurt${x.cause === 'poison' ? ' (empoisonné)' : x.cause === 'rouille' ? ' (épée rouillée)' : ''} · il était <b class="t-${team(p.role)}">${esc(rn(p.role))}</b></li>`);
      if (p.lover && x.cause !== 'ancien') { const l = S.players.find((q) => q.lover && q.id !== p.id && q.alive); if (l) lines.push(`<li class="bad">${esc(l.name)} meurt de chagrin · il était <b class="t-${team(l.role)}">${esc(rn(l.role))}</b></li>`); }
    }
    if (S.saved) lines.push(`<li class="ok">${esc(name(S.victim))} a été sauvé par la Sorcière.</li>`);
    if (S.victim && S.protected === S.victim) lines.push(`<li class="ok">${esc(name(S.victim))} était protégé par le Salvateur.</li>`);
    if (S.infectNow) lines.push(`<li class="ok">${esc(name(S.victim))} a été infecté : il ne meurt pas et devient loup (en secret).</li>`);
    const deaths = plan.filter((x) => x.cause !== 'ancien');
    const read = deaths.length ? `« Le village se réveille… sauf ${deaths.map((x) => esc(name(x.id))).join(' et ')}. »` : '« Le village se réveille. Cette nuit, personne n\'est mort. »';
    return scriptCard('dawn', `Matin du jour ${S.night}`, read, `<b class="mj-lbl">Ce qui s'est passé</b><ul class="mj-dawn">${lines.join('') || '<li>Personne ne meurt.</li>'}</ul>
      <p class="mj-muted small">Retourne la carte de chaque mort. Une erreur ? Corrige dans le suivi avant de valider, ou reviens à une étape.</p>`,
      `<span class="grow"></span>${btn('Valider l\'aube', 'dawn-ok', true)}`);
  }
  // Bouton de suite : une étape a pu s'ajouter (Chasseur, successeur du Capitaine).
  const nextLabel = (end) => (S.cursor < S.steps.length - 1 ? `Suivant : ${LABEL[S.steps[S.cursor + 1]] || ''}` : end);
  function winHTML(w) {
    if (!w) return '';
    return `<div class="mj-win"><b>${esc(w)}</b><div class="mj-row wrap">${btn('Terminer la partie', 'end', true)}${btn('Continuer quand même', 'ignorewin')}</div></div>`;
  }

  function voteHTML() {
    if (S.voteDone) {
      const w = !S.ignoreWin && checkWin();
      return scriptCard('vote', `Jour ${S.day}`, null, `<div class="mj-reveal">${icon('check', 30)}<span><small>RÉSULTAT</small><b>${esc(S.voteText)}</b></span></div>${winHTML(w)}`,
        `<span class="grow"></span>${btn(nextLabel('La nuit tombe'), 'skipstep', true)}`);
    }
    const a = alive();
    const cap = S.players.find((p) => p.captain && p.alive);
    const mode = ui.voteMode;
    let body;
    if (mode === 'note') {
      body = `<p class="mj-muted">Comptez les mains en vrai, puis touche le joueur éliminé.</p>${pickGrid(a, 1)}`;
    } else {
      body = `<p class="mj-muted">Ajoute les voix de chaque joueur.${cap ? ` ${esc(cap.name)} (Capitaine) compte double.` : ''}</p><div class="mj-votes">${a.map((p) => `<div class="mj-vrow">${avatar(p, 28)}<b class="grow">${esc(p.name)}</b>
        <button class="mj-ib" data-a="vminus" data-id="${p.id}" aria-label="Moins">${icon('minus', 16)}</button><b class="mj-vn">${ui.counts[p.id] || 0}</b><button class="mj-ib on" data-a="vplus" data-id="${p.id}" aria-label="Plus">${icon('plus', 16)}</button></div>`).join('')}</div>`;
    }
    const target = mode === 'note' ? ui.sel[0] : topVoted();
    const t = target ? P(target) : null;
    const preview = t ? `<div class="mj-reveal">${card(t.role, 'mj-big')}<span><small>RETOURNE SA CARTE</small><b>${esc(t.name)} est <span class="t-${team(t.role)}">${esc(rn(t.role))}</span></b>${t.role === 'idiot' && !t.idiotRevealed ? '<small>Idiot du village : il est gracié et ne votera plus.</small>' : ''}${t.role === 'ange' && S.firstVote ? '<small>L\'Ange éliminé au premier vote gagne seul !</small>' : ''}</span></div>` : '';
    const bouc = holders('bouc').some((p) => p.alive);
    return scriptCard('vote', `${a.length} joueurs en vie${cap ? ` · ${esc(cap.name)} est Capitaine (voix double)` : ''}`, SCRIPT.vote,
      `<div class="mj-row"><b class="mj-lbl grow">Qui est éliminé ?</b><div class="seg"><button class="${mode === 'note' ? 'on' : ''}" data-a="vmode" data-v="note">Je note l'éliminé</button><button class="${mode === 'count' ? 'on' : ''}" data-a="vmode" data-v="count">Compter les voix</button></div></div>
      ${body}${preview}`,
      `${btn(`${icon('x', 15)} Personne n'est éliminé`, 'vote-none')}${btn(`${icon('undo', 15)} Égalité${bouc ? ' : le Bouc meurt' : ' : revoter'}`, 'vote-tie')}${btn(`${icon('skip', 15)} Passer le vote`, 'skipstep')}<span class="grow"></span>${btn(t ? `Valider : ${esc(t.name)} est éliminé` : 'Valider', 'vote-ok', true, t ? '' : 'disabled')}`);
  }
  function topVoted() {
    const e = Object.entries(ui.counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (!e.length || (e[1] && e[1][1] === e[0][1])) return null;
    return e[0][0];
  }

  // Suivi : chaque joueur dans l'ordre de la table ; un toucher ouvre le menu de correction.
  function suiviHTML() {
    const rows = S.players.map((p, i) => {
      const ic = [];
      if (p.lover) ic.push(`<span class="mj-st love" title="Amoureux">${icon('heart', 12)}</span>`);
      if (p.captain) ic.push(`<span class="mj-st cap" title="Capitaine">${icon('crown', 12)}</span>`);
      if (S.protected === p.id && S.phase === 'night') ic.push(`<span class="mj-st" title="Protégé cette nuit">${icon('shield', 12)}</span>`);
      if (p.charmed) ic.push(`<span class="mj-st charm" title="Charmé">${icon('music', 12)}</span>`);
      if (p.infected || p.wild) ic.push(`<span class="mj-st wolf" title="Devenu loup">${icon('wolf', 12)}</span>`);
      if (p.idiotRevealed) ic.push('<span class="mj-st" title="Ne vote plus">✗</span>');
      if (p.note) ic.push(`<span class="mj-st" title="${esc(p.note)}">${icon('note', 12)}</span>`);
      return `<li><button class="mj-srow ${p.alive ? '' : 'dead'} ${ui.menu === p.id ? 'open' : ''}" data-a="menu" data-id="${p.id}"><span class="mj-seatn">${i + 1}</span>${avatar(p, 24)}
        <span class="mj-sname"><b>${esc(p.name)}</b>${p.alive ? '' : `<small>Mort · ${esc(p.death ? p.death.when : '')}</small>`}${p.note ? `<small>${esc(p.note)}</small>` : ''}</span>
        <span class="mj-sic">${ic.join('')}</span>${S.nameless && p.role === p.baseRole ? '' : `${p.role ? card(p.role, 'mj-mini') : ''}<b class="mj-srole t-${team(p.role)}">${S.nameless ? '→ ' : ''}${esc(rn(p.role))}</b>`}</button>${ui.menu === p.id ? menuHTML(p) : ''}</li>`;
    }).join('');
    const pot = inGame('sorciere') ? `<div class="mj-pots"><span class="${S.potions.life ? '' : 'used'}">Potion de vie</span><span class="${S.potions.death ? '' : 'used'}">Potion de mort</span></div>` : '';
    const journal = S.log.slice(-12).reverse().map((l) => `<li><span>${esc(l.when)}</span>${esc(l.t)}</li>`).join('');
    return `<aside class="mj-panel mj-suivi ${ui.showSuivi ? 'show' : ''}"><div class="mj-row"><b class="grow">Suivi de la partie</b>${S.nameless ? '' : '<small class="mj-muted">ordre de la table</small>'}</div>
      <ul class="mj-slist">${rows}</ul>${pot}${journal ? `<div class="mj-journal"><b>Journal</b><ol>${journal}</ol></div>` : ''}</aside>`;
  }
  function menuHTML(p) {
    const roles = Object.keys(R);
    return `<div class="mj-menu">
      ${p.alive ? `<button data-a="m-dead" data-id="${p.id}">${icon('skull', 15)} Marquer mort</button>` : `<button data-a="m-alive" data-id="${p.id}">${icon('revive', 15)} Le remettre en vie</button>`}
      <label>${icon('edit', 15)} Rôle <select data-a="m-role" data-id="${p.id}">${roles.map((k) => `<option value="${k}" ${p.role === k ? 'selected' : ''}>${esc(rn(k))}</option>`).join('')}</select></label>
      <button data-a="m-lover" data-id="${p.id}">${icon('heart', 15)} ${p.lover ? 'Plus amoureux' : 'Amoureux'}</button>
      <button data-a="m-captain" data-id="${p.id}">${icon('crown', 15)} ${p.captain ? 'Retirer Capitaine' : 'Capitaine'}</button>
      <button data-a="m-charm" data-id="${p.id}">${icon('music', 15)} ${p.charmed ? 'Plus charmé' : 'Charmé'}</button>
      <button data-a="m-wolf" data-id="${p.id}">${icon('wolf', 15)} ${p.infected ? 'Plus infecté' : 'Devenu loup (infecté)'}</button>
      <button data-a="m-note" data-id="${p.id}">${icon('note', 15)} Note</button></div>`;
  }

  function gameHTML() {
    const title = S.phase === 'night' ? `Nuit ${S.night}` : S.phase === 'day' ? `Jour ${S.day}` : 'Fin de partie';
    if (S.phase === 'end') {
      return `${headerHTML(title, '')}<main class="mj-main"><section class="mj-panel mj-script"><div class="mj-reveal">${icon('crown', 30)}<span><small>FIN DE PARTIE</small><b>${esc(S.winner || '')}</b></span></div>
        <p class="mj-muted">Retournez toutes les cartes. Le suivi à droite montre qui était qui.</p><div class="mj-foot"><span class="grow"></span>${btn('Rejouer avec les mêmes joueurs', 'replay', true)}</div></section>${suiviHTML()}</main>`;
    }
    return `${headerHTML(title, stepsHTML())}<main class="mj-main">${stepHTML()}${suiviHTML()}</main>`;
  }

  function render() {
    document.body.dataset.appearance = 'dark';
    document.body.dataset.theme = S.phase === 'day' ? 'day' : 'night';
    const focus = document.activeElement && document.activeElement.id;
    $root.innerHTML = S.phase === 'setup' ? setupHTML() : gameHTML();
    if (focus) { const el = document.getElementById(focus); if (el) el.focus(); }
  }

  // ---------- Actions ----------
  function deal() {
    const deck = [];
    for (const [k, n] of Object.entries(S.compo)) for (let i = 0; i < n; i++) deck.push(k);
    const d = shuffle(deck);
    S.players.forEach((p, i) => { p.role = d[i]; });
    S.extra = d.slice(S.players.length);
  }
  function applyStep() {
    const t = cur(), sel = ui.sel;
    snap();
    switch (t) {
      case 'voleur': {
        const v = holders('voleur')[0];
        if (v && ui.choice >= 0) { const took = S.extra[ui.choice]; S.extra[ui.choice] = 'voleur'; v.role = took; log(`Le Voleur (${v.name}) devient ${rn(took)}.`); } else log('Le Voleur garde sa carte.');
        break;
      }
      case 'cupidon': for (const id of sel) P(id).lover = true; log(`Cupidon unit ${sel.map(name).join(' et ')}.`); break;
      case 'enfant': { const k = holders('enfant')[0]; if (k) k.model = sel[0]; log(`L'Enfant sauvage prend ${name(sel[0])} pour modèle.`); break; }
      case 'salvateur': S.protected = sel[0]; S.lastProtected = sel[0]; log(`Le Salvateur protège ${name(sel[0])}.`); break;
      case 'voyante': log(`La Voyante voit ${name(sel[0])} : ${rn(P(sel[0]).role)}.`); break;
      case 'renard': { const trio = neighbours(sel[0]); const w = trio.some((id) => isWolf(P(id))); if (!w) S.foxLost = true; log(`Le Renard flaire ${trio.map(name).join(', ')} : ${w ? 'un loup' : 'aucun loup, il perd son flair'}.`); break; }
      case 'loups': S.victim = sel[0]; log(`Les loups choisissent ${name(sel[0])}.`); break;
      case 'grandloup': S.bigbad = sel[0]; log(`Le Grand Méchant Loup dévore aussi ${name(sel[0])}.`); break;
      case 'loupblanc': S.white = sel[0]; log(`Le Loup Blanc dévore ${name(sel[0])}.`); break;
      case 'sorciere':
        if (ui.sorc.save && S.victim) { S.saved = true; S.potions.life = false; log(`La Sorcière sauve ${name(S.victim)}.`); }
        if (ui.sorc.kill) { S.poison = ui.sorc.kill; S.potions.death = false; log(`La Sorcière empoisonne ${name(ui.sorc.kill)}.`); }
        break;
      case 'flute': for (const id of sel) P(id).charmed = true; log(`Le Joueur de flûte charme ${sel.map(name).join(' et ')}.`); break;
      case 'captain': for (const p of S.players) p.captain = p.id === sel[0]; log(`${name(sel[0])} est élu Capitaine.`); break;
      case 'hunter': { const h = S.players.find((p) => p.role === 'chasseur' && !p.alive && !p.shot); if (h) h.shot = true; const d = kill(sel[0], 'chasseur'); log(`Le Chasseur emporte ${deadLine(d)}.`); toast(`${deadLine(d)} meurt`); break; }
      case 'successor': for (const p of S.players) p.captain = p.id === sel[0]; log(`${name(sel[0])} devient Capitaine.`); break;
      default: break;
    }
    next();
  }
  function noneStep() {
    const t = cur();
    snap();
    if (t === 'voleur') log('Le Voleur garde sa carte.');
    else if (t === 'hunter') { const h = S.players.find((p) => p.role === 'chasseur' && !p.alive && !p.shot); if (h) h.shot = true; }
    else if (LABEL[t]) log(`${LABEL[t]} : rien.`);
    next();
  }
  function dawnOk() {
    snap();
    const plan = dawnPlan().filter((x) => P(x.id) && P(x.id).alive);
    const dead = [];
    for (const x of plan) {
      if (x.cause === 'ancien') { P(x.id).ancienHit = true; log(`${name(x.id)} (Ancien) résiste aux loups.`); continue; }
      dead.push(...kill(x.id, x.cause));
    }
    if (S.infectNow) { P(S.victim).infected = true; S.infectUsed = true; }
    // Épée rouillée : le Chevalier tué cette nuit blesse le premier loup à sa gauche, qui meurt la nuit suivante.
    S.rustyKill = null;
    if (S.rusty) {
      const order = S.players, i = order.findIndex((p) => p.id === S.rusty);
      for (let k = 1; k < order.length; k++) { const q = order[(i + k) % order.length]; if (q.alive && isWolf(q)) { S.rustyKill = q.id; log(`L'épée rouillée blesse ${q.name} : il mourra la nuit prochaine.`); break; } }
      S.rusty = null;
    }
    S.dawnText = dead.length ? `Morts cette nuit : ${deadLine(dead)}.` : 'Personne n\'est mort cette nuit.';
    log(S.dawnText);
    S.dawnDone = true;
    save(); render();
  }
  function voteResolve(targetId, how) {
    snap();
    S.voteDone = true;
    let text = '';
    if (!targetId) text = how === 'tie' ? 'Égalité : personne n\'est éliminé.' : 'Personne n\'est éliminé.';
    else {
      const t = P(targetId);
      if (t.role === 'idiot' && !t.idiotRevealed) { t.idiotRevealed = true; text = `${t.name} est l'Idiot du village : il est gracié mais ne votera plus.`; }
      else if (t.role === 'ange' && S.firstVote) { kill(t.id, 'vote'); S.winner = 'L\'Ange a été éliminé au premier vote : il gagne seul !'; text = S.winner; }
      else {
        const d = kill(t.id, how === 'bouc' ? 'bouc' : 'vote');
        if (t.role === 'ancien') { S.powersLost = true; log('Le village a éliminé l\'Ancien : les villageois perdent leurs pouvoirs.'); }
        text = `Éliminé : ${deadLine(d)}.`;
      }
    }
    S.firstVote = false;
    S.voteText = text;
    log(text);
    save(); render();
  }

  function act(a, el) {
    const id = el.dataset.id;
    switch (a) {
      case 'setup-go': {
        const v = +el.dataset.v;
        if (v === 3 && S.distrib === 'random' && !S.players.every((p) => p.role)) deal();
        S.setupStep = v; break;
      }
      case 'pup': case 'pdown': { const i = S.players.findIndex((p) => p.id === id), j = a === 'pup' ? i - 1 : i + 1; if (j >= 0 && j < S.players.length) [S.players[i], S.players[j]] = [S.players[j], S.players[i]]; break; }
      case 'pdel': S.players = S.players.filter((p) => p.id !== id); break;
      case 'cplus': S.compo[el.dataset.r] = (S.compo[el.dataset.r] || 0) + 1; clearRoles(); break;
      case 'cminus': S.compo[el.dataset.r] = Math.max(0, (S.compo[el.dataset.r] || 0) - 1); clearRoles(); break;
      case 'distrib': S.distrib = el.dataset.v; clearRoles(); if (S.distrib === 'random') deal(); break;
      case 'deal': deal(); break;
      case 'nameless': S.nameless = el.dataset.v === '1'; S.extra = []; break;
      case 'begin-nameless': {
        // Un joueur par carte (moins les 2 du centre pour le Voleur), nommé d'après sa carte.
        const left = Object.assign({}, S.compo);
        for (const r of S.extra || []) if (r) left[r] -= 1;
        const total = {}, seen = {};
        for (const [k, n] of Object.entries(left)) if (n > 0) total[k] = n;
        S.players = [];
        for (const [k, n] of Object.entries(total)) for (let i = 0; i < n; i++) {
          seen[k] = (seen[k] || 0) + 1;
          S.players.push({ id: `${k}-${seen[k]}`, name: rn(k) + (n > 1 ? ` ${seen[k]}` : ''), role: k, baseRole: k, alive: true });
        }
        S.distrib = 'manual';
      }
      // fallthrough : même lancement que la version avec prénoms
      case 'begin': {
        if (S.nameless && a === 'begin') break;
        if (S.distrib === 'manual' && !S.nameless) {
          const left = [];
          for (const [k, n] of Object.entries(S.compo)) for (let i = 0; i < n - S.players.filter((p) => p.role === k).length; i++) left.push(k);
          S.extra = left;
        }
        for (const p of S.players) Object.assign(p, { alive: true, death: null, lover: false, captain: false, charmed: false, infected: false, wild: false, model: null, idiotRevealed: false, ancienHit: false, shot: false });
        S.log = []; undo = [];
        log(`Partie lancée : ${S.players.length} joueurs.`);
        startNight(); break;
      }
      case 'goto': snap(); S.cursor = +el.dataset.v; resetUi(); S.dawnDone = false; S.voteDone = false; break;
      case 'prev': snap(); S.cursor = Math.max(0, S.cursor - 1); resetUi(); S.dawnDone = false; S.voteDone = false; break;
      case 'pick': {
        const max = +el.dataset.max;
        if (ui.sel.includes(id)) ui.sel = ui.sel.filter((x) => x !== id);
        else ui.sel = max === 1 ? [id] : ui.sel.concat(id).slice(-max);
        break;
      }
      case 'choice': ui.choice = +el.dataset.v; break;
      case 'apply': return applyStep();
      case 'none': return noneStep();
      case 'skipstep': S.dawnDone = false; S.voteDone = false; return next();
      case 'to-quick': snap(); S.steps = S.steps.slice(0, S.cursor).concat('quick'); resetUi(); break;
      case 'quick-none': snap(); S.dawnText = 'Personne n\'est mort cette nuit.'; log(S.dawnText); S.dawnDone = true; break;
      case 'quick-ok': {
        snap();
        const dead = [];
        for (const id of ui.sel) dead.push(...kill(id, 'nuit'));
        S.dawnText = `Morts cette nuit : ${deadLine(dead)}.`;
        log(S.dawnText);
        S.dawnDone = true; // même écran de résultat que l'aube (avec la victoire éventuelle)
        break;
      }
      case 'fox-yes': snap(); log('Le Renard flaire un loup.'); return next();
      case 'fox-no': snap(); S.foxLost = true; log('Le Renard ne flaire aucun loup : il perd son flair.'); return next();
      case 'infect-yes': snap(); S.infectNow = true; log(`L'Infect Père des Loups infecte ${name(S.victim)}.`); return next();
      case 'sorc-kill': ui.sorc.kill = ui.sorc.kill === id ? null : id; break;
      case 'dawn-ok': return dawnOk();
      case 'vmode': ui.voteMode = el.dataset.v; ui.sel = []; break;
      case 'vplus': ui.counts[id] = (ui.counts[id] || 0) + 1; break;
      case 'vminus': ui.counts[id] = Math.max(0, (ui.counts[id] || 0) - 1); break;
      case 'vote-ok': return voteResolve(ui.voteMode === 'note' ? ui.sel[0] : topVoted());
      case 'vote-none': return voteResolve(null);
      case 'vote-tie': { const b = holders('bouc').find((p) => p.alive); return voteResolve(b ? b.id : null, b ? 'bouc' : 'tie'); }
      case 'end': snap(); S.winner = checkWin(); S.phase = 'end'; log(S.winner); break;
      case 'ignorewin': S.ignoreWin = true; break;
      case 'replay': {
        const players = S.players.map((p) => ({ id: p.id, name: p.name, role: null }));
        const keep = { compo: S.compo, distrib: S.distrib, callDead: S.callDead, quick: S.quick, nameless: S.nameless, extra: S.nameless ? S.extra : [] };
        S = Object.assign(newState(), keep, { players: S.nameless ? [] : players, setupStep: S.nameless ? 2 : 3 });
        if (S.distrib === 'random' && !S.nameless) deal();
        undo = []; break;
      }
      case 'undo': if (undo.length) { S = JSON.parse(undo.pop()); resetUi(); toast('Dernière action annulée'); } break;
      case 'reset': if (confirmReset()) { S = newState(); undo = []; } break;
      case 'suivi': ui.showSuivi = !ui.showSuivi; break;
      case 'menu': ui.menu = ui.menu === id ? null : id; break;
      case 'm-dead': { snap(); const d = kill(id, 'mj'); log(`Correction : ${deadLine(d)} marqué mort.`); ui.menu = null; break; }
      case 'm-alive': { snap(); const p = P(id); p.alive = true; p.death = null; log(`Correction : ${p.name} est de nouveau en vie.`); ui.menu = null; break; }
      case 'm-lover': { snap(); const p = P(id); p.lover = !p.lover; log(`Correction : ${p.name} ${p.lover ? 'est amoureux' : 'n\'est plus amoureux'}.`); break; }
      case 'm-captain': { snap(); const p = P(id); const on = !p.captain; for (const q of S.players) q.captain = false; p.captain = on; log(`Correction : ${on ? p.name + ' est Capitaine' : 'plus de Capitaine'}.`); break; }
      case 'm-charm': { snap(); const p = P(id); p.charmed = !p.charmed; break; }
      case 'm-wolf': { snap(); const p = P(id); p.infected = !p.infected; log(`Correction : ${p.name} ${p.infected ? 'devient loup' : 'n\'est plus loup'}.`); break; }
      case 'm-note': { const p = P(id); const n = window.prompt(`Note sur ${p.name} (visible seulement par toi)`, p.note || ''); if (n !== null) { snap(); p.note = n.trim(); } break; }
      default: return;
    }
    save(); render();
  }
  function clearRoles() { for (const p of S.players) p.role = null; S.extra = []; }
  function confirmReset() { return S.phase === 'setup' && !S.players.length ? true : window.confirm('Recommencer une nouvelle partie ? La partie en cours sera effacée.'); }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'FORM') return;
    if (el.disabled) return;
    act(el.dataset.a, el);
  });
  document.addEventListener('change', (e) => {
    const el = e.target, a = el.dataset.a;
    if (a === 'pname') { const p = P(el.dataset.id); if (p) p.name = el.value.trim().slice(0, 20) || p.name; save(); }
    else if (a === 'prole') { P(el.dataset.id).role = el.value || null; save(); render(); }
    else if (a === 'calldead') { S.callDead = el.checked; save(); }
    else if (a === 'quickmode') { S.quick = el.checked; save(); }
    else if (a === 'extra') { S.extra = S.extra || []; S.extra[+el.dataset.i] = el.value || null; save(); render(); }
    else if (a === 'sorc-save') { ui.sorc.save = el.checked; }
    else if (a === 'm-role') { snap(); const p = P(el.dataset.id); p.role = el.value; log(`Correction : ${p.name} est ${rn(el.value)}.`); save(); render(); }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.dataset.a !== 'padd') return;
    e.preventDefault();
    const inp = document.getElementById('mj-new');
    const n = inp.value.trim().slice(0, 20);
    if (!n) return;
    if (S.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return toast('Ce prénom est déjà pris');
    S.players.push({ id: Math.random().toString(36).slice(2, 9), name: n, role: null, alive: true });
    clearRoles();
    save(); render();
    const again = document.getElementById('mj-new'); if (again) again.focus();
  });

  fetch('/api/roles').then((r) => r.json()).then((d) => {
    for (const [k, v] of Object.entries(d.roles)) if (!k.startsWith('n_') && v.impl) R[k] = v;
    S = load() || newState();
    render();
  }).catch(() => { $root.innerHTML = '<p class="loading">Impossible de charger les rôles.</p>'; });
})();
