/* Loup-Garou — client (interface en zones) */
(() => {
  const socket = io();
  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');
  const Media = window.LGMedia;
  let view = null;
  let ROLES = null;
  let EXTS = null;
  let offset = 0;
  let ui = { key: null, sel: [], cv: null, save: false, kill: null };

  const COLORS = ['#E8A75D', '#8DB4F0', '#C7A6E8', '#7FC8A9', '#F08A6C'];
  const DAY_STEPS = ['dawn', 'captain_vote', 'debate', 'vote', 'hunter', 'successor'];
  const TEAM = { loups: 'Loups', village: 'Village', solitaire: 'Solitaire' };
  const STEP_LABEL = {
    compoVote: 'Vote des rôles', roles_reveal: 'Rôles', cupidon: 'Cupidon', salvateur: 'Salvateur', voyante: 'Voyante',
    loups: 'Loups-Garous', sorciere: 'Sorcière', dawn: 'Aube', captain_vote: 'Capitaine', debate: 'Débat', vote: 'Vote'
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
    x: '<path d="M6 6l12 12M18 6L6 18"/>'
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
    view = v;
    Media.update(v);
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
  function render() {
    if (!ROLES) return;
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
    $app.innerHTML = view.room.phase === 'lobby' ? lobbyHTML() + mediaBarHTML() : gameHTML();
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
      ${opts.picked ? `<span class="picked-mark">${icon('check', 18)} ${st && st.type === 'vote' ? 'Ton vote' : 'Choisi'}</span>` : ''}
      <span class="nm">${p.mic ? '' : icon('micoff', 13)}${esc(p.name)}${isMe ? ' (toi)' : ''}</span>`;
    const cls = `tile has-video-host ${isMe ? 'me' : ''} ${asleep ? 'asleep' : ''} ${opts.wolfMate ? 'wolfmate' : ''} ${opts.pick ? 'pickable' : ''} ${opts.picked ? 'picked' : ''}`;
    if (opts.pick) return `<button class="${cls}" data-act="pick" data-id="${p.id}" aria-pressed="${!!opts.picked}" aria-label="${esc((st && VERB[st.type]) || 'Choisir')} ${esc(p.name)}">${inner}</button>`;
    return `<div class="${cls}">${inner}${kick}</div>`;
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
  function lobbyHTML() {
    const r = view.room, s = r.settings, me = view.me, host = me.isHost;
    const dis = host ? '' : 'disabled';
    const nGame = view.players.filter((p) => !p.isMJ).length;
    const radio = (name, val, title, desc) => `
      <label class="choice ${s[name] === val ? 'on' : ''}"><input type="radio" name="${name}" value="${val}" data-set="${name}" ${s[name] === val ? 'checked' : ''} ${dis}>
      <span><span style="display:block;font-weight:600">${title}</span>${desc ? `<span class="muted" style="font-size:14px">${desc}</span>` : ''}</span></label>`;
    const check = (label, val, path) => `<label class="check"><input type="checkbox" data-set="${path}" ${val ? 'checked' : ''} ${dis}> ${label}</label>`;
    const mjSelect = s.mjMode === 'joueur' ? `<label for="f-mj" class="muted" style="font-size:14px">Qui est le MJ ?</label>
      <select id="f-mj" data-set="mjId" ${dis}><option value="">— choisir —</option>${view.players.map((p) => `<option value="${p.id}" ${s.mjId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : '';
    const warn = [];
    if (nGame < r.minPlayers) warn.push(`Minimum ${r.minPlayers} joueurs.`);
    else if (nGame < r.recommended) warn.push(`${r.recommended} joueurs ou plus conseillés.`);
    const csize = Object.values(view.compo).reduce((a, b) => a + b, 0);
    if (s.distribution === 'auto' && csize !== nGame) warn.push(`${csize} cartes pour ${nGame} joueurs.`);
    if (s.mjMode === 'joueur' && !s.mjId) warn.push('Choisis le MJ.');
    const link = `${location.origin}/?code=${r.code}`;
    const head = `<header class="band"><div class="in">${brand()}
        <div class="phase"><span class="ph-title">Salon</span><span class="ph-sub">${nGame} joueur${nGame > 1 ? 's' : ''}${s.mjMode === 'joueur' && s.mjId ? ' + MJ' : ''}</span></div>
        <span class="grow"></span>
        <div class="row"><span class="ph-sub">Code</span><span class="code">${r.code}</span>
          <button data-act="copy" data-link="${esc(link)}">Copier le lien</button><button data-act="leave">Quitter</button>${appearanceButton()}</div>
      </div></header>`;
    const moi = zone('person', 'Moi', `${tileHTML(P(me.id), { slot: 'me' })}${mediaControlsHTML()}`, 'z-moi');
    const others = view.players.filter((p) => p.id !== me.id);
    const players = zone('village', 'Joueurs', `<div class="grid">${others.map((p) => tileHTML(p)).join('') || '<p class="muted" style="margin:0">En attente de joueurs…</p>'}</div>`, 'z-village', `${view.players.length} connecté${view.players.length > 1 ? 's' : ''}`);
    const settings = `
      <div class="label">Maître du jeu</div>
      ${radio('mjMode', 'site', 'Le site', '')}
      ${radio('mjMode', 'joueur', 'Un joueur', 'Ne joue pas, voit tout')}
      ${mjSelect}
      <div class="label">Distribution des rôles</div>
      ${radio('distribution', 'auto', 'Automatique', '')}
      ${radio('distribution', 'vote', 'Vote des joueurs', '')}
      <div class="label">Extensions</div>
      <label class="check"><input type="checkbox" checked disabled> Jeu de base</label>
      ${check('Nouvelle Lune', s.extensions.nouvelleLune, 'ext.nouvelleLune')}
      ${check('Personnages', s.extensions.personnages, 'ext.personnages')}
      <div class="label">Règles</div>
      ${check("Révéler le rôle d'un joueur mort", s.revealOnDeath, 'revealOnDeath')}
      ${check('Les morts voient tous les rôles', s.deadSeeRoles, 'deadSeeRoles')}
      <div class="row" style="justify-content:space-between"><label for="f-debate">Durée du débat</label>
        <select id="f-debate" data-set="debateSeconds" style="width:auto" ${dis}>
          ${[[60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']].map(([v, l]) => `<option value="${v}" ${s.debateSeconds === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
      ${warn.map((w) => `<div class="warn">${w}</div>`).join('')}
      ${host ? '<button class="primary" data-act="start">Lancer la partie</button>' : '<div class="note">En attente de l\'hôte.</div>'}`;
    return head + `<main class="zones lobby">
        <div class="z-col-left">${moi}</div>
        <div class="z-col-mid">${players}${zone('cards', 'Composition des rôles', compoHTML(nGame))}</div>
        <div class="z-col-right">${zone('sliders', 'Réglages', settings, 'z-action v-accent')}</div>
      </main>`;
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
        const ctrl = !d.impl ? '<span class="muted" style="font-size:13px">Bientôt</span>'
          : voteMode ? `<span class="muted" style="font-size:13px">${key === 'loup' || key === 'villageois' ? 'Automatique' : 'Soumis au vote'}</span>`
          : host ? `<div class="stepper"><button data-act="compo" data-role="${key}" data-delta="-1" aria-label="Retirer ${esc(d.name)}">−</button><span>${k}</span><button data-act="compo" data-role="${key}" data-delta="1" aria-label="Ajouter ${esc(d.name)}">+</button></div>`
          : `<div class="stepper"><span>${k}</span></div>`;
        return `<div class="role ${k && !voteMode ? 'on' : ''} ${d.impl ? '' : 'soon'}">
          <div class="head"><span>${esc(d.name)}</span><small class="t-${d.team}">${TEAM[d.team]}</small></div>
          <p>${esc(d.desc)}</p>${ctrl}</div>`;
      }).join('');
      return `<div class="label">${title}</div><div class="roles">${list}</div>`;
    }).join('');
    const summary = s.distribution === 'vote'
      ? '<p class="note" style="margin:0">Rôle retenu à la majorité. Loups ajoutés automatiquement.</p>'
      : `<div class="row"><strong>${size} cartes pour ${n} joueurs</strong>
          <span class="pill t-loups">${counts.loups} Loups</span><span class="pill t-village">${counts.village} Village</span>
          ${counts.solitaire ? `<span class="pill t-solitaire">${counts.solitaire} Solitaire</span>` : ''}
          ${host && view.customCompo ? '<button data-act="compoReset">Composition automatique</button>' : ''}</div>`;
    return summary + groups;
  }

  // ----- Jeu (option A : on choisit directement sur les visages) -----
  const VERB = { voyante: 'Sonder', salvateur: 'Protéger', loups: 'Dévorer', vote: 'Voter contre', captain_vote: 'Élire', hunter: 'Tirer sur', successor: 'Nommer', sorciere: 'Empoisonner' };
  const QUESTION = {
    voyante: 'Qui veux-tu sonder ?', salvateur: 'Qui protéger cette nuit ?', loups: 'Qui dévorer ?', vote: 'Qui veux-tu éliminer ?',
    captain_vote: 'Qui élire Capitaine ?', hunter: 'Qui emporter avec toi ?', successor: 'Qui sera le nouveau Capitaine ?',
    cupidon: 'Désigne deux amoureux', sorciere: 'Sorcière', roles_reveal: 'Ton rôle', compoVote: 'Quels rôles veux-tu ?', debate: 'Débat'
  };

  // Ce que le joueur peut toucher dans la grille pour l'étape en cours.
  function pickMode(st) {
    if (!st || st.resolved || !st.isActor) return null;
    const me = view.me;
    let list = alivePlayers();
    let max = 1;
    switch (st.type) {
      case 'voyante': case 'vote': case 'sorciere': list = list.filter((p) => p.id !== me.id); break;
      case 'salvateur': list = list.filter((p) => p.id !== st.lastProtected); break;
      case 'loups': list = list.filter((p) => !me.wolves.includes(p.id)); break;
      case 'cupidon': max = 2; break;
      case 'captain_vote': case 'hunter': case 'successor': break;
      default: return null;
    }
    if (st.type === 'sorciere' && !(st.potions && st.potions.death)) return null;
    return { ids: list.map((p) => p.id), max };
  }

  function picked(st) {
    if (!st) return [];
    if (st.type === 'sorciere') return ui.kill ? [ui.kill] : [];
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
        ${appearanceButton()}
        ${me.isHost && r.phase !== 'end' ? '<button class="stop" data-act="abort">Arrêter</button>' : ''}</div>
        ${narr ? `<div class="narr"><div class="in"><p>${narr}</p></div></div>` : ''}</header>`;
    return head + `<main class="stage">${promptHTML()}${gridHTML()}${cemeteryHTML()}</main>${dockHTML()}${drawerHTML()}`;
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
      else if (st.type === 'debate') t = 'Débat';
      return `<div class="prompt muted-prompt"><h1>${t}</h1>${progressHTML(st, st.type === 'debate' ? 'prêts' : night ? 'ont agi' : 'ont voté')}</div>`;
    }
    const mode = pickMode(st);
    let hint = mode ? (mode.max === 2 ? 'Touche deux joueurs' : 'Touche un joueur') : '';
    let extra = '';
    switch (st.type) {
      case 'roles_reveal': {
        const d = ROLES[me.role] || {};
        return `<div class="prompt"><p class="hint">Ton rôle</p><h1 class="bigrole t-${d.team}">${esc(d.name || '')}</h1><p class="desc">${esc(d.desc || '')}</p>${progressHTML(st, 'prêts')}</div>`;
      }
      case 'compoVote': {
        const opts = Object.entries(ROLES).filter(([k, d]) => d.impl && k !== 'loup' && k !== 'villageois' && (d.ext === 'base' || r.settings.extensions[d.ext]));
        const cur = ui.cv || (Array.isArray(st.myInput) ? st.myInput : []);
        extra = `<div class="checks">${opts.map(([k, d]) => `<label class="check"><input type="checkbox" data-act="cv" data-role="${k}" ${cur.includes(k) ? 'checked' : ''}> ${esc(d.name)}</label>`).join('')}</div>`;
        break;
      }
      case 'debate': hint = ''; extra = progressHTML(st, 'prêts'); break;
      case 'sorciere': {
        hint = st.potions.death ? 'Touche un joueur pour l\'empoisonner (facultatif)' : '';
        const victim = st.victim ? `Les loups ont choisi <strong>${nm(st.victim)}</strong>.` : 'Les loups n\'ont choisi personne.';
        const save = st.victim && st.potions.life ? `<label class="check big"><input type="checkbox" data-act="save" ${ui.save ? 'checked' : ''}> Sauver ${nm(st.victim)}</label>` : '';
        extra = `<p class="desc">${victim}</p>${save}`;
        break;
      }
      case 'loups':
        if (st.rounds && st.rounds.length) extra = `<p class="desc">Désaccord : ${st.rounds[st.rounds.length - 1].map((c) => `${nm(c.voter)} → ${c.target ? nm(c.target) : 'personne'}`).join(', ')}</p>`;
        break;
      case 'vote': case 'captain_vote':
        extra = progressHTML(st, 'ont voté');
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
    const tiles = (mj ? [mj] : []).concat(alive).map((p) => {
      const can = mode && mode.ids.includes(p.id);
      return tileHTML(p, {
        pick: can, picked: sel.includes(p.id), votes: tally ? tally[p.id] || 0 : null,
        wolfMate: night && me.role === 'loup' && p.role === 'loup' && p.id !== me.id, noKick: true
      });
    }).join('');
    return `<div class="stage-grid ${mode ? 'picking' : ''}">${tiles}</div>`;
  }

  function cemeteryHTML() {
    const dead = view.players.filter((p) => !p.isMJ && !p.alive);
    if (!dead.length) return '';
    const causes = { loups: 'mort(e)', sorciere: 'mort(e)', vote: 'éliminé(e)', bouc: 'sacrifié(e)', chasseur: 'abattu(e)', chagrin: 'chagrin', exclu: 'exclu(e)' };
    return `<div class="cemetery-row"><span class="cem-title">${icon('grave', 16)} Cimetière</span>${dead.map((p) => {
      const d = p.death || {};
      const isMe = p.id === view.me.id;
      const info = [p.role ? roleName(p.role) : null, d.when ? d.when.toLowerCase() : causes[d.cause]].filter(Boolean).join(' · ');
      return `<span class="dchip has-video-host ${isMe ? 'me' : ''} ${freshDead.has(p.id) ? 'fresh' : ''}">
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
      : d ? `<button class="dock-role" data-act="drawer" aria-label="Voir mon rôle"><small>${me.alive || r.phase === 'end' ? 'Ton rôle' : 'Tu étais'}</small><b class="t-${d.team}">${esc(d.name)}</b></button>` : '';
    const mic = `<button class="round ${L.audioTrack ? (L.mic ? 'on' : 'off') : ''}" data-act="media-mic" aria-pressed="${!!(L.audioTrack && L.mic)}" aria-label="${L.audioTrack && L.mic ? 'Couper le micro' : 'Activer le micro'}" ${L.busy.audio ? 'disabled' : ''}>${icon(L.audioTrack && L.mic ? 'mic' : 'micoff', 20)}</button>`;
    const cam = `<button class="round ${L.cam ? 'on' : ''}" data-act="media-cam" aria-pressed="${L.cam}" aria-label="${L.cam ? 'Couper la caméra' : 'Activer la caméra'}" ${L.busy.video ? 'disabled' : ''}>${icon(L.cam ? 'cam' : 'camoff', 20)}</button>`;
    const self = `<div class="dock-self has-video-host"><span class="avatar" style="background:${colorOf(me.id)}" aria-hidden="true">${esc(me.name[0])}</span><div class="vslot" data-vslot="me"></div></div>`;
    return `<nav class="dock" aria-label="Commandes"><div class="in">
      <div class="dock-me">${self}${roleBtn}</div>
      <div class="dock-media">${mic}${cam}</div>
      <div class="dock-actions">${actionButtons()}</div>
      <button class="round" data-act="drawer" aria-label="Journal et infos">${icon('scroll', 20)}</button>
    </div>${L.error ? `<div class="dock-error">${esc(L.error)}</div>` : ''}</nav>`;
  }

  function actionButtons() {
    const st = view.step, me = view.me, r = view.room;
    if (r.phase === 'end') return me.isHost ? '<button class="primary" data-act="restart">Nouvelle partie</button>' : '';
    if (!st) return '';
    const ctrl = controlButton();
    if (st.resolved || !st.isActor) return ctrl;
    const sel = picked(st);
    const sent = st.submitted ? `<span class="sent">${icon('check', 14)} Envoyé</span>` : '';
    switch (st.type) {
      case 'roles_reveal': return st.submitted ? sent + ctrl : `<button class="primary" data-act="ready">J'ai vu mon rôle</button>${ctrl}`;
      case 'debate': return st.submitted ? sent + ctrl : `<button class="primary" data-act="ready">Prêt à voter</button>${ctrl}`;
      case 'compoVote': return `${sent}<button class="primary" data-act="submit">Envoyer</button>${ctrl}`;
      case 'cupidon': return `${sent}<button class="primary" data-act="submit" ${sel.length === 2 ? '' : 'disabled'}>${sel.length === 2 ? `Unir ${nm(sel[0])} et ${nm(sel[1])}` : 'Choisis deux joueurs'}</button>`;
      case 'sorciere': {
        const label = ui.save && ui.kill ? `Sauver et empoisonner ${nm(ui.kill)}` : ui.kill ? `Empoisonner ${nm(ui.kill)}` : ui.save ? `Sauver ${nm(st.victim)}` : 'Ne rien faire';
        return `${sent}<button class="primary" data-act="submit">${label}</button>`;
      }
      default: {
        const abst = st.type === 'vote' || st.type === 'captain_vote' ? '<button class="ghost" data-act="abstain">S\'abstenir</button>' : '';
        const cls = st.type === 'loups' ? 'wolf' : 'primary';
        return `${sent}${abst}<button class="${cls}" data-act="submit" ${sel.length ? '' : 'disabled'}>${sel.length ? `${VERB[st.type] || 'Valider'} ${nm(sel[0])}` : 'Touche un joueur'}</button>${ctrl}`;
      }
    }
  }

  function controlButton() {
    const me = view.me, r = view.room, st = view.step;
    if (!me.canControl || r.phase === 'end' || !st) return '';
    if (r.waitingMJ) return '<button class="primary" data-act="control">Continuer</button>';
    if (!st.resolved) {
      if (!me.isMJ && !['compoVote', 'roles_reveal', 'captain_vote', 'debate', 'vote'].includes(st.type)) return '';
      return `<button class="ghost" data-act="control">${st.type === 'debate' ? 'Ouvrir le vote' : 'Clore l\'étape'}</button>`;
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
    if (st.type === 'loups' && 'victim' in res) return `<h1>${res.victim ? `Victime : ${nm(res.victim)}` : 'Aucune victime'}</h1>`;
    if (st.type === 'compoVote') {
      const compo = Object.entries(res.compo).map(([k, n]) => `${n} ${esc(roleName(k))}`).join(', ');
      return `<p class="hint">Composition retenue</p><h1 class="small-h">${compo}</h1>`;
    }
    if (res.text) return `<h1>${esc(res.text)}</h1>`;
    return '<h1>Étape terminée</h1>';
  }

  // Panneau latéral : mon rôle, les joueurs (exclusion pour l'hôte), le journal.
  function drawerHTML() {
    const me = view.me, r = view.room;
    let role = '';
    if (me.role && !me.isMJ) {
      const d = ROLES[me.role];
      const extra = [];
      if (me.wolves.length > 1) extra.push(`Ta meute : <strong>${me.wolves.filter((w) => w !== me.id).map(nm).join(', ')}</strong>`);
      if (me.lover) extra.push(`${icon('heart', 14, '#F08A6C')} Amoureux(se) de <strong>${nm(me.lover)}</strong>`);
      if (me.seen.length) extra.push('Visions : ' + me.seen.map((s) => `${esc(s.name)} → <span class="t-${teamOf(s.role)}">${esc(roleName(s.role))}</span>`).join(', '));
      if (r.potions) extra.push(`Potions : vie ${r.potions.life ? '✓' : '✗'} · mort ${r.potions.death ? '✓' : '✗'}`);
      if (!me.canVote) extra.push('Tu ne votes plus.');
      if (r.powersLost) extra.push('Les villageois ont perdu leurs pouvoirs.');
      role = `<section><h3>Mon rôle</h3><div class="bigrole t-${d.team}">${esc(d.name)}</div><p class="desc">${esc(d.desc)}</p>${extra.map((x) => `<div class="note">${x}</div>`).join('')}</section>`;
    }
    const canKick = (me.isHost || me.isMJ) && r.phase !== 'end';
    const players = canKick ? `<section><h3>Joueurs</h3>${view.players.filter((p) => p.id !== me.id && !p.kicked).map((p) =>
      `<div class="prow"><span>${esc(p.name)}${p.connected ? '' : ' · déconnecté'}</span><button class="ghost small-btn" data-act="kick" data-id="${p.id}">Exclure</button></div>`).join('')}</section>` : '';
    const log = view.log.slice().reverse().map((l) => `<li class="${l.pub ? '' : 'priv'}"><span class="when">${esc(l.when || '')}</span><span>${esc(l.text)}</span></li>`).join('');
    return `<aside class="drawer ${drawerOpen ? 'open' : ''} ${drawerAnim ? 'slide' : ''}" aria-hidden="${!drawerOpen}">
      <div class="drawer-head"><h2>Infos</h2><button class="round" data-act="drawer" aria-label="Fermer">${icon('x', 18)}</button></div>
      ${role}${players}<section><h3>Journal</h3><ol class="log">${log}</ol></section></aside>
      ${drawerOpen ? '<div class="scrim" data-act="drawer"></div>' : ''}`;
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
        if (st.type === 'sorciere') ui.kill = ui.kill === id ? null : id;
        else if (st.type === 'cupidon') {
          const cur = picked(st).slice();
          ui.sel = cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat(id).slice(-2);
        } else ui.sel = picked(st)[0] === id && ui.sel.length ? [] : [id];
        render();
        break;
      }
      case 'drawer':
        drawerOpen = !drawerOpen;
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
      case 'abstain': send('act', { target: null }); break;
      case 'submit': {
        let payload;
        if (st.type === 'compoVote') payload = { roles: ui.cv || (Array.isArray(st.myInput) ? st.myInput : []) };
        else if (st.type === 'cupidon') payload = { targets: ui.sel };
        else if (st.type === 'sorciere') payload = { save: ui.save, kill: ui.kill };
        else payload = { target: ui.sel[0] || st.myInput };
        send('act', payload);
        break;
      }
    }
  });

  $app.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act === 'cv') {
      const st = view.step;
      let cur = (ui.cv || (Array.isArray(st.myInput) ? st.myInput : [])).slice();
      cur = el.checked ? cur.concat(el.dataset.role) : cur.filter((r) => r !== el.dataset.role);
      ui.cv = cur;
      return;
    }
    if (el.dataset.act === 'save') { ui.save = el.checked; render(); return; }
    const key = el.dataset.set;
    if (!key) return;
    let patch;
    if (key.startsWith('ext.')) patch = { extensions: { [key.slice(4)]: el.checked } };
    else if (el.type === 'checkbox') patch = { [key]: el.checked };
    else if (key === 'debateSeconds') patch = { debateSeconds: +el.value };
    else patch = { [key]: el.value || null };
    send('settings', patch);
  });

  $app.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target.id === 'f-name' || e.target.id === 'f-code')) {
      const btn = $app.querySelector('.home .primary[data-act]');
      if (btn) btn.click();
    }
  });

  function focus(id) { setTimeout(() => { const el = document.getElementById(id); if (el) el.focus(); }, 30); }
})();
