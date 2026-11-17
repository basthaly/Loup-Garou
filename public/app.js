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
  let RULES_BY_GAME = {};
  const GAMES = {
    thiercelieux: { name: 'Loup-Garou de Thiercelieux', short: 'Thiercelieux', sub: 'Plusieurs nuits · 8 à 18 joueurs', icon: 'moon' },
    onenight: { name: 'Loup-Garou pour une nuit', short: 'Une nuit', sub: 'Une seule nuit · 3 à 10 joueurs · 10 min', icon: 'cards' }
  };
  const isON = () => !!view && view.room.game === 'onenight';
  let helpOpen = false;
  let helpAnim = false;
  let ambOpen = false;
  const Amb = window.LGAmbience;
  let offset = 0;
  let ui = { key: null, sel: [], cv: null, save: false, kill: null, csel: [] };

  const COLORS = ['#E8A75D', '#8DB4F0', '#C7A6E8', '#7FC8A9', '#F08A6C'];
  const DAY_STEPS = ['dawn', 'captain_vote', 'debate', 'vote', 'hunter', 'successor'];
  const TEAM = { loups: 'Loups', village: 'Village', solitaire: 'Solitaire', variable: 'Variable' };
  const STEP_LABEL = {
    compoVote: 'Vote des rôles', roles_reveal: 'Rôles', cupidon: 'Cupidon', salvateur: 'Salvateur', voyante: 'Voyante',
    loups: 'Loups-Garous', sorciere: 'Sorcière', dawn: 'Aube', captain_vote: 'Capitaine', debate: 'Débat', vote: 'Vote',
    voleur: 'Voleur', soeurs: 'Sœurs', amoureux: 'Amoureux', enfant: 'Enfant Sauvage', renard: 'Renard', infect: 'Infect', grandloup: 'Grand Méchant Loup',
    loupblanc: 'Loup Blanc', flute: 'Flûte', hunter: 'Chasseur', successor: 'Capitaine',
    n_double: 'Double', n_loups: 'Loups', n_sbire: 'Sbire', n_macons: 'Francs-Maçons', n_voyante: 'Voyante', n_voleur: 'Voleur',
    n_noiseuse: 'Noiseuse', n_soulard: 'Soûlard', n_insomniaque: 'Insomniaque'
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
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    musicoff: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M3 3l18 18"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h0"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    wolf: '<path d="M4 4l4 5h8l4-5v9l-8 7-8-7z"/>',
    ballot: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    nose: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    potion: '<path d="M9 3h6M10 3v5L5 17a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3"/><path d="M7.5 14h9"/>',
    poison: '<path d="M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3z"/><path d="M9 19v2M15 19v2M12 19v2"/><circle cx="9.5" cy="11" r="1.2"/><circle cx="14.5" cy="11" r="1.2"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h0"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'
  };
  const icon = (n, size = 16, color = 'currentColor') =>
    `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;
  // Illustrations des cartes : un fichier par rôle dans /cards. Les rôles d'Une nuit repris de Thiercelieux
  // utilisent la même image. Pour changer une illustration, il suffit de remplacer le fichier.
  const CARD_ALIAS = { n_loup: 'loup', n_voyante: 'voyante', n_voleur: 'voleur', n_villageois: 'villageois', n_chasseur: 'chasseur' };
  const CARD_FILE = {}; // ex. { loup: 'loup.png' } si une image n'est pas en .webp (format 2:3, 600 × 900)
  const cardSrc = (role) => {
    if (!role) return '/img/carte-dos.svg';
    const k = CARD_ALIAS[role] || role;
    return `/cards/${CARD_FILE[k] || k + '.webp'}`;
  };
  const cardImg = (role, cls = '', alt = '') => `<img class="card-img ${cls}" src="${cardSrc(role)}" alt="${alt ? esc(alt) : ''}" draggable="false">`;
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
  const TEST = location.pathname.replace(/\/+$/, '') === '/test';
  const homeStart = () => (TEST ? 'test' : 'choose');
  let home = { step: urlCode ? 'join' : homeStart(), code: urlCode, info: null };
  // Page de test (/test) : choix du rôle, faux joueurs, triche.
  const testForm = (() => {
    try { return Object.assign({ game: 'thiercelieux', role: 'voyante', bots: 7, extra: [], reveal: false, auto: true, speed: 1 }, JSON.parse(localStorage.getItem('lg-test') || '{}')); } catch (e) { return { game: 'thiercelieux', role: 'voyante', bots: 7, extra: [], reveal: false, auto: true, speed: 1 }; }
  })();
  const saveTest = () => { try { localStorage.setItem('lg-test', JSON.stringify(testForm)); } catch (e) { /* stockage indisponible */ } };
  let lastAnimKey = null;
  let animT = null;
  const freshDead = new Set();
  let drawerOpen = false;
  let drawerKind = 'settings';
  let drawerAnim = false;
  // Apparence choisie (clair / sombre), indépendante de la phase : la nuit et le jour ne font que nuancer les teintes.
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.dataset.appearance = localStorage.getItem('lg-appearance') || (prefersDark ? 'dark' : 'light');

  fetch('/api/roles').then((r) => r.json()).then((d) => {
    ROLES = d.roles;
    EXTS = d.extensions;
    RULES = d.rules || [];
    RULES_BY_GAME = d.rulesByGame || {};
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
  socket.on('kicked', () => { forget(); home = { step: homeStart(), code: '', info: null }; setView(null); toast("Tu as été exclu de la partie par l'hôte."); });
  socket.on('disconnect', () => toast('Connexion perdue… reconnexion en cours'));
  socket.on('state', (v) => {
    if (!v) return;
    offset = v.room.serverNow - Date.now();
    const k = stepKey(v.step);
    if (k !== ui.key) ui = { key: k, sel: [], cv: null, save: false, kill: null, csel: [] };
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
  const rawName = (id) => { const p = P(id); return p ? p.name : '?'; };
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
  $app.addEventListener('focusout', (e) => { if ((e.target.tagName === 'SELECT' || e.target.type === 'range') && pendingRender) { pendingRender = false; setTimeout(render, 0); } });

  // Les vignettes prennent la place disponible selon l'écran et le nombre de joueurs (sans gros plan).
  function layoutGrid() {
    const g = $app.querySelector('.stage-grid');
    if (!g || !g.children.length) return;
    const big = g.querySelectorAll('.tile.big').length;
    const tc = g.querySelector('.table-center');
    const n = g.children.length + big * 3 + (tc ? 2 : 0);
    const W = g.clientWidth;
    const top = g.getBoundingClientRect().top + window.scrollY;
    const dock = document.querySelector('.dock');
    document.body.style.setProperty('--dock-h', `${dock ? dock.offsetHeight : 0}px`);
    const cem = $app.querySelector('.cemetery-row');
    const H = Math.max(180, window.innerHeight - top - (dock ? dock.offsetHeight : 0) - (cem ? cem.offsetHeight + 18 : 0) - 20);
    const gap = parseFloat(getComputedStyle(g).columnGap) || 12;
    let best = { w: 0, cols: 1 };
    for (let cols = big ? 2 : 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * 4 / 3);
      if (w > best.w) best = { w, cols };
    }
    const mobile = window.innerWidth <= 700;
    const lobby = g.classList.contains('lobby-grid');
    // Téléphone : jamais plus petit que 2 vignettes par ligne (3 dans le salon) ; la page défile si besoin.
    const minW = mobile ? Math.min(W, (W - gap * (lobby ? 2 : 1)) / (lobby ? 3 : 2)) : 190;
    const maxW = mobile ? 360 : 440;
    const w = Math.max(minW, Math.min(maxW, best.w));
    const cols = Math.max(big ? 2 : 1, w > best.w ? Math.max(1, Math.min(n, Math.floor((W + gap) / (w + gap)))) : best.cols);
    let size = Math.floor(Math.min(w, (W - gap * (cols - 1)) / cols));
    // Pas de micro-déplacement d'une étape à l'autre : on garde la taille si l'écart est faible.
    const prev = layoutGrid.last;
    if (prev && prev.n === n && prev.cols === cols && prev.W === W && Math.abs(prev.size - size) < 40) size = prev.size;
    layoutGrid.last = { n, cols, W, size };
    g.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
    g.style.setProperty('--tile-w', `${size}px`);
    if (tc) {
      const tiles = g.children.length - 1;
      const span = cols <= 3 ? cols : cols % 2 === 0 ? 2 : 3;
      const rows = Math.ceil((tiles + span) / cols);
      tc.style.gridRow = String(Math.max(1, Math.ceil(rows / 2)));
      tc.style.gridColumn = `${Math.floor((cols - span) / 2) + 1} / span ${span}`;
    }
    g.style.justifyContent = 'center';
  }
  let resizeT = null;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(layoutGrid, 120); });
  function render() {
    if (!ROLES) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'SELECT' || ae.type === 'range') && $app.contains(ae)) { pendingRender = true; return; }
    // Animation d'entrée seulement quand l'écran change vraiment (nouvelle étape), pas à chaque mise à jour.
    const key = view ? `${view.room.phase}:${ui.key}` : `home:${home.step}`;
    if (key !== lastAnimKey) {
      lastAnimKey = key;
      $app.classList.add('enter');
      clearTimeout(animT);
      animT = setTimeout(() => $app.classList.remove('enter'), 700);
    }
    if (!view) {
      if (Amb) Amb.update('home', true);
      document.body.dataset.theme = 'night';
      document.body.dataset.dead = '';
      document.body.dataset.screen = 'home';
      updateThemeColor();
      $app.innerHTML = homeHTML();
      return;
    }
    document.body.dataset.theme = isDayCtx() ? 'day' : 'night';
    if (Amb) Amb.update(view.room.phase, !isDayCtx());
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
    layoutGrid();
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
    if (home.step === 'test') {
      const t = testForm;
      const one = t.game === 'onenight';
      const roles = Object.entries(ROLES).filter(([, d]) => (one ? d.game === 'onenight' : d.game !== 'onenight'));
      if (!roles.some(([k]) => k === t.role)) t.role = roles[0][0];
      const minB = one ? 2 : 3, maxB = one ? 9 : 17;
      t.bots = Math.min(maxB, Math.max(minB, t.bots));
      body = `<h1 class="h">Page de test</h1><p class="muted small">Choisis ton rôle et joue avec des faux joueurs. Cette page n'est liée nulle part.</p>
        ${nameField}
        <label>Jeu</label><div class="seg" role="group">${Object.entries(GAMES).map(([k, g]) => `<button class="${t.game === k ? 'on' : ''}" data-act="t-game" data-v="${k}" aria-pressed="${t.game === k}">${esc(g.short)}</button>`).join('')}</div>
        <label for="t-role">Ton rôle</label>
        <select id="t-role" data-t="role">${roles.map(([k, d]) => `<option value="${k}" ${t.role === k ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
        <div class="row" style="justify-content:space-between"><label style="margin:0">Faux joueurs</label>
          <div class="stepper"><button data-act="t-bots" data-d="-1" aria-label="Un faux joueur de moins">−</button><span>${t.bots}</span><button data-act="t-bots" data-d="1" aria-label="Un faux joueur de plus">+</button></div></div>
        <p class="muted small" style="margin:-6px 0 0">${t.bots + 1} joueurs en tout${one ? `, ${t.bots + 4} cartes` : ''}</p>
        <label>Autres rôles à mettre en jeu</label>
        <div class="chips">${roles.filter(([k]) => k !== t.role && !['villageois', 'n_villageois'].includes(k)).map(([k, d]) => `<button class="chip-btn ${t.extra.includes(k) ? 'on' : ''}" data-act="t-extra" data-v="${k}" aria-pressed="${t.extra.includes(k)}">${esc(d.name)}</button>`).join('')}</div>
        ${one ? '' : `<div class="row" style="justify-content:space-between"><label for="t-lover" style="margin:0">Être amoureux</label>
          <select id="t-lover" data-t="lover" style="width:auto">${[['non', 'Non'], ['any', 'Oui, au hasard'], ['loup', 'Oui, avec un loup'], ['village', 'Oui, avec un villageois']].map(([v, l]) => `<option value="${v}" ${(t.lover || 'non') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`}
        <label class="check"><input type="checkbox" data-t="auto" ${t.auto ? 'checked' : ''}> Les faux joueurs jouent tout seuls</label>
        <label class="check"><input type="checkbox" data-t="reveal" ${t.reveal ? 'checked' : ''}> Voir tous les rôles (triche)</label>
        <div class="row" style="justify-content:space-between"><label for="t-speed" style="margin:0">Minuteurs</label>
          <select id="t-speed" data-t="speed" style="width:auto">${[[1, 'Normaux'], [2, 'Rapides'], [3, 'Très rapides']].map(([v, l]) => `<option value="${v}" ${+t.speed === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <button class="primary" data-act="t-start">Lancer le test</button>`;
    } else if (home.step === 'game') {
      body = `${back}<h1 class="h">À quoi on joue ?</h1>
        ${Object.entries(GAMES).map(([k, g]) => `<button class="game-pick" data-act="pick-game" data-game="${k}">
          ${cardFan(k === 'onenight' ? [null, null, null] : ['voyante', 'sorciere', 'loup'])}<span><b>${g.name}</b><small>${g.sub}</small></span></button>`).join('')}`;
    } else if (home.step === 'create') {
      const g = GAMES[home.game] || GAMES.thiercelieux;
      body = `${back}<h1 class="h">Créer un salon</h1><p class="muted small game-tag">${icon(g.icon, 14)} ${g.name}</p>${nameField}<button class="primary" data-act="create">Créer le salon</button>`;
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
        <p class="muted small">${esc((GAMES[info.game] || GAMES.thiercelieux).name)} · ${info.canJoin ? 'salon' : 'partie en cours'} · ${here.length} connecté${here.length > 1 ? 's' : ''}</p>
        ${join}${reclaim}`;
    } else {
      const resume = last ? `<button class="resume" data-act="resume">
          <span class="resume-t">Reprendre ma partie</span><span class="muted small">${esc(last.name || '')} · ${esc(last.code)}</span></button>` : '';
      body = `${resume}
        <button class="big primary" data-act="home-create">${icon('moon', 20)} Créer un salon</button>
        <button class="big" data-act="home-join">${icon('village', 20)} Rejoindre avec un code</button>`;
    }
    return `<div class="home-scene" aria-hidden="true"></div><div class="home-top">${appearanceButton()}</div><main class="home">
      <div class="brand big">${icon('moon', 44)}<span>Loup-Garou</span></div>
      <div class="zone"><div class="zb">${body}</div></div></main>`;
  }

  // Classement des voix avec les visages des votants (vote du jour, meute des loups).
  function rankHTML(choices, tally, abstLabel = 'Abstention') {
    const from = {}, t = tally || {};
    for (const c of choices || []) if (c.target) { (from[c.target] = from[c.target] || []).push(c.voter); if (!tally) t[c.target] = (t[c.target] || 0) + 1; }
    const ranked = Object.keys(t).filter((k) => t[k] > 0).sort((a, b) => t[b] - t[a]);
    if (!ranked.length) return '';
    const top = t[ranked[0]];
    const abst = (choices || []).filter((c) => !c.target).map((c) => c.voter);
    const list = ranked.map((id) => `<span class="rank ${t[id] === top ? 'top' : ''}">${face(id, 26)}<b>${(nm(id))}</b><span class="faces">${(from[id] || []).map((x) => face(x, 20)).join('')}</span><b class="n">${t[id]}</b></span>`).join('')
      + (abst.length && tally ? `<span class="rank abst"><b>${abstLabel}</b><span class="faces">${abst.map((x) => face(x, 20)).join('')}</span></span>` : '');
    return `<div class="ranks">${list}</div>`;
  }

  // Petit visage rond (initiale et couleur du joueur).
  const face = (id, size = 24) => { const p = P(id); return `<span class="face" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .45)}px;background:${colorOf(id)}" aria-hidden="true">${esc(p ? p.name[0] : '?')}</span>`; };

  // Mémos privés posés sur les vignettes : protégé (Salvateur), modèle (Enfant Sauvage), flair (Renard).
  function memos(p) {
    const me = view.me, st = view.step, out = [];
    if (isON() || view.room.phase === 'lobby' || view.room.phase === 'end') return out;
    const myPick = (type) => st && st.type === type && st.isActor && st.myInput === p.id;
    if (me.role === 'salvateur' && (me.protects === p.id || myPick('salvateur'))) out.push(`<span class="chip memo-safe">${icon('shield', 12)} Protégé</span>`);
    if (me.role === 'enfant' && !me.wild && (me.model === p.id || myPick('enfant'))) out.push(`<span class="chip memo-model">${icon('person', 12)} Ton modèle</span>`);
    if (me.role === 'renard' && me.foxNotes && me.foxNotes.length) {
      const clean = me.foxNotes.some((n) => !n.hasWolf && n.ids.includes(p.id));
      const sus = me.foxNotes.some((n) => n.hasWolf && n.ids.includes(p.id));
      if (clean) out.push('<span class="chip memo-clean" title="Flairé : aucun loup">Pas loup</span>');
      else if (sus && p.id !== me.id) out.push(`<span class="chip memo-sus" title="Flairé : un loup parmi ces joueurs">${icon('nose', 12)} Suspect</span>`);
    }
    return out;
  }

  // Changement de carte en cours de partie : Voleur, joueur infecté, Enfant Sauvage devenu loup.
  function roleChange() {
    const me = view.me;
    if (!view || !me.role || me.isMJ || isON() || view.room.phase === 'lobby') return null;
    const from = me.origRole || me.role;
    const to = me.infected || me.wild ? 'loup' : me.role;
    if (!from || from === to) return null;
    return { from, to, why: me.infected ? 'infect' : me.wild ? 'wild' : 'steal' };
  }
  const changeKey = () => { const c = roleChange(); return c ? `${c.from}>${c.to}` : ''; };
  const changeStore = () => `lg-rc-${view.room.code}-${view.me.id}`;
  let changeAnim = null;
  function changeHTML() {
    const c = roleChange();
    if (!c || view.room.phase === 'end') return '';
    const st = view.step;
    if (st && st.type === 'roles_reveal' && !st.resolved) return '';
    const key = changeKey();
    let seen = null;
    try { seen = localStorage.getItem(changeStore()); } catch (e) { /* stockage indisponible */ }
    if (seen === key) return '';
    const d = ROLES[c.to] || {};
    const first = changeAnim !== key;
    changeAnim = key;
    const camp = { loups: 'Camp des loups', village: 'Camp du village', solitaire: 'Tu joues seul' }[d.team] || '';
    const hint = { steal: 'Ta nouvelle carte', infect: 'Tu as été infecté', wild: 'Ton modèle est mort' }[c.why];
    let how = d.how || [d.desc];
    if (c.why === 'infect') how = ['Tu te réveilles désormais avec les loups et choisis la victime avec eux.', `Tu gardes ton pouvoir de ${roleName(c.from)}.`, 'Pour le village, rien n\'a changé : ne te trahis pas.'];
    if (c.why === 'wild') how = [`Ton modèle${view.me.model ? `, ${nm(view.me.model)},` : ''} est mort : tu deviens Loup-Garou.`, 'Dès cette nuit, tu te réveilles avec la meute.'];
    if (c.why === 'steal') how = [`Tu as volé la carte ${roleName(c.to)} : c'est ton rôle pour le reste de la partie.`, ...how];
    return `<div class="reveal-scrim ${first ? 'anim' : ''}"></div>
      <div class="reveal ${first ? 'anim' : ''} t-bg-${d.team}" role="dialog" aria-modal="true" aria-labelledby="rc-title">
        <div class="rv-card ${first ? 'flip' : ''}">${cardImg(c.from, 'rv-back')}${cardImg(c.to, 'rv-face', 'Carte : ' + (d.name || ''))}</div>
        <div class="rv-text"><p class="hint">${hint}</p>
        <h1 id="rc-title" class="bigrole t-${d.team}">${esc(d.name || '')}</h1>
        <p class="rv-camp">${camp}${c.why === 'steal' ? '' : ` · ${esc(roleName(c.from))} au départ`}</p>
        <ul class="how">${how.map((x) => `<li>${x}</li>`).join('')}</ul>
        <button class="primary rv-ok" data-act="rc-ok" autofocus>Compris</button></div>
      </div>`;
  }

  // Trois cartes en éventail (accueil, choix du jeu).
  function cardFan(roles) {
    return `<span class="fan" aria-hidden="true">${roles.map((r) => cardImg(r)).join('')}</span>`;
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
    if (p.role && view.room.phase !== 'lobby') tl.push(`<span class="chip t-${teamOf(p.role)}">${p.seenRole ? icon('lock', 10) + ' ' : ''}${esc(roleName(p.role))}</span>`);
    if (opts.wolfMate) tl.push('<span class="chip wolf">Meute</span>');
    if (p.captain) tl.push(`<span class="chip cap">${icon('crown', 12, '#7A4210')} Capitaine</span>`);
    if (p.idiotRevealed) tl.push('<span class="chip">Ne vote plus</span>');
    if (p.charmed) tl.push('<span class="chip charm">Charmé</span>');
    if (p.bot) tl.push('<span class="chip">Faux joueur</span>');
    if (p.startRole && p.startRole !== p.role) tl.push(`<span class="chip" title="Carte au départ">était ${esc(roleName(p.startRole))}</span>`);
    if (isON() && view.room.phase === 'end') tl.push(p.won ? '<span class="chip ok">Gagné</span>' : '<span class="chip">Perdu</span>');
    if (isON() && view.room.phase === 'end' && !p.alive) tl.push('<span class="chip danger">Éliminé</span>');
    if (p.infected) tl.push('<span class="chip wolf">Loup</span>');
    if (opts.danger) tl.push(`<span class="chip danger">${icon('alert', 12)} En danger</span>`);
    if (opts.out) tl.unshift(`<span class="chip out">${opts.out}</span>`);
    for (const m of memos(p)) tl.push(m);
    if (!p.connected) tl.push('<span class="chip">Déconnecté</span>');
    if (r && r.recv.blur) tl.push('<span class="chip">Flou</span>');
    const tr = [];
    if (p.lover || me.lover === p.id) tr.push(`<span class="chip" title="Amoureux">${icon('heart', 12, '#F08A6C')}</span>`);
    if (opts.voteTo !== undefined) tr.push(`<span class="chip vote-to" title="${esc(p.name)} a voté contre ${opts.voteTo ? (nm(opts.voteTo)) : 'personne'}">${icon('arrow', 13)}${opts.voteTo ? face(opts.voteTo, 20) + `<span class="vt-name">${(nm(opts.voteTo))}</span>` : 'personne'}</span>`);
    else if (opts.votes != null && opts.votes > 0) tr.push(`<span class="chip votes-chip">${opts.votes} voix</span>`);
    else if (voted) tr.push(`<span class="chip ok">${icon('check', 12)} ${st.type === 'debate' || st.type === 'roles_reveal' ? 'Prêt' : 'A voté'}</span>`);
    const canKick = !opts.noKick && (me.isHost || me.isMJ) && !isMe && !p.kicked && view.room.phase !== 'end';
    const kick = canKick ? `<button class="kick" data-act="kick" data-id="${p.id}" aria-label="Exclure ${esc(p.name)}" title="Exclure">${icon('x', 14)}</button>` : '';
    const inner = `${asleep ? `<div class="sleep">${icon('moon', 22)}<span>Endormi</span></div>` : `<span class="avatar" style="background:${colorOf(p.id)}" aria-hidden="true">${esc(p.name[0])}</span>`}
      <div class="vslot" data-vslot="${slot}"></div>
      <div class="tl">${tl.join('')}</div><div class="tr">${tr.join('')}</div>
      ${opts.picked ? `<span class="picked-mark">${icon('check', 14)}<span class="pm-t">${opts.mark || (st && st.type === 'vote' ? 'Ton vote' : 'Choisi')}</span></span>` : ''}
      ${opts.tools || ''}
      ${opts.voteFrom && opts.voteFrom.length ? `<span class="vote-from ${opts.topVoted ? 'top' : ''}" title="Contre ${esc(p.name)} : ${opts.voteFrom.map((x) => (nm(x))).join(', ')}"><span class="faces">${opts.voteFrom.map((x) => face(x, 24)).join('')}</span><b>${opts.votes || opts.voteFrom.length}</b></span>` : ''}
      <span class="nm">${p.mic ? '<span class="vu" aria-hidden="true"><i></i><i></i><i></i></span>' : icon('micoff', 13)}${esc(p.name)}${isMe ? ' (toi)' : ''}</span>`;
    const cls = `tile has-video-host ${isMe ? 'me' : ''} ${asleep ? 'asleep' : ''} ${opts.wolfMate ? 'wolfmate' : ''} ${opts.pick ? 'pickable' : ''} ${opts.picked ? 'picked' : ''} ${opts.danger ? 'danger' : ''} ${opts.big ? 'big' : ''} ${opts.out ? 'out' : ''} ${opts.poisoned ? 'poisoned' : ''} ${opts.saved ? 'saved' : ''} ${opts.tools ? 'has-tools' : ''}`;
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

  // Paramètres de la partie (salon) : le jeu, avec ou sans MJ, les règles et les durées.
  function gameSettingsHTML() {
    const s = view.room.settings, host = view.me.isHost, r = view.room;
    const dis = host ? '' : 'disabled';
    const choice = (on, attrs, title, desc) => `<label class="choice ${on ? 'on' : ''}"><input type="radio" ${attrs} ${on ? 'checked' : ''} ${dis}>
      <span><span style="display:block;font-weight:600">${title}</span>${desc ? `<span class="muted" style="font-size:14px">${desc}</span>` : ''}</span></label>`;
    const sel = (key, label, opts) => `<div class="row" style="justify-content:space-between"><label for="f-${key}">${label}</label>
      <select id="f-${key}" data-set="${key}" style="width:auto" ${dis}>${opts.map(([v, l]) => `<option value="${v}" ${s[key] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
    const check = (label, val, path) => `<label class="check"><input type="checkbox" data-set="${path}" ${val ? 'checked' : ''} ${dis}> ${label}</label>`;
    const games = Object.entries(GAMES).map(([k, g]) => choice(r.game === k, `name="game" value="${k}" data-act="game"`, g.name, g.sub)).join('');
    let out = `<section><h3>Jeu${host ? '' : ' · choisi par l\'hôte'}</h3>${games}</section>`;
    if (isON()) {
      out += `<section><h3>Durées</h3>
        ${sel('debateSeconds', 'Débat et vote', [[180, '3 min'], [300, '5 min'], [420, '7 min'], [600, '10 min']])}
        ${sel('nightSeconds', 'Temps par rôle, la nuit', [[10, '10 s'], [15, '15 s'], [20, '20 s'], [30, '30 s']])}</section>`;
      return out;
    }
    const mjSelect = s.mjMode === 'joueur' ? `<select id="f-mj" data-set="mjId" aria-label="Qui est le MJ ?" ${dis}><option value="">— choisir le MJ —</option>${view.players.map((p) => `<option value="${p.id}" ${s.mjId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : '';
    out += `<section><h3>Maître du jeu</h3>
      ${choice(s.mjMode === 'site', 'name="mjMode" value="site" data-set="mjMode"', 'Sans MJ', 'Le site mène la partie')}
      ${choice(s.mjMode === 'joueur', 'name="mjMode" value="joueur" data-set="mjMode"', 'Avec un MJ', 'Un joueur mène, voit tout et ne joue pas')}
      ${mjSelect}</section>
      <section><h3>Règles</h3>
      ${check("Révéler le rôle d'un joueur mort", s.revealOnDeath, 'revealOnDeath')}
      ${check('Les morts voient tous les rôles', s.deadSeeRoles, 'deadSeeRoles')}
      ${sel('debateSeconds', 'Temps de vote du village', [[60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']])}</section>`;
    return out;
  }

  function extensionsHTML() {
    const s = view.room.settings, dis = view.me.isHost ? '' : 'disabled';
    const check = (label, val, path) => `<label class="check"><input type="checkbox" data-set="${path}" ${val ? 'checked' : ''} ${dis}> ${label}</label>`;
    return `<section><h3>Extensions</h3><div class="ext-row"><label class="check"><input type="checkbox" checked disabled> Jeu de base</label>
      ${check('Nouvelle Lune', s.extensions.nouvelleLune, 'ext.nouvelleLune')}${check('Personnages', s.extensions.personnages, 'ext.personnages')}</div></section>`;
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
        <span class="grow"></span>${helpButton()}${settingsButton()}<button class="stop leave" data-act="leave" aria-label="Quitter le salon">${icon('x', 16)}<span class="lbl">Quitter</span></button>
      </div></header>`;
    const title = nGame < r.minPlayers ? 'En attente des joueurs' : host ? 'Prêt à lancer' : "En attente de l'hôte";
    const summary = isON() ? `<div class="lobby-summary">
        <span class="pill">${icon('cards', 14)} Une nuit</span>
        <span class="pill">${csize} cartes · ${wolves} loup${wolves > 1 ? 's' : ''}</span>
        <span class="pill">Débat : ${Math.round(s.debateSeconds / 60)} min</span>
        <button class="ghost small-btn" data-act="drawer" data-kind="roles">${icon('cards', 14)} Deck</button>
        <button class="ghost small-btn" data-act="drawer" data-kind="settings">${icon('gear', 14)} Paramètres</button>
      </div>` : `<div class="lobby-summary">
        <span class="pill">${s.mjMode === 'site' ? 'Sans MJ' : `MJ : ${mj}`}</span>
        <span class="pill">${csize} cartes · ${wolves} loup${wolves > 1 ? 's' : ''}</span>
        <span class="pill">Vote : ${Math.round(s.debateSeconds / 60)} min</span>
        <button class="ghost small-btn" data-act="drawer" data-kind="roles">${icon('cards', 14)} Rôles</button>
        <button class="ghost small-btn" data-act="drawer" data-kind="settings">${icon('gear', 14)} Paramètres</button>
      </div>`;
    const prompt = `<div class="prompt"><h1>${title}</h1><p class="hint">${view.players.length} connecté${view.players.length > 1 ? 's' : ''}</p>${summary}
      ${warn.map((w) => `<div class="warn">${w}</div>`).join('')}</div>`;
    const tiles = view.players.map((p) => tileHTML(p)).join('');
    return head + `<main class="stage lobby-stage">${prompt}<div class="stage-grid lobby-grid">${tiles}</div></main>${dockHTML()}${drawerHTML()}${helpHTML()}`;
  }

  function compoHTML(n) {
    const s = view.room.settings, host = view.me.isHost;
    const compo = view.compo;
    if (isON()) return compoONHTML(n);
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
        return `<div class="role ${k && !voteMode ? 'on' : ''}">${cardImg(key, 'role-art')}<div class="role-body">
          <div class="head"><span>${esc(d.name)}</span><small class="t-${d.team}">${TEAM[d.team]}</small></div>
          <p>${esc(d.desc)}</p>${ctrl}</div></div>`;
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

  // Une nuit : decks prêts selon le nombre de joueurs, ou composition libre.
  function compoONHTML(n) {
    const host = view.me.isHost, compo = view.compo;
    const size = Object.values(compo).reduce((a, b) => a + b, 0);
    const same = (c) => Object.keys(c).length === Object.keys(compo).length && Object.entries(c).every(([k, v]) => compo[k] === v);
    const presets = (view.presets || []).map((p) => `<button class="preset ${same(p.compo) ? 'on' : ''}" data-act="preset" data-i="${p.id}" ${host ? '' : 'disabled'}>
        <b>${esc(p.name)}</b><small>${Object.entries(p.compo).map(([k, v]) => `${v > 1 ? v + ' ' : ''}${esc(roleName(k))}`).join(' · ')}</small></button>`).join('');
    const counts = { loups: 0, village: 0, solitaire: 0, variable: 0 };
    for (const [r, k] of Object.entries(compo)) counts[teamOf(r)] = (counts[teamOf(r)] || 0) + k;
    const roles = Object.entries(ROLES).filter(([, d]) => d.game === 'onenight').map(([key, d]) => {
      const k = compo[key] || 0;
      const ctrl = host ? `<div class="stepper"><button data-act="compo" data-role="${key}" data-delta="-1" aria-label="Retirer ${esc(d.name)}">−</button><span>${k}</span><button data-act="compo" data-role="${key}" data-delta="1" aria-label="Ajouter ${esc(d.name)}">+</button></div>` : `<div class="stepper"><span>${k}</span></div>`;
      return `<div class="role ${k ? 'on' : ''}">${cardImg(key, 'role-art')}<div class="role-body"><div class="head"><span>${esc(d.name)}</span><small class="t-${d.team}">${TEAM[d.team]}</small></div><p>${esc(d.desc)}</p>${ctrl}</div></div>`;
    }).join('');
    return `<div class="row"><strong>${size} cartes · ${n} joueurs + 3 au centre</strong>
        <span class="pill t-loups">${counts.loups} Loups</span><span class="pill t-village">${counts.village} Village</span>
        ${counts.solitaire + counts.variable ? `<span class="pill t-solitaire">${counts.solitaire + counts.variable} Autre</span>` : ''}</div>
      ${presets ? `<div class="label">Decks prêts pour ${Math.min(10, Math.max(3, n))} joueurs</div><div class="presets">${presets}</div>` : ''}
      <div class="label">Composition libre</div><div class="roles">${roles}</div>`;
  }

  // ----- Jeu (option A : on choisit directement sur les visages) -----
  const VERB = {
    voyante: 'Sonder', salvateur: 'Protéger', loups: 'Dévorer', vote: 'Voter contre', captain_vote: 'Élire', hunter: 'Tirer sur', successor: 'Nommer',
    sorciere: 'Empoisonner', enfant: 'Prendre pour modèle', renard: 'Flairer', grandloup: 'Dévorer aussi', loupblanc: 'Tuer', flute: 'Charmer',
    n_double: 'Copier', n_voyante: 'Regarder', n_voleur: 'Voler', n_noiseuse: 'Échanger'
  };
  const QUESTION = {
    voyante: 'Qui veux-tu sonder ?', salvateur: 'Qui protéger cette nuit ?', loups: 'Qui dévorer ?', vote: 'Qui veux-tu éliminer ?',
    captain_vote: 'Qui élire Capitaine ?', hunter: 'Qui emporter avec toi ?', successor: 'Qui sera le nouveau Capitaine ?',
    cupidon: 'Désigne deux amoureux', sorciere: 'Sauver, empoisonner ?', roles_reveal: 'Ton rôle', compoVote: 'Quels rôles veux-tu ?', debate: 'Débat',
    voleur: 'Échanger ta carte ?', soeurs: 'Concertez-vous', amoureux: 'Vous êtes amoureux', enfant: 'Qui sera ton modèle ?', renard: 'Qui flairer ?', infect: 'Infecter la victime ?',
    grandloup: 'Une autre victime ?', loupblanc: 'Tuer un loup ?', flute: 'Qui charmer ?',
    n_double: 'Qui copier ?', n_loups: 'Les loups', n_sbire: 'Voici les loups', n_macons: 'Les Francs-Maçons', n_voyante: 'Que regarder ?',
    n_voleur: 'Voler une carte ?', n_noiseuse: 'Échanger deux cartes ?', n_soulard: 'Prends une carte du centre', n_insomniaque: 'Ta carte'
  };
  const TWO = ['cupidon', 'flute', 'n_noiseuse'];

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
    const title = r.phase === 'end' ? 'Fin de partie' : r.phase === 'setup' ? 'Préparation' : isON() ? (day ? 'Le jour' : 'La nuit') : day ? `Jour ${Math.max(1, r.day)}` : `Nuit ${r.night}`;
    const steps = r.phase === 'end' ? '' : `<ol class="steps" aria-label="Déroulé de la phase">${r.phaseSteps.map((s) =>
      `<li class="${s.state}">${esc(STEP_LABEL[s.type] || s.type)}${s.state === 'done' ? ' ✓' : ''}</li>`).join('')}</ol>`;
    const timer = st && !st.resolved && st.deadline ? `<span class="timer" data-deadline="${st.deadline}">${fmt(st.deadline - Date.now() - offset)}</span>` : '';
    const spect = document.body.dataset.dead === '1' ? `<span class="pill spect-pill">${icon('ear', 14)} Spectateur</span>` : '';
    const head = `<header class="band"><div class="in">
        <span class="ph-title">${title}</span>${steps}${spect}<span class="grow"></span>${timer}
        ${helpButton()}${settingsButton()}
        ${me.isHost && r.phase !== 'end' ? `<button class="stop leave" data-act="abort" aria-label="Arrêter la partie">${icon('stop', 14)}<span class="lbl">Arrêter</span></button>` : ''}</div>
</header>`;
    return head + `<main class="stage">${promptHTML()}${centerHTML()}${gridHTML()}${cemeteryHTML()}</main>${dockHTML()}${drawerHTML()}${helpHTML()}${revealHTML() || changeHTML()}`;
  }

  function settingsButton() {
    return `<button class="appear" data-act="drawer" data-kind="settings" aria-label="Paramètres" title="Paramètres">${icon('gear', 18)}</button>`;
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
    const mine = d ? `<section class="help-mine">${cardImg(me.role, 'help-art')}<div class="hm-text"><p class="hint">Ta carte</p><div class="bigrole t-${d.team}">${esc(d.name)}</div>
        <p class="muted small">${goal[d.team] || ''}</p><ul class="how">${(d.how || [d.desc]).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        ${me.infected || me.wild ? '<div class="note">Tu es devenu loup : tu te réveilles aussi avec la meute.</div>' : ''}</div></section>` : '';
    const inGame = Object.keys(view.compo || {}).filter((k) => ROLES[k] && k !== me.role);
    const cards = inGame.length ? `<section><h3>${view.room.phase === 'lobby' ? 'Cartes prévues' : 'Cartes de la partie'}</h3>${inGame.map((k) => `
        <details class="card-help"><summary><span class="ch-name">${cardImg(k, 'thumb')}${esc(ROLES[k].name)}</span><small class="t-${ROLES[k].team}">${TEAM[ROLES[k].team]}</small></summary>
        <ul class="how">${(ROLES[k].how || [ROLES[k].desc]).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}</section>` : '';
    return `<aside class="drawer sheet open ${helpAnim ? 'slide' : ''}" role="dialog" aria-modal="true" aria-label="Comment jouer">
      <div class="drawer-head"><h2>Comment jouer</h2><button class="round" data-act="help" aria-label="Fermer">${icon('x', 18)}</button></div>
      ${mine}<section><h3>Déroulé · ${esc((GAMES[view.room.game] || GAMES.thiercelieux).short)}</h3><ol class="how rules">${(RULES_BY_GAME[view.room.game] || RULES).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>${cards}</aside>
      <div class="scrim" data-act="help"></div>`;
  }

  // Début de partie : la carte apparaît en grand, avec comment la jouer ; « J'ai vu mon rôle » la referme.
  let revealSeen = null;
  function revealHTML() {
    const st = view.step, me = view.me;
    if (!st || st.type !== 'roles_reveal' || st.resolved || !st.isActor || st.submitted || !me.role) return '';
    const d = ROLES[me.role] || {};
    const first = revealSeen !== stepKey(st);
    revealSeen = stepKey(st);
    const camp = { loups: 'Camp des loups', village: 'Camp du village', solitaire: 'Tu joues seul', variable: 'Ton camp dépendra du rôle copié' }[d.team] || '';
    return `<div class="reveal-scrim ${first ? 'anim' : ''}"></div>
      <div class="reveal ${first ? 'anim' : ''} t-bg-${d.team}" role="dialog" aria-modal="true" aria-labelledby="rv-title">
        <div class="rv-card ${first ? 'flip' : ''}">${cardImg(null, 'rv-back')}${cardImg(me.role, 'rv-face', 'Carte : ' + (d.name || ''))}</div>
        <div class="rv-text"><p class="hint">${isON() ? 'Ta carte' : 'Ton rôle'}</p>
        <h1 id="rv-title" class="bigrole t-${d.team}">${esc(d.name || '')}</h1>
        <p class="rv-camp">${camp}</p>
        <ul class="how">${(d.how || [d.desc]).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        ${me.role === 'sorciere' ? `<div class="rv-potions"><span>${potionImg('vie')} Vie ×1</span><span>${potionImg('mort')} Mort ×1</span></div>` : ''}
        <button class="primary rv-ok" data-act="ready" autofocus>J'ai vu mon rôle</button></div>
      </div>`;
  }

  const potionImg = (k, cls = '') => `<img class="potion-img ${cls}" src="/img/potion-${k}.svg" alt="" draggable="false">`;

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
    if (r.phase === 'end') {
      if (!isON()) return `<div class="prompt"><h1>${esc(r.winner ? r.winner.text : 'Fin de partie')}</h1></div>`;
      const lv = view.lastVote;
      const votes = lv ? `<div class="votes">${lv.choices.map((c) => `<span class="vote-card">${nm(c.voter)} → <b>${c.target ? nm(c.target) : 'personne'}</b></span>`).join('')}</div>` : '';
      const log = view.nightLog && view.nightLog.length ? `<details class="night-log"><summary>Ce qui s'est passé cette nuit</summary><ol>${view.nightLog.map((l) => `<li>${esc(l)}</li>`).join('')}</ol></details>` : '';
      return `<div class="prompt"><p class="hint">${me.won ? 'Tu as gagné !' : 'Tu as perdu'} · ta carte finale : <span class="t-${teamOf(me.finalRole)}">${esc(roleName(me.finalRole))}</span></p>
        <h1>${esc(r.winner ? r.winner.text : 'Fin de partie')}</h1>${votes}${log}</div>`;
    }
    if (!st) return '';
    if (st.resolved && !st.result && !st.isActor && !DAY_STEPS.includes(st.type) && !['roles_reveal', 'compoVote'].includes(st.type) && r.phase !== 'day') {
      return `<div class="prompt muted-prompt"><h1>${me.alive || me.isMJ ? 'Le village dort…' : 'Tu ne joues plus'}</h1></div>`;
    }
    if (st.resolved) {
      const next = r.waitingMJ ? (me.canControl ? '' : '<p class="hint">En attente du MJ…</p>') : st.nextAt ? `<p class="hint">Suite dans <span data-deadline="${st.nextAt}"></span></p>` : '';
      return `<div class="prompt result">${resultHTML(st)}${next}</div>`;
    }
    const night = !DAY_STEPS.includes(st.type) && !['roles_reveal', 'compoVote'].includes(st.type);
    if (!st.isActor) {
      let t = night ? 'Le village dort…' : 'Patiente';
      if (me.isMJ) t = `En attente : ${st.actors.filter((a) => !st.done.includes(a)).map(nm).join(', ') || '—'}`;
      else if (!me.alive) t = 'Tu ne joues plus';
      return `<div class="prompt muted-prompt"><h1>${t}</h1>${progressHTML(st, night ? 'ont agi' : 'ont voté')}${isON() ? onNotesHTML() : ''}</div>`;
    }
    const mode = pickMode(st);
    let hint = mode ? (mode.max === 2 ? 'Touche deux joueurs' : 'Touche un joueur') : '';
    let extra = '';
    let title = null;
    if (isON() && st.type !== 'vote' && st.type !== 'roles_reveal') {
      const info = onPromptExtra(st);
      if (st.type === 'n_voyante') hint = 'Touche un joueur, ou deux cartes du centre';
      if (st.type === 'n_soulard') hint = 'Touche une carte du centre : elle devient la tienne, sans la voir';
      if (st.type === 'n_loups' && st.lone) hint = 'Touche une carte du centre, ou passe';
      if (st.type === 'n_insomniaque' || st.type === 'n_sbire' || st.type === 'n_macons' || (st.type === 'n_loups' && !st.lone)) hint = '';
      if (st.doppel) hint = `Double · ${hint}`;
      const body = st.submitted && !st.result ? '<p class="hint">C\'est fait. Garde les yeux fermés…</p>' : '';
      return `<div class="prompt"><div class="prompt-row"><div><h1>${QUESTION[st.type] || 'À toi'}</h1>${hint && !st.submitted ? `<p class="hint">${hint}</p>` : ''}</div></div>
        ${info ? `<p class="desc">${info}</p>` : ''}${onResultHTML(st)}${body}</div>`;
    }
    switch (st.type) {
      case 'roles_reveal': {
        const d = ROLES[me.role] || {};
        if (!st.submitted) return `<div class="prompt"><h1>Découvre ton rôle</h1>${progressHTML(st, 'prêts')}</div>`;
        return `<div class="prompt"><h1>En attente des autres…</h1><p class="hint">Ton rôle : <strong class="t-${d.team}">${esc(d.name || '')}</strong></p>${progressHTML(st, 'prêts')}</div>`;
      }
      case 'compoVote': {
        const opts = Object.entries(ROLES).filter(([k, d]) => d.impl && k !== 'loup' && k !== 'villageois' && (d.ext === 'base' || r.settings.extensions[d.ext]));
        const cur = ui.cv || (Array.isArray(st.myInput) ? st.myInput : []);
        extra = `<div class="checks">${opts.map(([k, d]) => `<label class="check"><input type="checkbox" data-act="cv" data-role="${k}" ${cur.includes(k) ? 'checked' : ''}> ${esc(d.name)}</label>`).join('')}</div>`;
        break;
      }
      case 'sorciere': {
        title = st.victim ? `Les loups ont choisi ${nm(st.victim)}` : 'Nuit calme';
        hint = st.victim ? (st.potions.life ? 'Sauve-le avec ta potion de vie, empoisonne quelqu\'un, ou passe.' : 'Ta potion de vie est déjà utilisée.') : 'Les loups n\'ont tué personne cette nuit.';
        const victimName = st.victim ? nm(st.victim) : null;
        const dawn = [];
        if (st.victim) dawn.push(ui.save ? `<li class="ok">${victimName} survit</li>` : `<li class="bad">${victimName} meurt</li>`);
        if (ui.kill) dawn.push(`<li class="poison">${nm(ui.kill)} meurt empoisonné(e)</li>`);
        if (!dawn.length) dawn.push('<li>Personne ne meurt</li>');
        extra = `<div class="shelf">
          <div class="potion-slot life ${st.potions.life ? '' : 'used'} ${ui.save ? 'on' : ''}">${potionImg('vie')}<span><b>Potion de vie</b><small>${!st.potions.life ? 'Déjà utilisée' : ui.save ? 'Sur ' + victimName : st.victim ? 'Sur la vignette en danger' : 'Personne à sauver'}</small></span></div>
          <div class="potion-slot death ${st.potions.death ? '' : 'used'} ${ui.kill ? 'on' : ''}">${potionImg('mort')}<span><b>Potion de mort</b><small>${!st.potions.death ? 'Déjà utilisée' : ui.kill ? 'Sur ' + nm(ui.kill) : 'Bouton « Poison » sur un joueur'}</small></span></div>
          <div class="dawn"><small>À l'aube</small><ul>${dawn.join('')}</ul></div></div>`;
        break;
      }
      case 'voleur': {
        hint = st.mustTake ? 'Deux loups : prends-en un' : 'Prends une carte ou garde la tienne';
        hint += ' · touche une carte du centre';
        break;
      }
      case 'amoureux':
        hint = st.partner ? `${icon('heart', 14, '#F08A6C')} Ton amour : ${nm(st.partner)} · parlez-vous, vous seuls vous entendez` : '';
        break;
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
      case 'loups': {
        const live = st.live || [];
        const n = live.length;
        hint = n > 1 ? 'Touchez la même victime : dès que toute la meute est d\'accord, c\'est décidé.' : 'Touche ta victime.';
        if (st.agreed) hint = `La meute est d'accord : ${(nm(st.agreed))}.`;
        extra = rankHTML(live);
        break;
      }
      case 'vote': case 'captain_vote':
        extra = progressHTML(st, 'ont voté') + (isON() ? onNotesHTML() : '');
        if (st.type === 'vote') hint = isON() ? 'Débattez, puis touche un joueur · éliminé dès 2 voix' : 'Débattez, puis touche un joueur · le vote se clôt quand tout le monde a voté';
        if (st.type === 'vote' && r.captainId) hint += ` · ${nm(r.captainId)} compte double`;
        break;
    }
    return `<div class="prompt ${st.type === 'sorciere' ? 'witch-prompt' : ''}"><div class="prompt-row"><div><h1>${title ? esc(title) : QUESTION[st.type] || 'À toi'}</h1>${hint ? `<p class="hint">${hint}</p>` : ''}</div></div>${extra}</div>`;
  }

  // Cartes au centre, matérialisées : face cachée, retournées quand on les connaît (et toutes à la fin).
  function centerPickable(st) {
    if (!st || st.resolved || !st.isActor || st.submitted) return 0;
    if (st.type === 'voleur') return 1;
    return st.centerPick || 0;
  }
  function centerHTML() {
    const c = view.center;
    if (!c || !c.cards || !c.cards.length) return '';
    if (isON()) return '';
    const stv = view.step;
    if (stv && stv.type === 'voleur' && stv.isActor && !stv.resolved) return '';
    if (c.cards.every(Boolean)) return `<div class="center-pill" title="Les cartes restées au centre"><span class="cp-k">${icon('cards', 14)} Au centre</span>${c.cards.map((r) => `<span class="cp-card">${cardImg(r, 'thumb')}${esc(roleName(r))}</span>`).join('')}</div>`;
    const st = view.step;
    const can = centerPickable(st);
    const voleur = st && st.type === 'voleur' && can;
    const sel = voleur ? ui.sel : ui.csel.map(String);
    const res = st && st.result && st.result.center ? st.result.center : [];
    const cards = c.cards.map((role, i) => {
      const on = sel.includes(String(i));
      const touched = res.some((x) => x.i === i);
      const face = cardImg(role, 'cc-art');
      const label = role ? roleName(role) : `Carte ${i + 1}, face cachée`;
      const cls = `ccard ${role ? 'up' : 'down'} ${on ? 'on' : ''} ${touched ? 'touched' : ''} ${can ? 'pickable' : ''}`;
      return can ? `<button class="${cls}" data-act="${voleur ? 'take' : 'pickc'}" data-i="${i}" aria-pressed="${on}" aria-label="${esc(label)}">${face}<span class="cnum">${i + 1}</span></button>`
        : `<div class="${cls}" aria-label="${esc(label)}">${face}<span class="cnum">${i + 1}</span></div>`;
    }).join('');
    return `<div class="center-row ${can ? 'picking' : ''}"><span class="center-title">${icon('cards', 16)} ${esc(c.label || 'Au centre')}</span><div class="ccards">${cards}</div></div>`;
  }

  // Une nuit : ce que voit le joueur réveillé (coéquipiers, résultat de son action).
  function onPromptExtra(st) {
    const me = view.me;
    const r = st.result;
    const list = (ids) => ids.length ? ids.map(nm).join(', ') : 'personne';
    switch (st.type) {
      case 'n_loups': return st.mates && st.mates.length ? `Ta meute : <strong>${list(st.mates)}</strong>` : 'Tu es le seul loup : tu peux regarder une carte du centre.';
      case 'n_sbire': return st.wolves && st.wolves.length ? `Les loups : <strong>${list(st.wolves)}</strong>` : "Aucun loup parmi les joueurs.";
      case 'n_macons': return st.mates && st.mates.length ? `L'autre Franc-Maçon : <strong>${list(st.mates)}</strong>` : "Tu es seul : l'autre carte est au centre.";
      default: return '';
    }
  }
  function onResultHTML(st) { return onNoteHTML(st.result); }
  // Rappel de ce que le joueur a appris cette nuit (reste affiché jusqu'au vote).
  function onNotesHTML() {
    const n = (view.me.notes || []).map(onNoteHTML).filter(Boolean);
    return n.length ? `<div class="notes"><p class="hint">Ce que tu as vu cette nuit</p>${n.join('')}</div>` : '';
  }
  function onNoteHTML(r) {
    if (!r) return '';
    const card = (role) => `<span class="t-${teamOf(role)}">${esc(roleName(role))}</span>`;
    const parts = [];
    if (r.copied) parts.push(`Tu deviens ${card(r.copied)}`);
    else if (r.players) parts.push(...r.players.map((x) => `${nm(x.id)} est ${card(x.role)}`));
    if (r.center) parts.push(...r.center.filter((x) => x.role).map((x) => `Carte ${x.i + 1} : ${card(x.role)}`));
    if (r.center && r.center.some((x) => !x.role)) parts.push('Carte échangée, sans la regarder');
    if (r.took) parts.push(`Ta nouvelle carte : ${card(r.took)}`);
    if (r.swapped) parts.push(`${nm(r.swapped[0])} et ${nm(r.swapped[1])} ont échangé leurs cartes`);
    if (r.self) parts.push(`Ta carte est maintenant : ${card(r.self)}`);
    return parts.length ? `<div class="secret">${icon('lock', 14)} ${parts.join(' · ')}</div>` : '';
  }

  function gridHTML() {
    const st = view.step, me = view.me, r = view.room;
    const mode = pickMode(st);
    const sel = picked(st);
    const tally = st && st.resolved && st.result && st.result.tally ? st.result.tally : null;
    // Votes révélés : sur chaque vignette, ceux qui ont voté contre ce joueur et la cible de son propre vote.
    const voteTo = {}, voteFrom = {};
    if (tally && st.result.choices) for (const c of st.result.choices) { voteTo[c.voter] = c.target || null; if (c.target) (voteFrom[c.target] = voteFrom[c.target] || []).push(c.voter); }
    const wolfLive = st && st.type === 'loups' && !st.resolved && Array.isArray(st.live) ? st.live : null;
    if (wolfLive) for (const c of wolfLive) { if (c.target) { voteTo[c.voter] = c.target; (voteFrom[c.target] = voteFrom[c.target] || []).push(c.voter); } }
    const mj = view.players.find((p) => p.isMJ && p.id !== me.id);
    const alive = view.players.filter((p) => !p.isMJ && (p.alive || (isON() && r.phase === 'end') || (tally && voteFrom[p.id] && st.type === 'vote')));
    const night = r.phase === 'night' && !isDayCtx();
    const witch = st && st.type === 'sorciere' && st.isActor && !st.resolved && !st.submitted;
    const build = (p) => {
      const can = mode && mode.ids.includes(p.id);
      const o = {
        pick: can, picked: sel.includes(p.id), votes: tally ? tally[p.id] || 0 : null,
        voteFrom: tally || wolfLive ? voteFrom[p.id] || [] : null, voteTo: (tally || wolfLive) && p.id in voteTo ? voteTo[p.id] : undefined,
        votesLive: wolfLive ? (voteFrom[p.id] || []).length : null,
        out: tally && st.type === 'vote' && !p.alive ? 'Éliminé' : null,
        topVoted: (tally && (tally[p.id] || 0) > 0 && (tally[p.id] || 0) === Math.max(...Object.values(tally))) || (wolfLive && st.agreed === p.id),
        wolfMate: night && me.isWolf && me.wolves.includes(p.id) && p.id !== me.id, noKick: true
      };
      if (witch) Object.assign(o, witchTile(st, p));
      return tileHTML(p, o);
    };
    const list = (mj ? [mj] : []).concat(alive);
    const gridCls = `stage-grid ${mode ? 'picking' : ''} ${sel.length ? 'has-pick' : ''}`;
    // Une nuit : les cartes du centre au milieu de la table.
    const table = isON() && view.center && view.center.cards && view.center.cards.length ? tableCenterHTML() : '';
    // Nuit (Thiercelieux) : le rôle réveillé et son équipe au-dessus du village.
    const nightStep = st && !st.resolved && r.phase === 'night' && !isON() && !DAY_STEPS.includes(st.type) && st.type !== 'sorciere';
    if (nightStep && st.isActor) {
      const team = teamOf2(st).filter((id) => list.some((p) => p.id === id));
      const teamTiles = team.map((id) => build(P(id))).join('');
      const rest = list.filter((p) => !team.includes(p.id));
      return `${activePanelHTML(st, team, teamTiles)}
        <div class="village-label"><b>Le village</b><span>${st.type === 'loups' && team.length > 1 ? 'Touchez la même victime : dès que toute la meute est d\'accord, c\'est décidé.' : pickMode(st) ? 'Touche un joueur' : 'Il dort'}</span></div>
        <div class="${gridCls}">${rest.map(build).join('')}</div>`;
    }
    if (nightStep && !st.isActor && me.alive && !me.isMJ && !me.seesAll) {
      return `${sleeperPanelHTML(st)}<div class="village-label"><b>Le village dort</b></div><div class="${gridCls}">${list.map(build).join('')}</div>`;
    }
    return `<div class="${gridCls}">${list.map(build).join('')}${table}</div>`;
  }

  // Qui est réveillé avec moi : la meute, les sœurs, l'amour (sinon je suis seul).
  function teamOf2(st) {
    const me = view.me;
    if (st.type === 'loups') return [me.id].concat((me.wolves || []).filter((w) => w !== me.id && P(w) && P(w).alive));
    if (st.type === 'soeurs') return [me.id].concat(view.players.filter((p) => p.role === 'soeur' && p.id !== me.id && p.alive).map((p) => p.id));
    if (st.type === 'amoureux' && st.partner) return [me.id, st.partner];
    return [me.id];
  }

  // Encadré du rôle réveillé : mon équipe, ou moi seul avec ce que je sais déjà.
  function activePanelHTML(st, team, teamTiles) {
    const n = team.length;
    const pf = (view.compo || {}).petitefille > 0;
    let title, sub, kind = 'solo', aside = '';
    if (st.type === 'loups') {
      kind = 'wolf';
      title = n > 1 ? `Ta meute · ${n} loups` : 'Tu chasses seul';
      sub = n > 1 ? `Vous vous voyez et vous entendez.${pf ? ' Attention à la petite fille…' : ''}` : (pf ? 'Attention à la petite fille…' : 'Personne d\'autre n\'est réveillé.');
    } else if (st.type === 'soeurs') { kind = 'pair'; title = n > 1 ? 'Tes sœurs' : 'Tu es seule'; sub = n > 1 ? 'Vous seules vous voyez et vous entendez.' : 'Ta sœur n\'est plus là.'; }
    else if (st.type === 'amoureux') { kind = 'love'; title = 'Ton amour'; sub = 'Vous seuls vous voyez et vous entendez.'; }
    else { title = 'Ton tour'; sub = 'Seul(e) réveillé(e)'; aside = knowAsideHTML(st); }
    return `<section class="active-panel ${kind}" aria-label="${esc(title)}">
      <div class="ap-head"><span class="ap-icon">${icon(STEP_ICON[st.type] || 'moon', 18)}</span><span><b>${esc(title)}</b><small>${esc(sub)}</small></span></div>
      <div class="ap-body"><div class="team-grid" style="--n:${n}">${teamTiles}</div>${aside}</div></section>`;
  }

  // À côté de ma vignette : ce que je sais déjà (visions, charmés, flair…), ou les cartes du Voleur.
  function knowAsideHTML(st) {
    const me = view.me;
    if (st.type === 'voleur' && Array.isArray(st.cards) && st.cards.length) {
      const i = ui.sel[0];
      const cards = st.cards.map((role, k) => `<button class="ccard up pickable ${String(i) === String(k) ? 'on' : ''}" data-act="take" data-i="${k}" aria-pressed="${String(i) === String(k)}" aria-label="${esc(roleName(role))}">${cardImg(role, 'cc-art')}<span class="cnum">${k + 1}</span></button>`).join('');
      return `<div class="ap-aside thief"><div class="ccards">${cards}</div><span class="ap-note"><b>Les ${st.cards.length} cartes restées au centre</b><span>Toi seul les vois. Prends-en une : ta carte de Voleur la remplace au centre. Ou garde ta carte.</span></span></div>`;
    }
    const items = [];
    if (me.role === 'voyante' && me.seen && me.seen.length) {
      for (const sv of me.seen) items.push(`${face(sv.id, 26)}<b>${esc(sv.name)}</b><span class="dim">est</span>${cardImg(sv.role, 'thumb')}<b class="t-${teamOf(sv.role)}">${esc(roleName(sv.role))}</b>`);
    }
    if (me.role === 'flute') {
      const c = view.players.filter((p) => p.charmed && p.alive);
      const left = view.players.filter((p) => p.alive && !p.charmed && p.id !== me.id && !p.isMJ).length;
      items.push(c.length ? `<span class="faces">${c.map((p) => face(p.id, 24)).join('')}</span><b>${c.length} charmé${c.length > 1 ? 's' : ''}</b>` : '<b>Personne n\'est encore charmé</b>');
      items.push(`<b class="t-solitaire">Encore ${left}</b><span class="dim">à charmer pour gagner</span>`);
    }
    if (me.role === 'renard' && me.foxNotes && me.foxNotes.length) {
      for (const n of me.foxNotes) items.push(`<span class="faces">${n.ids.map((x) => face(x, 22)).join('')}</span><b class="${n.hasWolf ? 't-loups' : 't-village'}">${n.hasWolf ? 'Un loup parmi eux' : 'Aucun loup'}</b><span class="dim">· nuit ${n.night}</span>`);
    }
    if (me.role === 'salvateur' && st.lastProtected) items.push(`${face(st.lastProtected, 24)}<b>${nm(st.lastProtected)}</b><span class="dim">protégé(e) la nuit dernière : pas ce soir</span>`);
    if (me.role === 'enfant' && me.model) items.push(`${face(me.model, 24)}<b>${nm(me.model)}</b><span class="dim">est ton modèle</span>`);
    if (!items.length) return '';
    const title = { voyante: 'Tes visions', flute: 'Tes charmes', renard: 'Ton flair' }[me.role] || 'Ce que tu sais';
    return `<div class="ap-aside know"><span class="ap-kicker">${title}</span><div class="know-list">${items.map((x) => `<span class="know">${x}</span>`).join('')}</div></div>`;
  }

  // Ceux qui dorment : qui est réveillé (sans dire combien) et ce que je sais.
  function sleeperPanelHTML(st) {
    const me = view.me;
    const mine = [];
    if (me.lover) mine.push(`${icon('heart', 14, '#F7A2AE')}<b>Amoureux(se) de ${nm(me.lover)}</b>`);
    if (me.role === 'enfant' && me.model && !me.wild) mine.push(`${face(me.model, 22)}<b>Ton modèle : ${nm(me.model)}</b>`);
    if (me.charmed) mine.push(`${icon('music', 14)}<b>Tu es charmé(e)</b>`);
    const know = mine.length ? `<div class="ap-aside know small"><span class="ap-kicker">Ce que tu sais</span><div class="know-list">${mine.map((x) => `<span class="know">${x}</span>`).join('')}</div></div>` : '';
    return `<section class="active-panel sleep" aria-label="Réveillés en ce moment"><div class="ap-body">
      <img class="sleep-card" src="/img/carte-dos.svg" alt="">
      <span class="ap-note"><b>${esc(st.narration || 'Le village dort')}</b><span>Tu ne vois ni n'entends personne. Garde les yeux fermés jusqu'à ton tour ou jusqu'à l'aube.</span></span>${know}</div></section>`;
  }

  // Une nuit : les cartes posées au milieu de la table (placées par layoutGrid).
  function tableCenterHTML() {
    const c = view.center, st = view.step;
    const can = centerPickable(st);
    const sel = ui.csel.map(String);
    const res = st && st.result && st.result.center ? st.result.center : [];
    const cards = c.cards.map((role, i) => {
      const on = sel.includes(String(i));
      const touched = res.some((x) => x.i === i);
      const label = role ? roleName(role) : `Carte ${i + 1}, face cachée`;
      const cls = `ccard ${role ? 'up' : 'down'} ${on ? 'on' : ''} ${touched ? 'touched' : ''} ${can ? 'pickable' : ''}`;
      return can ? `<button class="${cls}" data-act="pickc" data-i="${i}" aria-pressed="${on}" aria-label="${esc(label)}">${cardImg(role, 'cc-art')}<span class="cnum">${i + 1}</span></button>`
        : `<div class="${cls}" aria-label="${esc(label)}">${cardImg(role, 'cc-art')}<span class="cnum">${i + 1}</span></div>`;
    }).join('');
    return `<div class="table-center ${can ? 'picking' : ''}"><span class="center-title">${icon('cards', 15)} ${esc(c.label || 'Au centre')}</span><div class="ccards">${cards}</div></div>`;
  }

  // Sorcière : potion de vie sur la carte du joueur en danger, poison sur les autres.
  function witchTile(st, p) {
    const me = view.me;
    if (p.isMJ) return {};
    if (p.id === st.victim) {
      const tools = st.potions.life ? `<div class="tile-tools big-tools"><button class="potion life ${ui.save ? 'on' : ''}" data-act="save" aria-pressed="${ui.save}" aria-label="${ui.save ? 'Annuler la potion de vie' : 'Sauver ' + esc(p.name)}">${potionImg('vie')} ${ui.save ? 'Sauvé' : 'Sauver'}</button></div>` : '';
      return { danger: true, big: true, tools, saved: ui.save };
    }
    if (!st.potions.death || p.id === me.id) return {};
    const on = ui.kill === p.id;
    return {
      tools: `<div class="tile-tools"><button class="potion death ${on ? 'on' : ''}" data-act="kill" data-id="${p.id}" aria-pressed="${on}" aria-label="${on ? 'Retirer le poison de ' : 'Empoisonner '}${esc(p.name)}">${potionImg('mort')} ${on ? 'Empoisonné' : 'Poison'}</button></div>`,
      poisoned: on
    };
  }

  function cemeteryHTML() {
    if (isON()) return '';
    const dead = view.players.filter((p) => !p.isMJ && !p.alive);
    if (!dead.length) return '';
    const causes = { loups: 'mort(e)', sorciere: 'mort(e)', loupblanc: 'mort(e)', rouille: 'mort(e)', vote: 'éliminé(e)', bouc: 'sacrifié(e)', chasseur: 'abattu(e)', chagrin: 'chagrin', exclu: 'exclu(e)' };
    return `<div class="cemetery-row"><span class="cem-title">${icon('grave', 16)} Cimetière</span>${dead.map((p) => {
      const d = p.death || {};
      const isMe = p.id === view.me.id;
      const info = [p.role ? roleName(p.role) : null, d.when ? d.when.toLowerCase() : causes[d.cause]].filter(Boolean).join(' · ');
      return `<span class="dchip has-video-host ${isMe ? 'me' : ''} ${freshDead.has(p.id) ? 'fresh' : ''}" data-speak="${p.id}">
        <span class="dav"><span class="avatar" aria-hidden="true">${esc(p.name[0])}</span><span class="vslot" data-vslot="${isMe ? 'me2' : p.id}"></span></span>
        ${p.role ? cardImg(p.role, 'dead-art') : ''}<span class="dtext"><span class="dname">${esc(p.name)}${isMe ? ' (toi)' : ''}</span><span class="dinfo">${esc(info)}</span></span></span>`;
    }).join('')}</div>`;
  }

  // Barre du bas : moi, micro, caméra, l'action principale, le journal.
  function dockHTML() {
    const st = view.step, me = view.me, r = view.room;
    const d = me.role ? ROLES[me.role] : null;
    const L = Media.local;
    const roleBtn = me.isMJ ? '<span class="dock-role"><small>Rôle</small><b>Maître du jeu</b></span>'
      : d && roleChange() ? (() => { const c = roleChange(), t = ROLES[c.to]; return `<button class="dock-role changed" data-act="help" aria-label="Ton rôle : ${esc(t.name)}, ${esc(roleName(c.from))} au départ">${cardImg(c.from, 'dock-art was')}<span class="dock-arrow" aria-hidden="true">→</span>${cardImg(c.to, 'dock-art')}<span class="dr-t"><small>${esc(roleName(c.from))} →</small><b class="t-${t.team}">${esc(t.name)}<span class="qmark" aria-hidden="true">?</span></b></span></button>`; })()
      : d ? `<button class="dock-role" data-act="help" aria-label="Comment jouer ${esc(d.name)} ?">${cardImg(me.role, 'dock-art')}<span class="dr-t"><small>${isON() ? (r.phase === 'end' ? 'Au départ' : 'Ta carte au départ') : me.alive || r.phase === 'end' ? 'Ton rôle' : 'Tu étais'}</small><b class="t-${d.team}">${esc(d.name)}<span class="qmark" aria-hidden="true">?</span></b></span></button>` : '';
    const mic = `<button class="round ${L.audioTrack ? (L.mic ? 'on' : 'off') : ''}" data-act="media-mic" aria-pressed="${!!(L.audioTrack && L.mic)}" aria-label="${L.audioTrack && L.mic ? 'Couper le micro' : 'Activer le micro'}" ${L.busy.audio ? 'disabled' : ''}>${icon(L.audioTrack && L.mic ? 'mic' : 'micoff', 20)}</button>`;
    const cam = `<button class="round ${L.cam ? 'on' : ''}" data-act="media-cam" aria-pressed="${L.cam}" aria-label="${L.cam ? 'Couper la caméra' : 'Activer la caméra'}" ${L.busy.video ? 'disabled' : ''}>${icon(L.cam ? 'cam' : 'camoff', 20)}</button>`;
    const self = `<div class="dock-self has-video-host" data-speak="${me.id}"><span class="avatar" style="background:${colorOf(me.id)}" aria-hidden="true">${esc(me.name[0])}</span><div class="vslot" data-vslot="me"></div></div>`;
    const myTurn = st && !st.resolved && st.isActor && !st.submitted;
    return `<nav class="dock ${myTurn ? 'my-turn' : ''}" aria-label="Commandes">${eventBarHTML()}<div class="in">
      <div class="dock-me">${self}${roleBtn}</div>
      <div class="dock-media">${mic}${cam}${ambButton()}</div>
      <div class="dock-actions">${actionButtons()}</div>
      <button class="round" data-act="drawer" data-kind="${r.phase === 'lobby' ? 'roles' : 'journal'}" aria-label="${r.phase === 'lobby' ? (isON() ? 'Deck' : 'Rôles') : 'Mon rôle et journal'}">${icon(r.phase === 'lobby' ? 'cards' : 'scroll', 20)}</button>
    </div>${L.error ? `<div class="dock-error">${esc(L.error)}</div>` : ''}</nav>`;
  }

  // Bandeau d'événement, au-dessus des commandes : orange quand c'est à toi, bleu pour ce qui se passe.
  const STEP_ICON = {
    voyante: 'eye', n_voyante: 'eye', loups: 'wolf', n_loups: 'wolf', grandloup: 'wolf', loupblanc: 'wolf', infect: 'wolf', n_sbire: 'wolf',
    sorciere: 'potion', salvateur: 'shield', cupidon: 'heart', amoureux: 'heart', soeurs: 'person', renard: 'nose', enfant: 'person',
    vote: 'ballot', captain_vote: 'crown', successor: 'crown', hunter: 'target', debate: 'person', dawn: 'sun', voleur: 'cards', n_voleur: 'cards',
    n_noiseuse: 'cards', n_soulard: 'cards', n_double: 'person', n_macons: 'person', n_insomniaque: 'eye', flute: 'music', roles_reveal: 'cards', compoVote: 'cards'
  };
  let evLast = null;
  function eventBarHTML() {
    const st = view.step, me = view.me, r = view.room;
    if (r.phase === 'lobby') return '';
    const day = isDayCtx();
    let kind = 'info', ic = (st && STEP_ICON[st.type]) || (day ? 'sun' : 'moon'), title = '', sub = '', right = '';
    if (r.phase === 'end') {
      kind = 'result'; ic = 'crown';
      title = r.winner ? r.winner.text : 'Fin de partie';
      sub = isON() ? (me.won ? 'Tu as gagné !' : 'Tu as perdu') : 'La partie est terminée';
    } else if (!st) {
      return '';
    } else if (!st.resolved && st.isActor && (!st.submitted || st.type === 'loups') && st.type !== 'roles_reveal') {
      kind = 'mine';
      title = `À toi · ${STEP_LABEL[st.type] || 'ton tour'}`;
      sub = QUESTION[st.type] || 'À toi de jouer';
      if (st.type === 'loups' && st.live) {
        const n = st.live.length, agree = st.agreed ? n : Math.max(0, ...Object.values(st.live.reduce((m, c) => { if (c.target) m[c.target] = (m[c.target] || 0) + 1; return m; }, {})));
        sub = st.agreed ? `La meute est d'accord : ${rawName(st.agreed)}` : n > 1 ? `${agree} / ${n} loups d'accord · touchez la même victime` : 'Touche ta victime';
      }
      if (st.deadline) right = `<span class="ev-time" data-deadline="${st.deadline}">${fmt(st.deadline - Date.now() - offset)}</span>`;
    } else if (st.resolved && st.result && st.result.text) {
      kind = 'result';
      title = st.result.text;
      sub = st.nextAt ? 'La suite arrive…' : r.waitingMJ ? 'En attente du MJ' : '';
      if (st.nextAt) right = `<span class="ev-next">Suite dans <span data-deadline="${st.nextAt}"></span></span>`;
    } else {
      const night = !DAY_STEPS.includes(st.type) && !['roles_reveal', 'compoVote'].includes(st.type);
      title = st.narration || STEP_LABEL[st.type] || '';
      if (st.isActor && st.submitted) sub = 'C\'est fait. En attente des autres…';
      else if (!me.alive && !me.isMJ) sub = 'Tu regardes la partie en spectateur.';
      else if (night && !st.isActor) sub = 'Le village dort. Garde les yeux fermés.';
      else if (st.actorsCount != null) sub = `${st.done.length} / ${st.actorsCount} ${night ? 'ont agi' : st.type === 'roles_reveal' ? 'prêts' : 'ont voté'}`;
      if (st.deadline && !st.resolved) right = `<span class="ev-time" data-deadline="${st.deadline}">${fmt(st.deadline - Date.now() - offset)}</span>`;
    }
    if (!title) return '';
    const key = `${kind}:${title}`;
    const fresh = key !== evLast;
    evLast = key;
    return `<div class="evbar ${kind} ${day ? 'day' : 'night'} ${fresh ? 'fresh' : ''}" role="status" aria-live="polite">
      <span class="ev-icon">${icon(ic, 22)}</span>
      <span class="ev-text"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>${right}</div>`;
  }

  function ambButton() {
    if (!Amb || view.room.phase === 'lobby') return '';
    const on = Amb.prefs.on && Amb.prefs.vol > 0;
    const pop = ambOpen ? `<div class="amb-pop" role="dialog" aria-label="Musique d'ambiance">
        <div class="amb-head"><b>Ambiance</b><button class="ghost small-btn" data-act="amb-mute">${on ? 'Couper' : 'Activer'}</button></div>
        <label class="amb-row">${icon('musicoff', 16)}<input type="range" min="0" max="100" value="${Math.round(Amb.prefs.vol * 100)}" data-act="amb-vol" aria-label="Volume de la musique">${icon('music', 16)}</label>
        <label class="check amb-storm"><input type="checkbox" data-act="amb-storm" ${Amb.prefs.storm ? 'checked' : ''}> Tonnerre (léger et rare)</label>
        ${TEST ? '<button class="ghost small-btn" data-act="amb-thunder">Écouter un tonnerre</button>' : ''}</div>` : '';
    return `<span class="amb-wrap"><button class="round ${on ? '' : 'off'}" data-act="amb" aria-expanded="${ambOpen}" aria-label="Musique d'ambiance">${icon(on ? 'music' : 'musicoff', 20)}</button>${pop}</span>`;
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
      case 'loups': {
        if (st.agreed) return `<span class="sent wolf-ok">${icon('check', 14)} D'accord : ${(nm(st.agreed))}</span>`;
        const mine = st.myInput;
        return `<span class="sent">${mine ? `Ton choix : <b>${(nm(mine))}</b>` : 'Touche une victime'}</span>`;
      }
      case 'infect':
        return `${sent}<button class="ghost" data-act="infect" data-v="0">Dévorer</button><button class="wolf attn" data-act="infect" data-v="1">Infecter ${nm(st.victim)}</button>`;
      case 'soeurs': case 'amoureux':
        return st.submitted ? sent : '<button class="primary attn" data-act="ready">Terminé</button>';
      case 'n_loups': case 'n_sbire': case 'n_macons': case 'n_insomniaque': {
        if (st.submitted) return sent;
        if (st.type === 'n_loups' && st.lone) {
          const i = ui.csel[0];
          return `<button class="ghost" data-act="ready">Passer</button><button class="wolf attn" data-act="submit" ${i != null ? '' : 'disabled'}>${i != null ? `Regarder la carte ${+i + 1}` : 'Touche une carte'}</button>`;
        }
        return '<button class="primary attn" data-act="ready">Vu</button>';
      }
      case 'n_voyante': {
        if (st.submitted) return sent;
        const ok = ui.csel.length === 2 || sel.length === 1;
        const label = ui.csel.length === 2 ? `Regarder les cartes ${ui.csel.map((i) => +i + 1).join(' et ')}` : sel.length ? `Regarder ${nm(sel[0])}` : 'Un joueur ou deux cartes';
        return `<button class="ghost" data-act="abstain">Passer</button><button class="primary attn" data-act="submit" ${ok ? '' : 'disabled'}>${label}</button>`;
      }
      case 'n_soulard': {
        if (st.submitted) return sent;
        const i = ui.csel[0];
        return `<button class="primary attn" data-act="submit" ${i != null ? '' : 'disabled'}>${i != null ? `Prendre la carte ${+i + 1}` : 'Touche une carte du centre'}</button>`;
      }
      case 'n_noiseuse': {
        if (st.submitted) return sent;
        const ok = sel.length === 2;
        return `<button class="ghost" data-act="pass2">Passer</button><button class="primary attn" data-act="submit" ${ok ? '' : 'disabled'}>${ok ? `Échanger ${nm(sel[0])} et ${nm(sel[1])}` : 'Choisis deux joueurs'}</button>`;
      }
      default: {
        const abst = st.type === 'vote' || st.type === 'captain_vote' ? '<button class="ghost" data-act="abstain">S\'abstenir</button>'
          : ['renard', 'loupblanc', 'n_voleur'].includes(st.type) ? '<button class="ghost" data-act="abstain">Passer</button>' : '';
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
      return `<h1>${esc(res.text)}</h1>${rankHTML(res.choices, res.tally)}`;
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
    const kind = drawerKind === 'roles' && !lobby ? 'journal' : drawerKind === 'journal' && lobby ? 'roles' : drawerKind;
    let top = '';
    if (kind === 'roles') {
      const nGame = view.players.filter((p) => !p.isMJ).length;
      top = `${isON() ? '' : extensionsHTML()}<section><h3>${isON() ? 'Deck' : 'Composition'}${me.isHost ? '' : ' · choisie par l\'hôte'}</h3>${compoHTML(nGame)}</section>`;
    } else if (kind === 'journal' && me.role && !me.isMJ) {
      const d = ROLES[me.role];
      const extra = [];
      if (me.knownSelf && me.knownSelf !== me.role) extra.push(`Ta carte a changé : tu es maintenant <strong class="t-${teamOf(me.knownSelf)}">${esc(roleName(me.knownSelf))}</strong>.`);
      if (isON() && r.phase !== 'end') extra.push('Attention : ta carte a pu être échangée pendant la nuit sans que tu le saches.');
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
    const manage = kind === 'settings' && (me.isHost || me.isMJ) && r.phase !== 'end';
    const players = manage ? `<section><h3>Joueurs</h3>${view.players.filter((p) => p.id !== me.id && !p.kicked).map((p) => `
      <div class="prow"><span>${esc(p.name)}${p.connected ? '' : ' · déconnecté'}</span><span class="row">
        ${me.isHost && p.connected ? `<button class="ghost small-btn" data-act="giveHost" data-id="${p.id}">Nommer hôte</button>` : ''}
        <button class="ghost small-btn" data-act="kick" data-id="${p.id}">Exclure</button></span></div>`).join('') || '<p class="muted small">Personne d\'autre pour l\'instant.</p>'}</section>` : '';
    const log = kind === 'journal' && view.log.length ? `<section><h3>Journal</h3><ol class="log">${view.log.slice().reverse().map((l) => `<li class="${l.pub ? '' : 'priv'}"><span class="when">${esc(l.when || '')}</span><span>${esc(l.text)}</span></li>`).join('')}</ol></section>` : '';
    let body = top + log;
    if (kind === 'settings') {
      const dark = document.body.dataset.appearance === 'dark';
      body = `${lobby ? gameSettingsHTML() : ''}
        <section><h3>Micro et caméra</h3>${deviceSelect('audio')}${deviceSelect('video')}</section>
        <section><h3>Affichage et son</h3>
          <div class="seg" role="group" aria-label="Apparence"><button class="${dark ? '' : 'on'}" data-act="appearance-set" data-v="light" aria-pressed="${!dark}">${icon('sun', 16)} Clair</button><button class="${dark ? 'on' : ''}" data-act="appearance-set" data-v="dark" aria-pressed="${dark}">${icon('moon', 16)} Sombre</button></div>
          <label class="check"><input type="checkbox" data-act="sound" ${soundOn() ? 'checked' : ''}> Son et vibration quand c'est à toi</label></section>
        ${players}`;
    }
    const title = { roles: isON() ? 'Deck' : 'Rôles', settings: 'Paramètres', journal: 'Mon rôle et journal' }[kind];
    return `<aside class="drawer ${lobby && kind === 'roles' ? 'wide' : ''} ${drawerOpen ? 'open' : ''} ${drawerAnim ? 'slide' : ''}" aria-hidden="${!drawerOpen}" aria-label="${title}">
      <div class="drawer-head"><h2>${title}</h2><button class="round" data-act="drawer-close" aria-label="Fermer">${icon('x', 18)}</button></div>
      ${body}</aside>
      ${drawerOpen ? '<div class="scrim" data-act="drawer-close"></div>' : ''}`;
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
    const ic = kind === 'turn' ? 'target' : kind === 'step' ? (isDayCtx() ? 'sun' : 'moon') : null;
    el.innerHTML = `${ic ? `<span class="alert-icon">${icon(ic, 22)}</span>` : ''}<div><div class="alert-title">${title}</div>${text ? `<div class="alert-text">${text}</div>` : ''}</div>`;
    clearTimeout(alertT);
    alertT = setTimeout(() => { el.classList.remove('show'); }, kind === 'turn' ? 3500 : kind === 'step' ? 2600 : 3000);
  }

  let lastTurnKey = null;
  let lastStepKey = null;
  let lastInfoKey = null;
  let lastPhaseKey = null;
  function notify(prev, v) {
    const st = v.step;
    const myTurn = st && !st.resolved && st.isActor && !st.submitted;
    document.title = myTurn ? '● À toi · Loup-Garou' : 'Loup-Garou';
    if (!prev) { lastTurnKey = myTurn ? stepKey(st) : null; return; }
    const phaseKey = `${v.room.phase}:${v.room.night}:${v.room.day}`;
    const newNight = v.room.phase === 'night' && phaseKey !== lastPhaseKey && prev.room.phase !== 'night';
    lastPhaseKey = phaseKey;
    // Orange : c'est à toi. Bleu : une nouvelle étape commence, juste pour prévenir.
    if (st && !st.resolved && stepKey(st) !== lastStepKey) {
      lastStepKey = stepKey(st);
      if (myTurn && st.type !== 'roles_reveal') {
        lastTurnKey = stepKey(st);
        chime();
      }
    }
    void newNight; void lastInfoKey;
  }

  // ---------- Événements ----------
  $app.addEventListener('click', (e) => {
    if (ambOpen && !e.target.closest('.amb-wrap')) { ambOpen = false; render(); }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    const st = view && view.step;
    switch (act) {
      case 'home-create': home = { step: 'game', code: '', info: null }; render(); break;
      case 't-game': testForm.game = el.dataset.v; testForm.extra = []; saveTest(); render(); break;
      case 't-bots': testForm.bots += +el.dataset.d; saveTest(); render(); break;
      case 't-extra': {
        const v = el.dataset.v;
        testForm.extra = testForm.extra.includes(v) ? testForm.extra.filter((x) => x !== v) : testForm.extra.concat(v);
        saveTest(); render(); break;
      }
      case 't-start': {
        const name = document.getElementById('f-name').value.trim() || 'Testeur';
        localStorage.setItem('lg-name', name);
        send('createTest', Object.assign({ name }, testForm), (r) => save(r.code, r.token, name));
        break;
      }
      case 'pick-game': home = { step: 'create', game: el.dataset.game, code: '', info: null }; render(); focus('f-name'); break;
      case 'home-join': home = { step: 'join', code: '', info: null }; render(); focus('f-code'); break;
      case 'home-back': home = { step: home.step === 'joinInfo' ? 'join' : home.step === 'create' ? 'game' : 'choose', code: home.code, info: null }; render(); break;
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
        send(act, { name, code: home.code, game: home.game }, (r) => { save(r.code, r.token, name); history.replaceState(null, '', '/'); });
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
        send('leave', {}, () => { forget(); home = { step: homeStart(), code: '', info: null }; setView(null); });
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
      case 'rc-ok': try { localStorage.setItem(changeStore(), changeKey()); } catch (e) { /* stockage indisponible */ } render(); break;
      case 'sel': ui.sel = [el.dataset.id]; render(); break;
      case 'pick': {
        const id = el.dataset.id;
        if (st.type === 'loups') { if (st.myInput !== id) { ui.sel = [id]; send('act', { target: id }); render(); } break; }
        if (st.type === 'n_voyante') ui.csel = [];
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
      case 'drawer-close':
        drawerOpen = false;
        render();
        break;
      case 'appearance-set':
        document.body.dataset.appearance = el.dataset.v;
        localStorage.setItem('lg-appearance', el.dataset.v);
        render();
        break;
      case 'drawer':
        if (drawerOpen && el.dataset.kind && el.dataset.kind !== drawerKind) { drawerKind = el.dataset.kind; drawerAnim = false; render(); break; }
        if (el.dataset.kind) drawerKind = el.dataset.kind;
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
      case 'pickc': {
        const i = el.dataset.i;
        const max = centerPickable(st);
        ui.csel = ui.csel.includes(i) ? ui.csel.filter((x) => x !== i) : ui.csel.concat(i).slice(-max);
        if (ui.csel.length) ui.sel = []; // Voyante : un joueur OU des cartes
        render();
        break;
      }
      case 'pass2': send('act', { targets: null }); break;
      case 'amb': ambOpen = !ambOpen; render(); break;
      case 'amb-mute': Amb.toggle(); render(); break;
      case 'amb-thunder': Amb.thunderNow(); break;
      case 'preset': send('preset', { index: +el.dataset.i }); break;
      case 'keep': send('act', { take: null }); break;
      case 'infect': send('act', { infect: el.dataset.v === '1' }); break;
      case 'abstain': send('act', { target: null }); break;
      case 'submit': {
        let payload;
        if (st.type === 'compoVote') payload = { roles: ui.cv || (Array.isArray(st.myInput) ? st.myInput : []) };
        else if (TWO.includes(st.type)) payload = { targets: ui.sel };
        else if (st.type === 'voleur') payload = { take: +ui.sel[0] };
        else if (st.type === 'n_voyante' && ui.csel.length === 2) payload = { center: ui.csel.map(Number) };
        else if (st.type === 'n_soulard' || st.type === 'n_loups') payload = { center: +ui.csel[0] };
        else if (st.type === 'sorciere') payload = { save: ui.save, kill: ui.kill };
        else payload = { target: ui.sel[0] || st.myInput };
        send('act', payload);
        break;
      }
    }
  });

  $app.addEventListener('input', (e) => {
    if (e.target.id === 'f-name' && TEST) localStorage.setItem('lg-name', e.target.value);
    if (e.target.dataset.act === 'amb-vol') Amb.setVolume(+e.target.value / 100);
  });
  $app.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.t) {
      testForm[el.dataset.t] = el.type === 'checkbox' ? el.checked : el.dataset.t === 'speed' ? +el.value : el.value;
      if (el.dataset.t === 'role') testForm.extra = testForm.extra.filter((x) => x !== el.value);
      saveTest(); render(); return;
    }
    if (el.tagName === 'SELECT' || el.type === 'range') setTimeout(() => el.blur(), 0);
    if (el.dataset.act === 'cv') {
      const st = view.step;
      let cur = (ui.cv || (Array.isArray(st.myInput) ? st.myInput : [])).slice();
      cur = el.checked ? cur.concat(el.dataset.role) : cur.filter((r) => r !== el.dataset.role);
      ui.cv = cur;
      return;
    }
    if (el.dataset.act === 'amb-storm') { Amb.toggleStorm(); return; }
    if (el.dataset.act === 'game') { send('switchGame', { game: el.value }); return; }
    if (el.dataset.act === 'dev') { Media.choose(el.dataset.kind, el.value); return; }
    if (el.dataset.act === 'sound') { localStorage.setItem('lg-sound', el.checked ? '1' : '0'); if (el.checked) chime(); return; }
    const key = el.dataset.set;
    if (!key) return;
    let patch;
    if (key.startsWith('ext.')) patch = { extensions: { [key.slice(4)]: el.checked } };
    else if (el.type === 'checkbox') patch = { [key]: el.checked };
    else if (key === 'debateSeconds' || key === 'nightSeconds') patch = { [key]: +el.value };
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
