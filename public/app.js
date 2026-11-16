/* Loup-Garou — client (interface en zones) */
(() => {
  const socket = io();
  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');
  const Media = window.LGMedia;
  let view = null;
  let ROLES = null;
  let EXTS = null;
  let RULES = [];
  let helpOpen = false;
  let helpAnim = false;
  let offset = 0;
  let ui = { key: null, sel: [], cv: null, save: false, kill: null };

  const COLORS = ['#E8A75D', '#8DB4F0', '#C7A6E8', '#7FC8A9', '#F08A6C'];
  const DAY_STEPS = ['dawn', 'captain_vote', 'debate', 'vote', 'hunter', 'successor'];
  const TEAM = { loups: 'Loups', village: 'Village', solitaire: 'Solitaire' };
  const STEP_LABEL = {
    compoVote: 'Vote des rôles', roles_reveal: 'Rôles', cupidon: 'Cupidon', salvateur: 'Salvateur', voyante: 'Voyante',
    loups: 'Loups-Garous', sorciere: 'Sorcière', dawn: 'Aube', captain_vote: 'Capitaine', debate: 'Débat', vote: 'Vote',
    voleur: 'Voleur', soeurs: 'Sœurs', enfant: 'Enfant Sauvage', renard: 'Renard', infect: 'Infect', grandloup: 'Grand Méchant Loup',
    loupblanc: 'Loup Blanc', flute: 'Flûte', hunter: 'Chasseur', successor: 'Capitaine'
  };
  const ICON = {
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    cam: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3z"/>',
    camoff: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3zM3 3l18 18"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    micoff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M3 3l18 18"/>',
    grave: '<path d="M7 21V10a5 5 0 0 1 10 0v11M5 21h14M12 10v5M10 12h4"/>',
    ear: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1"/><rect x="17" y="14" width="4" height="6" rx="1"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    village: '<path d="M3 21V11l5-4 5 4v10M13 21v-7l4-3 4 3v7M3 21h18M7 21v-4h2v4"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    cards: '<rect x="3" y="5" width="12" height="16" rx="2"/><path d="M9 3h10a2 2 0 0 1 2 2v14"/>',
    scroll: '<path d="M8 6h12M8 12h12M8 18h12M4 6h0M4 12h0M4 18h0"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h0"/>',
    potion: '<path d="M9 3h6M10 3v5L5 17a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3"/><path d="M7.5 14h9"/>',
    poison: '<path d="M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3z"/><path d="M9 19v2M15 19v2M12 19v2"/><circle cx="9.5" cy="11" r="1.2"/><circle cx="14.5" cy="11" r="1.2"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h0"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'
  };
  const icon = (n, size = 16, color = 'currentColor') =>
    `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Connexion ----------
  // Session : par onglet (sessionStorage, pour tester à plusieurs onglets) + la dernière partie
  // gardée dans localStorage pour pouvoir revenir après avoir fermé l'onglet (iPhone…).
  const readJSON = (store, key) => { try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; } };
  const saved = () => readJSON(sessionStorage, 'lg');
  const lastGame = () => readJSON(localStorage, 'lg-last');
  const save = (code, token, name) => {
    sessionStorage.setItem('lg', JSON.stringify({ code, token }));
    localStorage.setItem('lg-last', JSON.stringify({ code, token, name }));
  };
  const forget = () => { sessionStorage.removeItem('lg'); localStorage.removeItem('lg-last'); };
  const urlCode = (new URLSearchParams(location.search).get('code') || '').toUpperCase();
  let home = { step: urlCode ? 'join' : 'choose', code: urlCode, info: null };
  let lastAnimKey = null;
  let animT = null;
  const freshDead = new Set();
  let drawerOpen = false;
  let drawerAnim = false;
  // Apparence choisie (clair / sombre), indépendante de la phase : la nuit et le jour ne font que nuancer les teintes.
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.dataset.appearance = localStorage.getItem('lg-appearance') || (prefersDark ? 'dark' : 'light');

  fetch('/api/roles').then((r) => r.json()).then((d) => {
    ROLES = d.roles;
    EXTS = d.extensions;
    RULES = d.rules || [];
    Media.init(socket, d, render);
    render();
  });

  socket.on('connect', () => {
    const s = saved();
    if (s) socket.emit('resume', s, (r) => { if (!r.ok) { sessionStorage.removeItem('lg'); setView(null); toast(r.error); } });
    else {
      render();
      if (home.step === 'join' && home.code && !home.info) lookup(home.code);
    }
  });
  socket.on('kicked', () => { forget(); home = { step: 'choose', code: '', info: null }; setView(null); toast("Tu as été exclu de la partie par l'hôte."); });
  socket.on('disconnect', () => toast('Connexion perdue… reconnexion en cours'));
  socket.on('state', (v) => {
    if (!v) return;
    offset = v.room.serverNow - Date.now();
    const k = stepKey(v.step);
    if (k !== ui.key) ui = { key: k, sel: [], cv: null, save: false, kill: null };
    setView(v);
  });

  function setView(v) {
    if (view && v && view.room.code === v.room.code) {
      for (const p of v.players) {
        const before = view.players.find((x) => x.id === p.id);
        if (before && before.alive && !p.alive) { freshDead.add(p.id); setTimeout(() => freshDead.delete(p.id), 2500); }
      }
    }
    const prev = view;
    view = v;
    Media.update(v);
    if (v) notify(prev, v);
    render();
  }
  function stepKey(st) { return st ? `${st.type}:${st.round}:${st.deadline}` : null; }
  function send(ev, data, ok) {
    socket.emit(ev, data || {}, (r) => { if (!r || !r.ok) toast((r && r.error) || 'Erreur'); else if (ok) ok(r); });
  }
  let toastT;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => $toast.classList.remove('show'), 3500);
  }

  // ---------- Helpers ----------
  const P = (id) => view.players.find((p) => p.id === id);
  const nm = (id) => { const p = P(id); return p ? esc(p.name) : '?'; };
  const colorOf = (id) => COLORS[Math.max(0, view.players.findIndex((p) => p.id === id)) % COLORS.length];
  const alivePlayers = () => view.players.filter((p) => p.alive && !p.isMJ);
  const roleName = (r) => (ROLES && ROLES[r] ? ROLES[r].name : r);
  const teamOf = (r) => (ROLES && ROLES[r] ? ROLES[r].team : 'village');
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const isDayCtx = () => !!view && view.room.phase !== 'end' && (view.room.phase === 'day' || !!(view.step && DAY_STEPS.includes(view.step.type)));
  // Chaque zone a son icône : on sait d'un coup d'œil où l'on est.
  const zone = (ic, title, body, cls = '', right = '') =>
    `<section class="zone ${cls}"><h2 class="zh"><span class="zn">${icon(ic, 14)}</span>${title}${right ? `<span class="zh-r">${right}</span>` : ''}</h2><div class="zb">${body}</div></section>`;

  setInterval(() => {
    document.querySelectorAll('[data-deadline]').forEach((el) => { el.textContent = fmt(+el.dataset.deadline - Date.now() - offset); });
  }, 250);

  // ---------- Rendu ----------
  // Une liste déroulante ouverte se refermerait au moindre rendu : on attend qu'elle soit refermée.
  let pendingRender = false;
  $app.addEventListener('focusout', (e) => { if (e.target.tagName === 'SELECT' && pendingRender) { pendingRender = false; setTimeout(render, 0); } });
  function render() {
    if (!ROLES) return;
    const ae = document.activeElement;
    if (ae && ae.tagName === 'SELECT' && $app.contains(ae)) { pendingRender = true; return; }
    // Animation d'entrée seulement quand l'écran change vraiment (nouvelle étape), pas à chaque mise à jour.
    const key = view ? `${view.room.phase}:${ui.key}` : `home:${home.step}`;
    if (key !== lastAnimKey) {
      lastAnimKey = key;
      $app.classList.add('enter');
      clearTimeout(animT);
      animT = setTimeout(() => $app.classList.remove('enter'), 700);
    }
    if (!view) {
      document.body.dataset.theme = 'night';
      document.body.dataset.dead = '';
      updateThemeColor();
      $app.innerHTML = homeHTML();
      return;
    }
    document.body.dataset.theme = isDayCtx() ? 'day' : 'night';
    document.body.dataset.dead = !view.me.alive && !view.me.isMJ && view.room.phase !== 'end' ? '1' : '';
    document.body.dataset.screen = view.room.phase === 'lobby' ? 'lobby' : 'game';
    updateThemeColor();
    // Le panneau garde sa position de défilement d'un rendu à l'autre (sinon il remonte à chaque changement).
    const keep = [...$app.querySelectorAll('.drawer')].map((d) => [d.classList.contains('sheet'), d.scrollTop]);
    const opened = [...$app.querySelectorAll('details[open]')].map((d) => d.querySelector('summary').textContent);
    $app.innerHTML = view.room.phase === 'lobby' ? lobbyHTML() : gameHTML();
    for (const [sheet, top] of keep) {
      const d = $app.querySelector(sheet ? '.drawer.sheet' : '.drawer:not(.sheet)');
      if (d && top) d.scrollTop = top;
    }
    $app.querySelectorAll('details').forEach((d) => { if (opened.includes(d.querySelector('summary').textContent)) d.open = true; });
    Media.mount($app);
  }

  function updateThemeColor() {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = getComputedStyle(document.body).getPropertyValue('--band').trim() || '#1B1F3A';
  }

  function brand() {
    return `<div class="brand">${icon(isDayCtx() ? 'sun' : 'moon', 26)}<span>Loup-Garou</span></div>`;
  }

  function lookup(code) {
    socket.emit('roomInfo', { code }, (r) => {
      if (!r || !r.ok) { toast((r && r.error) || 'Code inconnu'); home.info = null; home.step = 'join'; }
      else { home.info = r.info; home.code = r.info.code; home.step = 'joinInfo'; }
      render();
    });
  }

  // Accueil en deux temps : d'abord créer ou rejoindre, ensuite le pseudo (ou reprendre une place).
  function homeHTML() {
    const name = localStorage.getItem('lg-name') || '';
    const last = lastGame();
    const back = '<button class="link" data-act="home-back">‹ Retour</button>';
    const nameField = `<label for="f-name">Ton pseudo</label>
      <input type="text" id="f-name" maxlength="20" value="${esc(name)}" autocomplete="nickname" enterkeyhint="go">`;
    let body;
    if (home.step === 'create') {
      body = `${back}<h1 class="h">Créer un salon</h1>${nameField}<button class="primary" data-act="create">Créer le salon</button>`;
    } else if (home.step === 'join') {
      body = `${back}<h1 class="h">Rejoindre un salon</h1>
        <label for="f-code">Code du salon</label>
        <input type="text" id="f-code" class="codefield" maxlength="4" value="${esc(home.code)}" autocomplete="off" autocapitalize="characters" enterkeyhint="next">
        <button class="primary" data-act="lookup">Continuer</button>`;
    } else if (home.step === 'joinInfo' && home.info) {
      const info = home.info;
      const away = info.players.filter((p) => !p.connected);
      const here = info.players.filter((p) => p.connected);
      const reclaim = away.length ? `<div class="label">Reconnexion</div>
        <div class="opts">${away.map((p) => `<button class="opt" data-act="reclaim" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>` : '';
      const join = info.canJoin ? `${nameField}<button class="primary" data-act="join">Rejoindre</button>`
        : away.length ? '' : '<div class="note">Partie en cours, complète.</div>';
      body = `${back}<h1 class="h">Salon <span class="code">${esc(info.code)}</span></h1>
        <p class="muted small">${info.canJoin ? 'Salon' : 'Partie en cours'} · ${here.length} connecté${here.length > 1 ? 's' : ''}</p>
        ${join}${reclaim}`;
    } else {
      const resume = last ? `<button class="resume" data-act="resume">
          <span class="resume-t">Reprendre ma partie</span><span class="muted small">${esc(last.name || '')} · ${esc(last.code)}</span></button>` : '';
      body = `${resume}
        <button class="big primary" data-act="home-create">${icon('moon', 20)} Créer un salon</button>
        <button class="big" data-act="home-join">${icon('village', 20)} Rejoindre avec un code</button>`;
    }
    return `<div class="home-top">${appearanceButton()}</div><main class="home">
      <div class="brand big">${icon('moon', 44)}<span>Loup-Garou</span></div>
      <div class="zone"><div class="zb">${body}</div></div></main>`;
  }

  // ----- Tuiles vidéo -----
  function tileHTML(p, opts = {}) {
    const me = view.me, st = view.step;
    const isMe = p.id === me.id;
    const slot = isMe ? (opts.slot || 'me2') : p.id;
    const night = view.room.phase === 'night' && !isDayCtx();
    const r = view.media[p.id];
    const asleep = night && !isMe && me.alive && !me.isMJ && !(r && r.recv.video) && p.alive;
    const voted = st && !st.resolved && st.done.includes(p.id) && ['vote', 'captain_vote', 'debate', 'compoVote', 'roles_reveal'].includes(st.type);
    const tl = [];
    if (p.isMJ) tl.push('<span class="chip">MJ</span>');
    if (p.role && view.room.phase !== 'lobby') tl.push(`<span class="chip t-${teamOf(p.role)}">${esc(roleName(p.role))}</span>`);
    if (opts.wolfMate) tl.push('<span class="chip wolf">Meute</span>');
    if (p.captain) tl.push(`<span class="chip cap">${icon('crown', 12, '#7A4210')} Capitaine</span>`);
    if (p.idiotRevealed) tl.push('<span class="chip">Ne vote plus</span>');
    if (p.charmed) tl.push('<span class="chip charm">Charmé</span>');
    if (p.infected) tl.push('<span class="chip wolf">Loup</span>');
    if (opts.danger) tl.push(`<span class="chip danger">${icon('alert', 12)} En danger</span>`);
    if (!p.connected) tl.push('<span class="chip">Déconnecté</span>');
    if (r && r.recv.blur) tl.push('<span class="chip">Flou</span>');
    const tr = [];
    if (p.lover || me.lover === p.id) tr.push(`<span class="chip" title="Amoureux">${icon('heart', 12, '#F08A6C')}</span>`);
    if (opts.votes != null && opts.votes > 0) tr.push(`<span class="chip votes-chip">${opts.votes} voix</span>`);
    else if (voted) tr.push(`<span class="chip ok">${icon('check', 12)} ${st.type === 'debate' || st.type === 'roles_reveal' ? 'Prêt' : 'A voté'}</span>`);
    const canKick = !opts.noKick && (me.isHost || me.isMJ) && !isMe && !p.kicked && view.room.phase !== 'end';
    const kick = canKick ? `<button class="kick" data-act="kick" data-id="${p.id}" aria-label="Exclure ${esc(p.name)}" title="Exclure">${icon('x', 14)}</button>` : '';
    const inner = `${asleep ? `<div class="sleep">${icon('moon', 22)}<span>Endormi</span></div>` : `<span class="avatar" style="background:${colorOf(p.id)}" aria-hidden="true">${esc(p.name[0])}</span>`}
      <div class="vslot" data-vslot="${slot}"></div>
      <div class="tl">${tl.join('')}</div><div class="tr">${tr.join('')}</div>
      ${opts.picked ? `<span class="picked-mark">${icon('check', 18)} ${opts.mark || (st && st.type === 'vote' ? 'Ton vote' : 'Choisi')}</span>` : ''}
      ${opts.tools || ''}
      <span class="nm">${p.mic ? '<span class="vu" aria-hidden="true"><i></i><i></i><i></i></span>' : icon('micoff', 13)}${esc(p.name)}${isMe ? ' (toi)' : ''}</span>`;
    const cls = `tile has-video-host ${isMe ? 'me' : ''} ${asleep ? 'asleep' : ''} ${opts.wolfMate ? 'wolfmate' : ''} ${opts.pick ? 'pickable' : ''} ${opts.picked ? 'picked' : ''} ${opts.danger ? 'danger' : ''} ${opts.poisoned ? 'poisoned' : ''} ${opts.saved ? 'saved' : ''} ${opts.tools ? 'has-tools' : ''}`;
    if (opts.pick) return `<button class="${cls}" data-speak="${p.id}" data-act="pick" data-id="${p.id}" aria-pressed="${!!opts.picked}" aria-label="${esc((st && VERB[st.type]) || 'Choisir')} ${esc(p.name)}">${inner}</button>`;
    return `<div class="${cls}" data-speak="${p.id}">${inner}${kick}</div>`;
  }

  // Micro et caméra indépendants : on peut parler sans se montrer.
  function mediaButtons(compact) {
    const L = Media.local;
    const mic = !L.audioTrack
      ? `<button class="toggle" data-act="media-mic" ${L.busy.audio ? 'disabled' : ''}>${icon('micoff', 16)} ${L.busy.audio ? 'Autorisation…' : compact ? 'Micro' : 'Activer le micro'}</button>`
      : `<button class="toggle ${L.mic ? 'on' : 'off'}" aria-pressed="${L.mic}" data-act="media-mic">${icon(L.mic ? 'mic' : 'micoff', 16)} ${L.mic ? 'Micro' : 'Micro coupé'}</button>`;
    const cam = `<button class="toggle ${L.cam ? 'on' : ''}" aria-pressed="${L.cam}" data-act="media-cam" ${L.busy.video ? 'disabled' : ''}>${icon(L.cam ? 'cam' : 'camoff', 16)} ${L.busy.video ? 'Autorisation…' : L.cam ? 'Caméra' : compact ? 'Caméra' : 'Activer la caméra'}</button>`;
    return mic + cam;
  }

  function mediaControlsHTML() {
    const L = Media.local, me = view.me;
    const deadNote = !me.alive && !me.isMJ && view.room.phase !== 'end' ? '<div class="note">Seuls les morts t\'entendent.</div>' : '';
    return `<div class="row media-row">${mediaButtons(false)}</div>${L.error ? `<div class="warn">${esc(L.error)}</div>` : ''}${deadNote}`;
  }

  // Barre flottante sur téléphone : micro et caméra toujours à portée de pouce.
  function mediaBarHTML() {
    if (!view || view.room.phase === 'end') return '';
    return `<nav class="mediabar" aria-label="Micro et caméra">${mediaButtons(true)}</nav>`;
  }

  // ----- Salon -----
  function lobbyWarnings(nGame) {
    const r = view.room, s = r.settings;
    const warn = [];
    if (nGame < r.minPlayers) warn.push(`Minimum ${r.minPlayers} joueurs.`);
    else if (nGame < r.recommended) warn.push(`${r.recommended} joueurs ou plus conseillés.`);
    const csize = Object.values(view.compo).reduce((a, b) => a + b, 0);
    const need = view.expectedCards != null ? view.expectedCards : nGame;
    if (s.distribution === 'auto' && csize !== need) warn.push(`${csize} cartes, il en faut ${need}${view.compo.voleur ? ' (2 au centre pour le Voleur)' : ''}.`);
    if (s.distribution === 'auto' && view.compo.soeur && view.compo.soeur !== 2) warn.push('Les Sœurs vont par deux.');
    if (s.mjMode === 'joueur' && !s.mjId) warn.push('Choisis le MJ.');
    return warn;
  }

  function settingsHTML() {
    const s = view.room.settings, host = view.me.isHost;
    const dis = host ? '' : 'disabled';
    const radio = (name, val, title, desc) => `
      <label class="choice ${s[name] === val ? 'on' : ''}"><input type="radio" name="${name}" value="${val}" data-set="${name}" ${s[name] === val ? 'checked' : ''} ${dis}>
      <span><span style="display:block;font-weight:600">${title}</span>${desc ? `<span class="muted" style="font-size:14px">${desc}</span>` : ''}</span></label>`;
    const check = (label, val, path) => `<label class="check"><input type="checkbox" data-set="${path}" ${val ? 'checked' : ''} ${dis}> ${label}</label>`;
    const mjSelect = s.mjMode === 'joueur' ? `<select id="f-mj" data-set="mjId" aria-label="Qui est le MJ ?" ${dis}><option value="">— choisir le MJ —</option>${view.players.map((p) => `<option value="${p.id}" ${s.mjId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : '';
    return `<div class="label">Maître du jeu</div>
      ${radio('mjMode', 'site', 'Le site', '')}
      ${radio('mjMode', 'joueur', 'Un joueur', 'Ne joue pas, voit tout')}
      ${mjSelect}
      <div class="label">Rôles</div>
      ${radio('distribution', 'auto', 'Automatique', '')}
      ${radio('distribution', 'vote', 'Vote des joueurs', '')}
      <div class="label">Extensions</div>
      <label class="check"><input type="checkbox" checked disabled> Jeu de base</label>
      ${check('Nouvelle Lune', s.extensions.nouvelleLune, 'ext.nouvelleLune')}
      ${check('Personnages', s.extensions.personnages, 'ext.personnages')}
      <div class="label">Règles</div>
      ${check("Révéler le rôle d'un joueur mort", s.revealOnDeath, 'revealOnDeath')}
      ${check('Les morts voient tous les rôles', s.deadSeeRoles, 'deadSeeRoles')}
      <div class="row" style="justify-content:space-between"><label for="f-debate">Temps de vote du village</label>
        <select id="f-debate" data-set="debateSeconds" style="width:auto" ${dis}>
          ${[[60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']].map(([v, l]) => `<option value="${v}" ${s.debateSeconds === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>`;
  }

  // Salon : même logique que le jeu (visages au centre, barre en bas), réglages dans le panneau.
  function lobbyHTML() {
    const r = view.room, s = r.settings, me = view.me, host = me.isHost;
    const nGame = view.players.filter((p) => !p.isMJ).length;
    const warn = lobbyWarnings(nGame);
    const link = `${location.origin}/?code=${r.code}`;
    const compo = view.compo;
    const csize = Object.values(compo).reduce((a, b) => a + b, 0);
    const wolves = Object.entries(compo).filter(([k]) => teamOf(k) === 'loups').reduce((a, [, n]) => a + n, 0);
    const mj = s.mjMode === 'site' ? 'le site' : (s.mjId && P(s.mjId) ? esc(P(s.mjId).name) : 'à choisir');
    const head = `<header class="band"><div class="in">
        <span class="ph-title">Salon</span><span class="code">${r.code}</span>
        <button class="share" data-act="copy" data-link="${esc(link)}">${icon('share', 16)} Inviter</button>
        <span class="grow"></span>${helpButton()}${appearanceButton()}<button class="stop leave" data-act="leave" aria-label="Quitter le salon">${icon('x', 16)}<span class="lbl">Quitter</span></button>
      </div></header>`;
    const title = nGame < r.minPlayers ? 'En attente des joueurs' : host ? 'Prêt à lancer' : "En attente de l'hôte";
    const summary = `<div class="lobby-summary">
        <span class="pill">MJ : ${mj}</span>
        <span class="pill">${s.distribution === 'auto' ? `${csize} cartes · ${wolves} loup${wolves > 1 ? 's' : ''}` : 'Rôles votés'}</span>
        <span class="pill">Vote : ${Math.round(s.debateSeconds / 60)} min</span>
        <button class="ghost small-btn" data-act="drawer">${icon('sliders', 14)} ${host ? 'Réglages' : 'Détails'}</button>
      </div>`;
    const prompt = `<div class="prompt"><h1>${title}</h1><p class="hint">${view.players.length} connecté${view.players.length > 1 ? 's' : ''}</p>${summary}
      ${warn.map((w) => `<div class="warn">${w}</div>`).join('')}</div>`;
    const tiles = view.players.map((p) => tileHTML(p)).join('');
    return head + `<main class="stage lobby-stage">${prompt}<div class="stage-grid lobby-grid">${tiles}</div></main>${dockHTML()}${drawerHTML()}${helpHTML()}`;
  }

  function compoHTML(n) {
    const s = view.room.settings, host = view.me.isHost;
    const compo = view.compo;
    const counts = { loups: 0, village: 0, solitaire: 0 };
    for (const [r, k] of Object.entries(compo)) counts[teamOf(r)] += k;
    const size = Object.values(compo).reduce((a, b) => a + b, 0);
    const groups = Object.entries(EXTS).filter(([e]) => e === 'base' || s.extensions[e]).map(([e, title]) => {
      const list = Object.entries(ROLES).filter(([, d]) => d.ext === e).map(([key, d]) => {
        const k = compo[key] || 0;
        const voteMode = s.distribution === 'vote';
        const ctrl = voteMode ? `<span class="muted" style="font-size:13px">${key === 'loup' || key === 'villageois' ? 'Automatique' : 'Soumis au vote'}</span>`
          : host ? `<div class="stepper"><button data-act="compo" data-role="${key}" data-delta="-1" aria-label="Retirer ${esc(d.name)}">−</button><span>${k}</span><button data-act="compo" data-role="${key}" data-delta="1" aria-label="Ajouter ${esc(d.name)}">+</button></div>`
          : `<div class="stepper"><span>${k}</span></div>`;
        return `<div class="role ${k && !voteMode ? 'on' : ''}">
          <div class="head"><span>${esc(d.name)}</span><small class="t-${d.team}">${TEAM[d.team]}</small></div>
          <p>${esc(d.desc)}</p>${ctrl}</div>`;
      }).join('');
      return `<div class="label">${title}</div><div class="roles">${list}</div>`;
    }).join('');
    const summary = s.distribution === 'vote'
      ? '<p class="note" style="margin:0">Rôle retenu à la majorité. Loups ajoutés automatiquement.</p>'
      : `<div class="row"><strong>${size} cartes · ${n} joueurs${compo.voleur ? ' + 2 au centre' : ''}</strong>
          <span class="pill t-loups">${counts.loups} Loups</span><span class="pill t-village">${counts.village} Village</span>
          ${counts.solitaire ? `<span class="pill t-solitaire">${counts.solitaire} Solitaire</span>` : ''}
          ${host && view.customCompo ? '<button data-act="compoReset">Composition automatique</button>' : ''}</div>`;
    return summary + groups;
  }

  // ----- Jeu (option A : on choisit directement sur les visages) -----
  const VERB = {
    voyante: 'Sonder', salvateur: 'Protéger', loups: 'Dévorer', vote: 'Voter contre', captain_vote: 'Élire', hunter: 'Tirer sur', successor: 'Nommer',
    sorciere: 'Empoisonner', enfant: 'Prendre pour modèle', renard: 'Flairer', grandloup: 'Dévorer aussi', loupblanc: 'Tuer', flute: 'Charmer'
  };
  const QUESTION = {
    voyante: 'Qui veux-tu sonder ?', salvateur: 'Qui protéger cette nuit ?', loups: 'Qui dévorer ?', vote: 'Qui veux-tu éliminer ?',
    captain_vote: 'Qui élire Capitaine ?', hunter: 'Qui emporter avec toi ?', successor: 'Qui sera le nouveau Capitaine ?',
    cupidon: 'Désigne deux amoureux', sorciere: 'Sauver, empoisonner ?', roles_reveal: 'Ton rôle', compoVote: 'Quels rôles veux-tu ?', debate: 'Débat',
    voleur: 'Échanger ta carte ?', soeurs: 'Concertez-vous', enfant: 'Qui sera ton modèle ?', renard: 'Qui flairer ?', infect: 'Infecter la victime ?',
    grandloup: 'Une autre victime ?', loupblanc: 'Tuer un loup ?', flute: 'Qui charmer ?'
  };
  const TWO = ['cupidon', 'flute'];

  // Ce que le joueur peut toucher dans la grille pour l'étape en cours.
  function pickMode(st) {
    if (!st || st.resolved || !st.isActor || st.type === 'sorciere') return null;
    // Le serveur donne la liste des cibles valides.
    if (!Array.isArray(st.options)) return null;
    return { ids: st.options, max: TWO.includes(st.type) ? Math.min(2, st.options.length) : 1 };
  }

  function picked(st) {
    if (!st) return [];
    if (ui.sel.length) return ui.sel;
    if (Array.isArray(st.myInput)) return st.myInput;
    return typeof st.myInput === 'string' ? [st.myInput] : [];
  }

  function gameHTML() {
    const r = view.room, st = view.step, me = view.me;
    const day = isDayCtx();
    const title = r.phase === 'end' ? 'Fin de partie' : r.phase === 'setup' ? 'Préparation' : day ? `Jour ${Math.max(1, r.day)}` : `Nuit ${r.night}`;
    const steps = r.phase === 'end' ? '' : `<ol class="steps" aria-label="Déroulé de la phase">${r.phaseSteps.map((s) =>
      `<li class="${s.state}">${esc(STEP_LABEL[s.type] || s.type)}${s.state === 'done' ? ' ✓' : ''}</li>`).join('')}</ol>`;
    const timer = st && !st.resolved && st.deadline ? `<span class="timer" data-deadline="${st.deadline}">${fmt(st.deadline - Date.now() - offset)}</span>` : '';
    let narr = '';
    if (r.phase !== 'end' && st) narr = esc(st.narration); // le résultat s'affiche en grand dans la consigne
    const spect = document.body.dataset.dead === '1' ? `<span class="pill spect-pill">${icon('ear', 14)} Spectateur</span>` : '';
    const head = `<header class="band"><div class="in">
        <span class="ph-title">${title}</span>${steps}${spect}<span class="grow"></span>${timer}
        ${helpButton()}${appearanceButton()}
        ${me.isHost && r.phase !== 'end' ? '<button class="stop" data-act="abort">Arrêter</button>' : ''}</div>
        ${narr ? `<div class="narr"><div class="in"><p>${narr}</p></div></div>` : ''}</header>`;
    return head + `<main class="stage">${promptHTML()}${gridHTML()}${cemeteryHTML()}</main>${dockHTML()}${drawerHTML()}${helpHTML()}`;
  }

  function helpButton() {
    return `<button class="appear" data-act="help" aria-label="Comment jouer ?" title="Comment jouer ?">${icon('help', 18)}</button>`;
  }

  // Aide : comment se joue ma carte, le déroulé d'une partie, les cartes en jeu.
  function helpHTML() {
    if (!helpOpen || !view) return '';
    const me = view.me;
    const d = me.role && !me.isMJ ? ROLES[me.role] : null;
    const goal = { loups: 'Camp des loups', village: 'Camp du village', solitaire: 'Tu joues seul' };
    const mine = d ? `<section class="help-mine"><p class="hint">Ta carte</p><div class="bigrole t-${d.team}">${esc(d.name)}</div>
        <p class="muted small">${goal[d.team]}</p><ul class="how">${(d.how || [d.desc]).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        ${me.infected || me.wild ? '<div class="note">Tu es devenu loup : tu te réveilles aussi avec la meute.</div>' : ''}</section>` : '';
    const inGame = Object.keys(view.compo || {}).filter((k) => ROLES[k] && k !== me.role);
    const cards = inGame.length ? `<section><h3>${view.room.phase === 'lobby' ? 'Cartes prévues' : 'Cartes de la partie'}</h3>${inGame.map((k) => `
        <details class="card-help"><summary><span>${esc(ROLES[k].name)}</span><small class="t-${ROLES[k].team}">${TEAM[ROLES[k].team]}</small></summary>
        <ul class="how">${(ROLES[k].how || [ROLES[k].desc]).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}</section>` : '';
    return `<aside class="drawer sheet open ${helpAnim ? 'slide' : ''}" role="dialog" aria-modal="true" aria-label="Comment jouer">
      <div class="drawer-head"><h2>Comment jouer</h2><button class="round" data-act="help" aria-label="Fermer">${icon('x', 18)}</button></div>
      ${mine}<section><h3>Déroulé</h3><ol class="how rules">${RULES.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>${cards}</aside>
      <div class="scrim" data-act="help"></div>`;
  }

  function appearanceButton() {
    const dark = document.body.dataset.appearance === 'dark';
    return `<button class="appear" data-act="appearance" aria-label="${dark ? 'Passer en mode clair' : 'Passer en mode sombre'}" title="${dark ? 'Mode clair' : 'Mode sombre'}">${icon(dark ? 'sun' : 'moon', 18)}</button>`;
  }

  function progressHTML(st, verb) {
    if (!st || st.actorsCount == null) return '';
    const pct = st.actorsCount ? Math.round((st.done.length / st.actorsCount) * 100) : 0;
    return `<div class="progress"><span>${st.done.length} / ${st.actorsCount} ${verb}</span><div class="bar"><div style="width:${pct}%"></div></div></div>`;
  }

  // Bandeau de consigne au-dessus des visages : la question, ou le résultat.
  function promptHTML() {
    const st = view.step, me = view.me, r = view.room;
    if (r.phase === 'end') return `<div class="prompt"><h1>${esc(r.winner ? r.winner.text : 'Fin de partie')}</h1></div>`;
    if (!st) return '';
    if (st.resolved) {
      const next = r.waitingMJ ? (me.canControl ? '' : '<p class="hint">En attente du MJ…</p>') : st.nextAt ? `<p class="hint">Suite dans <span data-deadline="${st.nextAt}"></span></p>` : '';
      return `<div class="prompt result">${resultHTML(st)}${next}</div>`;
    }
    const night = !DAY_STEPS.includes(st.type) && !['roles_reveal', 'compoVote'].includes(st.type);
    if (!st.isActor) {
      let t = night ? 'Le village dort…' : 'Patiente';
      if (me.isMJ) t = `En attente : ${st.actors.filter((a) => !st.done.includes(a)).map(nm).join(', ') || '—'}`;
      else if (!me.alive) t = 'Tu ne joues plus';
      return `<div class="prompt muted-prompt"><h1>${t}</h1>${progressHTML(st, night ? 'ont agi' : 'ont voté')}</div>`;
    }
    const mode = pickMode(st);
    let hint = mode ? (mode.max === 2 ? 'Touche deux joueurs' : 'Touche un joueur') : '';
    let extra = '';
    switch (st.type) {
      case 'roles_reveal': {
        const d = ROLES[me.role] || {};
        return `<div class="prompt"><p class="hint">Ton rôle</p><h1 class="bigrole t-${d.team}">${esc(d.name || '')}</h1><p class="desc">${esc(d.desc || '')}</p>
          <div><button class="ghost small-btn" data-act="help">${icon('help', 14)} Comment jouer ?</button></div>${progressHTML(st, 'prêts')}</div>`;
      }
      case 'compoVote': {
        const opts = Object.entries(ROLES).filter(([k, d]) => d.impl && k !== 'loup' && k !== 'villageois' && (d.ext === 'base' || r.settings.extensions[d.ext]));
        const cur = ui.cv || (Array.isArray(st.myInput) ? st.myInput : []);
        extra = `<div class="checks">${opts.map(([k, d]) => `<label class="check"><input type="checkbox" data-act="cv" data-role="${k}" ${cur.includes(k) ? 'checked' : ''}> ${esc(d.name)}</label>`).join('')}</div>`;
        break;
      }
      case 'sorciere': {
        const parts = [st.victim ? `${nm(st.victim)} est en danger` : 'Personne en danger'];
        if (st.victim && st.potions.life) parts.push('potion de vie sur sa carte');
        if (st.potions.death) parts.push('poison sur les autres');
        hint = parts.join(' · ');
        break;
      }
      case 'voleur': {
        hint = st.mustTake ? 'Deux loups : prends-en un' : 'Prends une carte ou garde la tienne';
        const sel = ui.sel[0];
        extra = `<div class="cards">${(st.cards || []).map((c, i) => `<button class="card-pick ${sel === String(i) ? 'on' : ''}" data-act="take" data-i="${i}" aria-pressed="${sel === String(i)}">
          <small class="t-${teamOf(c)}">${TEAM[teamOf(c)]}</small><b>${esc(roleName(c))}</b></button>`).join('')}</div>`;
        break;
      }
      case 'soeurs': {
        const sis = view.players.filter((p) => p.role === 'soeur' && p.id !== me.id);
        hint = sis.length ? `Ta sœur : ${sis.map((p) => esc(p.name)).join(', ')}` : '';
        break;
      }
      case 'infect':
        hint = st.victim ? `Victime : ${nm(st.victim)} · une seule fois par partie` : '';
        break;
      case 'grandloup':
        hint = st.victim ? `Victime de la meute : ${nm(st.victim)}` : 'Touche un joueur';
        break;
      case 'loupblanc':
        hint = 'Touche un loup, ou passe';
        break;
      case 'renard':
        hint = 'Il flaire ce joueur et ses deux voisins';
        break;
      case 'loups':
        if (st.rounds && st.rounds.length) extra = `<p class="desc">Désaccord : ${st.rounds[st.rounds.length - 1].map((c) => `${nm(c.voter)} → ${c.target ? nm(c.target) : 'personne'}`).join(', ')}</p>`;
        break;
      case 'vote': case 'captain_vote':
        extra = progressHTML(st, 'ont voté');
        if (st.type === 'vote') hint = 'Débattez, puis touche un joueur · le vote se clôt quand tout le monde a voté';
        if (st.type === 'vote' && r.captainId) hint += ` · ${nm(r.captainId)} compte double`;
        break;
    }
    return `<div class="prompt"><div class="prompt-row"><div><h1>${QUESTION[st.type] || 'À toi'}</h1>${hint ? `<p class="hint">${hint}</p>` : ''}</div></div>${extra}</div>`;
  }

  function gridHTML() {
    const st = view.step, me = view.me, r = view.room;
    const mode = pickMode(st);
    const sel = picked(st);
    const tally = st && st.resolved && st.result && st.result.tally ? st.result.tally : null;
    const mj = view.players.find((p) => p.isMJ && p.id !== me.id);
    const alive = view.players.filter((p) => !p.isMJ && p.alive);
    const night = r.phase === 'night' && !isDayCtx();
    const witch = st && st.type === 'sorciere' && st.isActor && !st.resolved && !st.submitted;
    const tiles = (mj ? [mj] : []).concat(alive).map((p) => {
      const can = mode && mode.ids.includes(p.id);
      const o = {
        pick: can, picked: sel.includes(p.id), votes: tally ? tally[p.id] || 0 : null,
        wolfMate: night && me.isWolf && me.wolves.includes(p.id) && p.id !== me.id, noKick: true
      };
      if (witch) Object.assign(o, witchTile(st, p));
      return tileHTML(p, o);
    }).join('');
    return `<div class="stage-grid ${mode ? 'picking' : ''} ${sel.length ? 'has-pick' : ''}">${tiles}</div>`;
  }

  // Sorcière : potion de vie sur la carte du joueur en danger, poison sur les autres.
  function witchTile(st, p) {
    const me = view.me;
    if (p.isMJ) return {};
    if (p.id === st.victim) {
      const tools = st.potions.life ? `<div class="tile-tools"><button class="potion life ${ui.save ? 'on' : ''}" data-act="save" aria-pressed="${ui.save}">${icon('potion', 16)} ${ui.save ? 'Sauvé' : 'Sauver'}</button></div>` : '';
      return { danger: true, tools, saved: ui.save };
    }
    if (!st.potions.death || p.id === me.id) return {};
    const on = ui.kill === p.id;
    return {
      tools: `<div class="tile-tools"><button class="potion death ${on ? 'on' : ''}" data-act="kill" data-id="${p.id}" aria-pressed="${on}" aria-label="Empoisonner ${esc(p.name)}">${icon('poison', 16)} ${on ? 'Empoisonné' : 'Poison'}</button></div>`,
      poisoned: on
    };
  }

  function cemeteryHTML() {
    const dead = view.players.filter((p) => !p.isMJ && !p.alive);
    if (!dead.length) return '';
    const causes = { loups: 'mort(e)', sorciere: 'mort(e)', loupblanc: 'mort(e)', rouille: 'mort(e)', vote: 'éliminé(e)', bouc: 'sacrifié(e)', chasseur: 'abattu(e)', chagrin: 'chagrin', exclu: 'exclu(e)' };
    return `<div class="cemetery-row"><span class="cem-title">${icon('grave', 16)} Cimetière</span>${dead.map((p) => {
      const d = p.death || {};
      const isMe = p.id === view.me.id;
      const info = [p.role ? roleName(p.role) : null, d.when ? d.when.toLowerCase() : causes[d.cause]].filter(Boolean).join(' · ');
      return `<span class="dchip has-video-host ${isMe ? 'me' : ''} ${freshDead.has(p.id) ? 'fresh' : ''}" data-speak="${p.id}">
        <span class="dav"><span class="avatar" aria-hidden="true">${esc(p.name[0])}</span><span class="vslot" data-vslot="${isMe ? 'me2' : p.id}"></span></span>
        <span class="dname">${esc(p.name)}${isMe ? ' (toi)' : ''}</span><span class="dinfo">${esc(info)}</span></span>`;
    }).join('')}</div>`;
  }

  // Barre du bas : moi, micro, caméra, l'action principale, le journal.
  function dockHTML() {
    const st = view.step, me = view.me, r = view.room;
    const d = me.role ? ROLES[me.role] : null;
    const L = Media.local;
    const roleBtn = me.isMJ ? '<span class="dock-role"><small>Rôle</small><b>Maître du jeu</b></span>'
      : d ? `<button class="dock-role" data-act="help" aria-label="Comment jouer ${esc(d.name)} ?"><small>${me.alive || r.phase === 'end' ? 'Ton rôle' : 'Tu étais'}</small><b class="t-${d.team}">${esc(d.name)}<span class="qmark" aria-hidden="true">?</span></b></button>` : '';
    const mic = `<button class="round ${L.audioTrack ? (L.mic ? 'on' : 'off') : ''}" data-act="media-mic" aria-pressed="${!!(L.audioTrack && L.mic)}" aria-label="${L.audioTrack && L.mic ? 'Couper le micro' : 'Activer le micro'}" ${L.busy.audio ? 'disabled' : ''}>${icon(L.audioTrack && L.mic ? 'mic' : 'micoff', 20)}</button>`;
    const cam = `<button class="round ${L.cam ? 'on' : ''}" data-act="media-cam" aria-pressed="${L.cam}" aria-label="${L.cam ? 'Couper la caméra' : 'Activer la caméra'}" ${L.busy.video ? 'disabled' : ''}>${icon(L.cam ? 'cam' : 'camoff', 20)}</button>`;
    const self = `<div class="dock-self has-video-host" data-speak="${me.id}"><span class="avatar" style="background:${colorOf(me.id)}" aria-hidden="true">${esc(me.name[0])}</span><div class="vslot" data-vslot="me"></div></div>`;
    const myTurn = st && !st.resolved && st.isActor && !st.submitted;
    const hint = myTurn ? `<div class="dock-hint"><span class="pulse-dot" aria-hidden="true"></span>À toi : ${esc(QUESTION[st.type] || 'ton action')}</div>` : '';
    return `<nav class="dock ${myTurn ? 'my-turn' : ''}" aria-label="Commandes">${hint}<div class="in">
      <div class="dock-me">${self}${roleBtn}</div>
      <div class="dock-media">${mic}${cam}</div>
      <div class="dock-actions">${actionButtons()}</div>
      <button class="round" data-act="drawer" aria-label="${r.phase === 'lobby' ? 'Réglages' : 'Journal et infos'}">${icon(r.phase === 'lobby' ? 'sliders' : 'scroll', 20)}</button>
    </div>${L.error ? `<div class="dock-error">${esc(L.error)}</div>` : ''}</nav>`;
  }

  function actionButtons() {
    const st = view.step, me = view.me, r = view.room;
    if (r.phase === 'lobby') return me.isHost ? '<button class="primary" data-act="start">Lancer la partie</button>' : '<span class="waiting">En attente de l\'hôte</span>';
    if (r.phase === 'end') return me.isHost ? '<button class="primary" data-act="restart">Nouvelle partie</button>' : '';
    if (!st) return '';
    const ctrl = controlButton();
    if (st.resolved || !st.isActor) return ctrl;
    const sel = picked(st);
    const sent = st.submitted ? `<span class="sent">${icon('check', 14)} Envoyé</span>` : '';
    switch (st.type) {
      case 'roles_reveal': return st.submitted ? sent + ctrl : `<button class="primary attn" data-act="ready">J'ai vu mon rôle</button>${ctrl}`;
      case 'compoVote': return `${sent}<button class="primary" data-act="submit">Envoyer</button>${ctrl}`;
      case 'cupidon': return `${sent}<button class="primary attn" data-act="submit" ${sel.length === 2 ? '' : 'disabled'}>${sel.length === 2 ? `Unir ${nm(sel[0])} et ${nm(sel[1])}` : 'Choisis deux joueurs'}</button>`;
      case 'flute': {
        const need = pickMode(st) ? pickMode(st).max : 2;
        const ok = sel.length === need && need > 0;
        return `${sent}<button class="primary attn" data-act="submit" ${ok ? '' : 'disabled'}>${ok ? `Charmer ${sel.map(nm).join(' et ')}` : need === 2 ? 'Choisis deux joueurs' : 'Choisis un joueur'}</button>`;
      }
      case 'sorciere': {
        if (st.submitted) return sent;
        const parts = [];
        if (ui.save) parts.push(`Sauver ${nm(st.victim)}`);
        if (ui.kill) parts.push(`empoisonner ${nm(ui.kill)}`);
        const label = parts.length ? parts.join(' et ').replace(/^e/, 'E') : 'Choisis une potion';
        return `<button class="ghost" data-act="skip">Passer</button><button class="primary attn" data-act="submit" ${parts.length ? '' : 'disabled'}>${label}</button>`;
      }
      case 'voleur': {
        const i = ui.sel[0];
        const keep = st.mustTake ? '' : '<button class="ghost" data-act="keep">Garder ma carte</button>';
        return `${sent}${keep}<button class="primary attn" data-act="submit" ${i != null ? '' : 'disabled'}>${i != null ? `Prendre ${esc(roleName(st.cards[+i]))}` : 'Choisis une carte'}</button>`;
      }
      case 'infect':
        return `${sent}<button class="ghost" data-act="infect" data-v="0">Dévorer</button><button class="wolf attn" data-act="infect" data-v="1">Infecter ${nm(st.victim)}</button>`;
      case 'soeurs':
        return st.submitted ? sent : '<button class="primary attn" data-act="ready">Terminé</button>';
      default: {
        const abst = st.type === 'vote' || st.type === 'captain_vote' ? '<button class="ghost" data-act="abstain">S\'abstenir</button>'
          : ['renard', 'loupblanc'].includes(st.type) ? '<button class="ghost" data-act="abstain">Passer</button>' : '';
        const cls = ['loups', 'grandloup', 'loupblanc'].includes(st.type) ? 'wolf' : 'primary';
        return `${sent}${abst}<button class="${cls} ${st.submitted ? '' : 'attn'}" data-act="submit" ${sel.length ? '' : 'disabled'}>${sel.length ? `${VERB[st.type] || 'Valider'} ${nm(sel[0])}` : 'Touche un joueur'}</button>${ctrl}`;
      }
    }
  }

  function controlButton() {
    const me = view.me, r = view.room, st = view.step;
    if (!me.canControl || r.phase === 'end' || !st) return '';
    if (r.waitingMJ) return '<button class="primary" data-act="control">Continuer</button>';
    if (!st.resolved) {
      if (!me.isMJ && !['compoVote', 'roles_reveal', 'captain_vote', 'vote'].includes(st.type)) return '';
      return `<button class="ghost" data-act="control">${st.type === 'vote' ? 'Clore le vote' : 'Clore l\'étape'}</button>`;
    }
    return '';
  }

  function resultHTML(st) {
    const res = st.result;
    if (!res) return '<h1>Étape terminée</h1>';
    if (st.type === 'vote' || st.type === 'captain_vote') {
      const list = res.choices.map((c) => `<span class="vote-card">${nm(c.voter)}${c.double ? ' ×2' : ''} → <b>${c.target ? nm(c.target) : 'abstention'}</b></span>`).join('');
      return `<h1>${esc(res.text)}</h1><div class="votes">${list}</div>`;
    }
    if (st.type === 'voyante' && res.seen) return `<p class="hint">Vision</p><h1>${nm(res.seen.id)} est <span class="t-${teamOf(res.seen.role)}">${esc(roleName(res.seen.role))}</span></h1>`;
    if (st.type === 'renard' && res.fox) return `<p class="hint">Flair</p><h1>${res.fox.hasWolf ? 'Il y a un loup parmi' : 'Aucun loup parmi'} ${res.fox.ids.map(nm).join(', ')}</h1>${res.fox.hasWolf ? '' : '<p class="hint">Tu perds ton flair.</p>'}`;
    if (st.type === 'voleur' && 'took' in res) return `<h1>${res.took ? `Tu es maintenant <span class="t-${teamOf(res.took)}">${esc(roleName(res.took))}</span>` : 'Tu gardes ta carte'}</h1>`;
    if (st.type === 'loups' && 'victim' in res) return `<h1>${res.victim ? `Victime : ${nm(res.victim)}` : 'Aucune victime'}</h1>`;
    if (st.type === 'compoVote') {
      const compo = Object.entries(res.compo).map(([k, n]) => `${n} ${esc(roleName(k))}`).join(', ');
      return `<p class="hint">Composition retenue</p><h1 class="small-h">${compo}</h1>`;
    }
    if (res.text) return `<h1>${esc(res.text)}</h1>`;
    return '<h1>Étape terminée</h1>';
  }

  // Panneau latéral : réglages (salon), mon rôle, les joueurs (hôte : passer la main, exclure), le journal.
  function drawerHTML() {
    const me = view.me, r = view.room;
    const lobby = r.phase === 'lobby';
    let top = '';
    if (lobby) {
      const nGame = view.players.filter((p) => !p.isMJ).length;
      top = `<section><h3>Partie${me.isHost ? '' : ' · choisie par l\'hôte'}</h3>${settingsHTML()}</section>
        <section><h3>Composition</h3>${compoHTML(nGame)}</section>`;
    } else if (me.role && !me.isMJ) {
      const d = ROLES[me.role];
      const extra = [];
      if (me.infected) extra.push('Infecté : tu chasses avec les loups et gardes ton pouvoir.');
      if (me.role === 'enfant') extra.push(me.wild ? 'Ton modèle est mort : tu es devenu loup.' : me.model ? `Ton modèle : <strong>${nm(me.model)}</strong>` : 'Choisis ton modèle la première nuit.');
      if (me.charmed) extra.push('Tu es charmé par le Joueur de flûte.');
      if (me.role === 'flute') { const c = view.players.filter((p) => p.charmed); extra.push(c.length ? `Charmés : ${c.map((p) => esc(p.name)).join(', ')}` : 'Personne n\'est encore charmé.'); }
      if (me.role === 'soeur') { const sis = view.players.filter((p) => p.role === 'soeur' && p.id !== me.id); if (sis.length) extra.push(`Ta sœur : <strong>${sis.map((p) => esc(p.name)).join(', ')}</strong>`); }
      if (me.foxLost) extra.push('Tu as perdu ton flair.');
      if (me.wolves.length > 1) extra.push(`Ta meute : <strong>${me.wolves.filter((w) => w !== me.id).map(nm).join(', ')}</strong>`);
      if (me.lover) extra.push(`${icon('heart', 14, '#F08A6C')} Amoureux(se) de <strong>${nm(me.lover)}</strong>`);
      if (me.seen.length) extra.push('Visions : ' + me.seen.map((s) => `${esc(s.name)} → <span class="t-${teamOf(s.role)}">${esc(roleName(s.role))}</span>`).join(', '));
      if (r.potions) extra.push(`Potions : vie ${r.potions.life ? '✓' : '✗'} · mort ${r.potions.death ? '✓' : '✗'}`);
      if (!me.canVote) extra.push('Tu ne votes plus.');
      if (r.powersLost) extra.push('Les villageois ont perdu leurs pouvoirs.');
      top = `<section><h3>Mon rôle</h3><div class="bigrole t-${d.team}">${esc(d.name)}</div><p class="desc">${esc(d.desc)}</p>${extra.map((x) => `<div class="note">${x}</div>`).join('')}</section>`;
    }
    const manage = (me.isHost || me.isMJ) && r.phase !== 'end';
    const players = manage ? `<section><h3>Joueurs</h3>${view.players.filter((p) => p.id !== me.id && !p.kicked).map((p) => `
      <div class="prow"><span>${esc(p.name)}${p.connected ? '' : ' · déconnecté'}</span><span class="row">
        ${me.isHost && p.connected ? `<button class="ghost small-btn" data-act="giveHost" data-id="${p.id}">Nommer hôte</button>` : ''}
        <button class="ghost small-btn" data-act="kick" data-id="${p.id}">Exclure</button></span></div>`).join('') || '<p class="muted small">Personne d\'autre pour l\'instant.</p>'}</section>` : '';
    const log = view.log.length ? `<section><h3>Journal</h3><ol class="log">${view.log.slice().reverse().map((l) => `<li class="${l.pub ? '' : 'priv'}"><span class="when">${esc(l.when || '')}</span><span>${esc(l.text)}</span></li>`).join('')}</ol></section>` : '';
    const devs = `<section><h3>Micro et caméra</h3>${deviceSelect('audio')}${deviceSelect('video')}</section>`;
    const prefs = `<section><h3>Préférences</h3><label class="check"><input type="checkbox" data-act="sound" ${soundOn() ? 'checked' : ''}> Son et vibration quand c'est à toi</label></section>`;
    return `<aside class="drawer ${lobby ? 'wide' : ''} ${drawerOpen ? 'open' : ''} ${drawerAnim ? 'slide' : ''}" aria-hidden="${!drawerOpen}" aria-label="${lobby ? 'Réglages' : 'Infos'}">
      <div class="drawer-head"><h2>${lobby ? 'Réglages' : 'Infos'}</h2><button class="round" data-act="drawer" aria-label="Fermer">${icon('x', 18)}</button></div>
      ${devs}${top}${players}${log}${prefs}</aside>
      ${drawerOpen ? '<div class="scrim" data-act="drawer"></div>' : ''}`;
  }

  // Liste des micros / caméras (les noms n'apparaissent qu'une fois l'accès autorisé).
  function deviceSelect(kind) {
    const list = Media.devices[kind];
    const label = kind === 'audio' ? 'Micro' : 'Caméra';
    const id = `f-dev-${kind}`;
    if (!list.length || list.every((d) => !d.label)) {
      return `<div class="dev-row"><span>${label}</span><span class="muted small">Active ${kind === 'audio' ? 'le micro' : 'la caméra'} pour choisir</span></div>`;
    }
    const cur = Media.selected(kind);
    return `<div class="dev-row"><label for="${id}">${label}</label><select id="${id}" data-act="dev" data-kind="${kind}" ${Media.local.busy[kind] ? 'disabled' : ''}>
      ${list.map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || `${label} ${i + 1}`)}</option>`).join('')}</select></div>`;
  }

  // ---------- Alertes : on ne rate pas son tour ni ce qui vient de se passer ----------
  const soundOn = () => localStorage.getItem('lg-sound') !== '0';
  let actx = null;
  function chime() {
    if (!soundOn()) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime;
      [[660, 0], [880, 0.14]].forEach(([f, d]) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.12, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.28);
        o.connect(g).connect(actx.destination);
        o.start(t + d);
        o.stop(t + d + 0.3);
      });
    } catch (e) { /* pas de son possible */ }
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
  }
  document.addEventListener('pointerdown', () => { if (actx && actx.state === 'suspended') actx.resume(); }, { passive: true });

  let alertT = null;
  function showAlert(kind, title, text) {
    const el = document.getElementById('alert');
    if (!el) return;
    el.className = `alert ${kind} show`;
    el.innerHTML = `${kind === 'turn' ? `<span class="alert-icon">${icon('target', 22)}</span>` : ''}<div><div class="alert-title">${title}</div>${text ? `<div class="alert-text">${text}</div>` : ''}</div>`;
    clearTimeout(alertT);
    alertT = setTimeout(() => { el.classList.remove('show'); }, kind === 'turn' ? 3500 : 3000);
  }

  let lastTurnKey = null;
  let lastInfoKey = null;
  let lastPhaseKey = null;
  function notify(prev, v) {
    const st = v.step;
    const myTurn = st && !st.resolved && st.isActor && !st.submitted;
    document.title = myTurn ? '● À toi · Loup-Garou' : 'Loup-Garou';
    if (!prev) { lastTurnKey = myTurn ? stepKey(st) : null; return; }
    const phaseKey = `${v.room.phase}:${v.room.night}:${v.room.day}`;
    if (v.room.phase === 'night' && phaseKey !== lastPhaseKey && prev.room.phase !== 'night') {
      showAlert('info', `Nuit ${v.room.night}`, 'Le village s\'endort');
    }
    lastPhaseKey = phaseKey;
    if (myTurn && stepKey(st) !== lastTurnKey && st.type !== 'roles_reveal') {
      lastTurnKey = stepKey(st);
      showAlert('turn', 'À toi !', esc(QUESTION[st.type] || ''));
      chime();
      return;
    }
    if (st && st.resolved && st.result && stepKey(st) !== lastInfoKey) {
      lastInfoKey = stepKey(st);
      const res = st.result;
      if (res.seen) showAlert('info', 'Vision', `${nm(res.seen.id)} est ${esc(roleName(res.seen.role))}`);
      else if (res.fox) showAlert('info', 'Flair', res.fox.hasWolf ? 'Il y a un loup' : 'Aucun loup');
      else if (res.text && ['dawn', 'vote', 'captain_vote', 'hunter', 'successor'].includes(st.type)) showAlert('info', st.type === 'dawn' ? 'Le jour se lève' : 'Résultat', esc(res.text));
    }
    if (v.room.phase === 'end' && prev.room.phase !== 'end' && v.room.winner) showAlert('info', 'Fin de partie', esc(v.room.winner.text));
  }

  // ---------- Événements ----------
  $app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    const st = view && view.step;
    switch (act) {
      case 'home-create': home = { step: 'create', code: '', info: null }; render(); focus('f-name'); break;
      case 'home-join': home = { step: 'join', code: '', info: null }; render(); focus('f-code'); break;
      case 'home-back': home = { step: home.step === 'joinInfo' ? 'join' : 'choose', code: home.code, info: null }; render(); break;
      case 'lookup': {
        const code = document.getElementById('f-code').value.trim().toUpperCase();
        if (code.length !== 4) { toast('Le code fait 4 caractères.'); break; }
        home.code = code;
        lookup(code);
        break;
      }
      case 'resume': {
        const last = lastGame();
        if (!last) break;
        socket.emit('resume', { code: last.code, token: last.token }, (r) => {
          if (r && r.ok) { sessionStorage.setItem('lg', JSON.stringify({ code: last.code, token: last.token })); return; }
          localStorage.removeItem('lg-last');
          // Jeton expiré : on propose directement de reprendre une place dans ce salon.
          home = { step: 'join', code: last.code, info: null };
          lookup(last.code);
        });
        break;
      }
      case 'create': case 'join': {
        const name = document.getElementById('f-name').value.trim();
        localStorage.setItem('lg-name', name);
        send(act, { name, code: home.code }, (r) => { save(r.code, r.token, name); history.replaceState(null, '', '/'); });
        break;
      }
      case 'reclaim': {
        const name = el.textContent.trim();
        send('reclaim', { code: home.code, playerId: el.dataset.id }, (r) => { save(r.code, r.token, name); history.replaceState(null, '', '/'); });
        break;
      }
      case 'kick': {
        const p = P(el.dataset.id);
        if (p && confirm(`Exclure ${p.name} ?`)) send('kick', { id: p.id });
        break;
      }
      case 'copy': {
        const link = el.dataset.link;
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(link).then(() => toast('Lien copié !'));
        else prompt('Copie ce lien :', link);
        break;
      }
      case 'leave':
        send('leave', {}, () => { forget(); home = { step: 'choose', code: '', info: null }; setView(null); });
        break;
      case 'media-cam': Media.toggle('cam'); break;
      case 'media-mic': Media.toggle('mic'); break;
      case 'compo': send('compo', { role: el.dataset.role, delta: +el.dataset.delta }); break;
      case 'compoReset': send('compoReset'); break;
      case 'start': send('start'); break;
      case 'control': send('control'); break;
      case 'restart': send('restart'); break;
      case 'abort': if (confirm('Arrêter la partie et revenir au salon ?')) send('abort'); break;
      case 'ready': send('act', {}); break;
      case 'sel': ui.sel = [el.dataset.id]; render(); break;
      case 'pick': {
        const id = el.dataset.id;
        if (TWO.includes(st.type)) {
          const cur = picked(st).slice();
          const max = (pickMode(st) || { max: 2 }).max;
          ui.sel = cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat(id).slice(-max);
        } else ui.sel = picked(st)[0] === id && ui.sel.length ? [] : [id];
        render();
        break;
      }
      case 'giveHost': {
        const p = P(el.dataset.id);
        if (p && confirm(`Donner le rôle d'hôte à ${p.name} ?`)) send('giveHost', { id: p.id });
        break;
      }
      case 'help':
        helpOpen = !helpOpen;
        helpAnim = helpOpen;
        if (helpOpen) drawerOpen = false;
        render();
        setTimeout(() => { helpAnim = false; }, 400);
        break;
      case 'drawer':
        drawerOpen = !drawerOpen;
        if (drawerOpen) Media.refreshDevices();
        drawerAnim = drawerOpen;
        render();
        setTimeout(() => { drawerAnim = false; }, 400);
        break;
      case 'appearance': {
        const next = document.body.dataset.appearance === 'dark' ? 'light' : 'dark';
        document.body.dataset.appearance = next;
        localStorage.setItem('lg-appearance', next);
        render();
        break;
      }
      case 'sel2': {
        const id = el.dataset.id;
        const cur = ui.sel.length ? ui.sel : Array.isArray(st.myInput) ? st.myInput.slice() : [];
        ui.sel = cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat(id).slice(-2);
        render();
        break;
      }
      case 'kill': ui.kill = ui.kill === el.dataset.id ? null : el.dataset.id; render(); break;
      case 'save': ui.save = !ui.save; render(); break;
      case 'skip': send('act', { save: false, kill: null }); break;
      case 'take': ui.sel = ui.sel[0] === el.dataset.i ? [] : [el.dataset.i]; render(); break;
      case 'keep': send('act', { take: null }); break;
      case 'infect': send('act', { infect: el.dataset.v === '1' }); break;
      case 'abstain': send('act', { target: null }); break;
      case 'submit': {
        let payload;
        if (st.type === 'compoVote') payload = { roles: ui.cv || (Array.isArray(st.myInput) ? st.myInput : []) };
        else if (TWO.includes(st.type)) payload = { targets: ui.sel };
        else if (st.type === 'voleur') payload = { take: +ui.sel[0] };
        else if (st.type === 'sorciere') payload = { save: ui.save, kill: ui.kill };
        else payload = { target: ui.sel[0] || st.myInput };
        send('act', payload);
        break;
      }
    }
  });

  $app.addEventListener('change', (e) => {
    const el = e.target;
    if (el.tagName === 'SELECT') setTimeout(() => el.blur(), 0);
    if (el.dataset.act === 'cv') {
      const st = view.step;
      let cur = (ui.cv || (Array.isArray(st.myInput) ? st.myInput : [])).slice();
      cur = el.checked ? cur.concat(el.dataset.role) : cur.filter((r) => r !== el.dataset.role);
      ui.cv = cur;
      return;
    }
    if (el.dataset.act === 'dev') { Media.choose(el.dataset.kind, el.value); return; }
    if (el.dataset.act === 'sound') { localStorage.setItem('lg-sound', el.checked ? '1' : '0'); if (el.checked) chime(); return; }
    const key = el.dataset.set;
    if (!key) return;
    let patch;
    if (key.startsWith('ext.')) patch = { extensions: { [key.slice(4)]: el.checked } };
    else if (el.type === 'checkbox') patch = { [key]: el.checked };
    else if (key === 'debateSeconds') patch = { debateSeconds: +el.value };
    else patch = { [key]: el.value || null };
    send('settings', patch);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (drawerOpen || helpOpen)) { drawerOpen = false; helpOpen = false; render(); }
  });
  $app.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target.id === 'f-name' || e.target.id === 'f-code')) {
      const btn = $app.querySelector('.home .primary[data-act]');
      if (btn) btn.click();
    }
  });

  function focus(id) { setTimeout(() => { const el = document.getElementById(id); if (el) el.focus(); }, 30); }
})();
