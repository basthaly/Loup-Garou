/* Loup-Garou — client (interface en zones) */
(() => {
  const socket = io();
  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');
  const RTC = window.LGRTC;
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
    ear: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1"/><rect x="17" y="14" width="4" height="6" rx="1"/>'
  };
  const icon = (n, size = 16, color = 'currentColor') =>
    `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Connexion ----------
  const saved = () => { try { return JSON.parse(sessionStorage.getItem('lg') || 'null'); } catch { return null; } };
  const save = (code, token) => sessionStorage.setItem('lg', JSON.stringify({ code, token }));

  fetch('/api/roles').then((r) => r.json()).then((d) => {
    ROLES = d.roles;
    EXTS = d.extensions;
    RTC.init(socket, d.iceServers, render);
    render();
  });

  socket.on('connect', () => {
    const s = saved();
    if (s) socket.emit('resume', s, (r) => { if (!r.ok) { sessionStorage.removeItem('lg'); setView(null); toast(r.error); } });
    else render();
  });
  socket.on('disconnect', () => toast('Connexion perdue… reconnexion en cours'));
  socket.on('state', (v) => {
    offset = v.room.serverNow - Date.now();
    const k = stepKey(v.step);
    if (k !== ui.key) ui = { key: k, sel: [], cv: null, save: false, kill: null };
    setView(v);
  });

  function setView(v) {
    view = v;
    RTC.update(v);
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
  const zone = (n, title, body, cls = '', right = '') =>
    `<section class="zone ${cls}"><h2 class="zh"><span class="zn">${n}</span>${title}${right ? `<span class="zh-r">${right}</span>` : ''}</h2><div class="zb">${body}</div></section>`;

  setInterval(() => {
    document.querySelectorAll('[data-deadline]').forEach((el) => { el.textContent = fmt(+el.dataset.deadline - Date.now() - offset); });
  }, 250);

  // ---------- Rendu ----------
  function render() {
    if (!ROLES) return;
    if (!view) {
      document.body.dataset.theme = 'night';
      document.body.dataset.dead = '';
      $app.innerHTML = homeHTML();
      return;
    }
    document.body.dataset.theme = isDayCtx() ? 'day' : 'night';
    document.body.dataset.dead = !view.me.alive && !view.me.isMJ && view.room.phase !== 'end' ? '1' : '';
    $app.innerHTML = view.room.phase === 'lobby' ? lobbyHTML() : gameHTML();
    RTC.mount($app);
  }

  function brand() {
    return `<div class="brand">${icon(isDayCtx() ? 'sun' : 'moon', 26)}<span>Loup-Garou</span></div>`;
  }

  function homeHTML() {
    const code = new URLSearchParams(location.search).get('code') || '';
    const name = localStorage.getItem('lg-name') || '';
    return `<main class="home">
      <div class="brand big">${icon('moon', 44)}<span>Loup-Garou</span></div>
      <p class="muted" style="text-align:center;margin:0">Le Loup-Garou entre amis, avec caméra et micro.</p>
      <div class="zone"><div class="zb">
        <label for="f-name">Ton pseudo</label>
        <input type="text" id="f-name" maxlength="20" value="${esc(name)}" autocomplete="nickname">
        ${code ? '' : '<button class="primary" data-act="create">Créer une partie</button><div class="sep">ou rejoindre une partie</div>'}
        <label for="f-code">Code de la partie</label>
        <input type="text" id="f-code" maxlength="4" value="${esc(code)}" style="text-transform:uppercase;letter-spacing:3px">
        <button class="${code ? 'primary' : ''}" data-act="join">Rejoindre</button>
      </div></div></main>`;
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
    if (p.idiotRevealed) tl.push('<span class="chip">Ne vote plus</span>');
    if (!p.connected) tl.push('<span class="chip">Déconnecté</span>');
    if (r && r.recv.blur) tl.push('<span class="chip">Espionnage</span>');
    const tr = [];
    if (p.captain) tr.push(`<span class="chip cap">${icon('crown', 12, '#7A4210')} Capitaine</span>`);
    if (p.lover || me.lover === p.id) tr.push(`<span class="chip" title="Amoureux">${icon('heart', 12, '#F08A6C')}</span>`);
    if (voted) tr.push(`<span class="chip ok">${icon('check', 12)} ${st.type === 'debate' || st.type === 'roles_reveal' ? 'Prêt' : 'A voté'}</span>`);
    if (opts.target) tr.push('<span class="chip target">Ta cible</span>');
    return `<div class="tile has-video-host ${isMe ? 'me' : ''} ${asleep ? 'asleep' : ''} ${opts.wolfMate ? 'wolfmate' : ''} ${opts.target ? 'targeted' : ''}">
      ${asleep ? `<div class="sleep">${icon('moon', 22)}<span>Endormi</span></div>` : `<span class="avatar" style="background:${colorOf(p.id)}" aria-hidden="true">${esc(p.name[0])}</span>`}
      <div class="vslot" data-vslot="${slot}"></div>
      <div class="tl">${tl.join('')}</div><div class="tr">${tr.join('')}</div>
      <span class="nm">${p.mic ? '' : icon('micoff', 13)}${esc(p.name)}${isMe ? ' (toi)' : ''}</span></div>`;
  }

  function mediaControlsHTML() {
    const L = RTC.local, me = view.me;
    if (!L.stream) {
      return `<button class="primary" data-act="media-start" ${L.starting ? 'disabled' : ''}>${icon('cam', 16)} ${L.starting ? 'Autorisation…' : 'Activer caméra et micro'}</button>
        ${L.error ? `<div class="warn">${esc(L.error)}</div>` : ''}`;
    }
    const deadNote = !me.alive && !me.isMJ && view.room.phase !== 'end' ? '<div class="note">Seuls les autres morts t\'entendent.</div>' : '';
    return `<div class="row">
        <button class="toggle ${L.cam ? 'on' : ''}" aria-pressed="${L.cam}" data-act="media-cam">${icon(L.cam ? 'cam' : 'camoff', 16)} ${L.cam ? 'Caméra' : 'Caméra coupée'}</button>
        <button class="toggle ${L.mic ? 'on' : ''}" aria-pressed="${L.mic}" data-act="media-mic">${icon(L.mic ? 'mic' : 'micoff', 16)} ${L.mic ? 'Micro' : 'Micro coupé'}</button>
      </div>${L.error ? `<div class="note">${esc(L.error)}</div>` : ''}${deadNote}`;
  }

  // ----- Salon -----
  function lobbyHTML() {
    const r = view.room, s = r.settings, me = view.me, host = me.isHost;
    const dis = host ? '' : 'disabled';
    const nGame = view.players.filter((p) => !p.isMJ).length;
    const radio = (name, val, title, desc) => `
      <label class="choice ${s[name] === val ? 'on' : ''}"><input type="radio" name="${name}" value="${val}" data-set="${name}" ${s[name] === val ? 'checked' : ''} ${dis}>
      <span><span style="display:block;font-weight:600">${title}</span><span class="muted" style="font-size:14px">${desc}</span></span></label>`;
    const check = (label, val, path) => `<label class="check"><input type="checkbox" data-set="${path}" ${val ? 'checked' : ''} ${dis}> ${label}</label>`;
    const mjSelect = s.mjMode === 'joueur' ? `<label for="f-mj" class="muted" style="font-size:14px">Qui est le MJ ?</label>
      <select id="f-mj" data-set="mjId" ${dis}><option value="">— choisir —</option>${view.players.map((p) => `<option value="${p.id}" ${s.mjId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : '';
    const warn = [];
    if (nGame < r.minPlayers) warn.push(`Il faut au moins ${r.minPlayers} joueurs (hors MJ).`);
    else if (nGame < r.recommended) warn.push(`${r.recommended} joueurs ou plus recommandés pour une vraie partie.`);
    const csize = Object.values(view.compo).reduce((a, b) => a + b, 0);
    if (s.distribution === 'auto' && csize !== nGame) warn.push(`La composition compte ${csize} cartes pour ${nGame} joueurs.`);
    if (s.mjMode === 'joueur' && !s.mjId) warn.push('Choisis le joueur qui sera MJ.');
    const link = `${location.origin}/?code=${r.code}`;
    const head = `<header class="band"><div class="in">${brand()}
        <div class="phase"><span class="ph-title">Salon</span><span class="ph-sub">${nGame} joueur${nGame > 1 ? 's' : ''}${s.mjMode === 'joueur' && s.mjId ? ' + MJ' : ''}</span></div>
        <span class="grow"></span>
        <div class="row"><span class="ph-sub">Code</span><span class="code">${r.code}</span>
          <button data-act="copy" data-link="${esc(link)}">Copier le lien</button><button data-act="leave">Quitter</button></div>
      </div></header>`;
    const moi = zone(1, 'Moi', `${tileHTML(P(me.id), { slot: 'me' })}${mediaControlsHTML()}
      <p class="muted" style="margin:0;font-size:14px">La caméra est facultative. Le micro sert à débattre.</p>`, 'z-moi');
    const others = view.players.filter((p) => p.id !== me.id);
    const players = zone(2, 'Joueurs', `<div class="grid">${others.map((p) => tileHTML(p)).join('') || '<p class="muted" style="margin:0">En attente d\'autres joueurs… Partage le lien, ou ouvre d\'autres onglets pour tester seul.</p>'}</div>`, 'z-village', `${view.players.length} connecté${view.players.length > 1 ? 's' : ''}`);
    const settings = `
      <div class="label">Maître du jeu</div>
      ${radio('mjMode', 'site', 'Le site (automatique)', 'Annonce les phases, réveille les rôles et compte les votes.')}
      ${radio('mjMode', 'joueur', 'Un joueur', 'Il voit tous les rôles, fait avancer la partie et ne joue pas.')}
      ${mjSelect}
      <div class="label">Distribution des rôles</div>
      ${radio('distribution', 'auto', 'Automatique selon le nombre', "Composition proposée, modifiable par l'hôte.")}
      ${radio('distribution', 'vote', 'Choisie par les joueurs', 'Chacun vote ; résultat révélé à tous en même temps.')}
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
      ${host ? '<button class="primary" data-act="start">Lancer la partie</button>' : '<div class="note">L\'hôte lancera la partie.</div>'}`;
    return head + `<main class="zones">
        <div class="z-col-left">${moi}</div>
        <div class="z-col-mid">${players}${zone(4, 'Composition des rôles', compoHTML(nGame))}</div>
        <div class="z-col-right">${zone(3, 'Réglages', settings, 'z-action v-accent')}</div>
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
      ? '<p class="note" style="margin:0">Au lancement, chaque joueur coche les rôles qu\'il veut. Un rôle est retenu s\'il obtient au moins la moitié des voix. Les loups sont ajoutés automatiquement.</p>'
      : `<div class="row"><strong>${size} cartes pour ${n} joueurs</strong>
          <span class="pill t-loups">${counts.loups} Loups</span><span class="pill t-village">${counts.village} Village</span>
          ${counts.solitaire ? `<span class="pill t-solitaire">${counts.solitaire} Solitaire</span>` : ''}
          ${host && view.customCompo ? '<button data-act="compoReset">Composition automatique</button>' : ''}</div>`;
    return summary + groups;
  }

  // ----- Jeu -----
  function gameHTML() {
    const r = view.room, st = view.step, me = view.me;
    const day = isDayCtx();
    const title = r.phase === 'end' ? 'Fin de partie' : r.phase === 'setup' ? 'Préparation' : day ? `Jour ${Math.max(1, r.day)}` : `Nuit ${r.night}`;
    const steps = r.phase === 'end' ? '' : `<ol class="steps" aria-label="Déroulé de la phase">${r.phaseSteps.map((s) =>
      `<li class="${s.state}">${esc(STEP_LABEL[s.type] || s.type)}${s.state === 'done' ? ' ✓' : ''}</li>`).join('')}</ol>`;
    const timer = st && !st.resolved && st.deadline
      ? `<div class="tblock"><span class="label">Temps restant</span><span class="timer" data-deadline="${st.deadline}">${fmt(st.deadline - Date.now() - offset)}</span></div>` : '';
    let narr;
    if (r.phase === 'end' && r.winner) narr = `<span class="label">Fin</span><p>${esc(r.winner.text)}</p>`;
    else if (st) {
      const txt = st.resolved && st.result && st.result.text ? st.result.text : st.narration;
      narr = `<span class="label">${me.isMJ ? 'Toi (MJ)' : 'Le MJ'}</span><p>${esc(txt)}</p>`;
    } else narr = '<span class="label">Le MJ</span><p>…</p>';
    const spectator = document.body.dataset.dead === '1'
      ? `<div class="spect"><div class="in">${icon('ear', 18)} Mode spectateur : tu vois et entends tout, les vivants ne t'entendent plus.</div></div>` : '';
    const head = `<header class="band"><div class="in">${brand()}
        <div class="phase"><span class="ph-title">${title}</span><span class="ph-sub">Partie ${r.code}</span></div>
        ${steps}<span class="grow"></span>${timer}</div>
        <div class="narr"><div class="in">${narr}</div></div>${spectator}</header>`;
    return head + `<main class="zones">
      <div class="z-col-left">${moiZone()}</div>
      <div class="z-col-mid">${villageZone()}</div>
      <div class="z-col-right">${actionZone()}${logZone()}</div>
    </main>`;
  }

  function moiZone() {
    const me = view.me, r = view.room;
    let role = '';
    if (me.isMJ) {
      role = `<div><div class="label">Ton rôle</div><div class="bigrole">Maître du jeu</div>
        <p class="muted" style="margin:0;font-size:14px">Tu vois tous les rôles et toutes les actions. Les votes restent secrets jusqu'à la révélation.</p></div>`;
    } else if (me.role) {
      const d = ROLES[me.role];
      const extra = [];
      if (me.wolves.length > 1) extra.push(`Ta meute : <strong>${me.wolves.filter((w) => w !== me.id).map(nm).join(', ')}</strong>`);
      if (me.lover) {
        const lr = P(me.lover).role;
        extra.push(`${icon('heart', 14, '#F08A6C')} Amoureux(se) de <strong>${nm(me.lover)}</strong>${lr ? ` (${esc(roleName(lr))})` : ''}. Si l'un meurt, l'autre aussi.`);
      }
      if (me.seen.length) extra.push('Tes visions : ' + me.seen.map((s) => `${esc(s.name)} → <span class="t-${teamOf(s.role)}">${esc(roleName(s.role))}</span>`).join(', '));
      if (r.potions) extra.push(`Potions : vie ${r.potions.life ? 'disponible' : 'utilisée'} · mort ${r.potions.death ? 'disponible' : 'utilisée'}`);
      if (!me.canVote) extra.push('Tu ne peux plus voter.');
      role = `<div><div class="label">${me.alive || r.phase === 'end' ? 'Ton rôle · secret' : 'Tu étais'}</div>
        <div class="bigrole t-${d.team}">${esc(d.name)}</div>
        <div class="muted" style="font-size:14px">Équipe : ${TEAM[d.team]}</div></div>
        <p style="margin:0;font-size:14px">${esc(d.desc)}</p>${extra.map((x) => `<div class="note">${x}</div>`).join('')}`;
    }
    return zone(1, 'Moi', `${tileHTML(P(me.id), { slot: 'me' })}${role}${mediaControlsHTML()}`, 'z-moi');
  }

  function villageZone() {
    const me = view.me, st = view.step, r = view.room;
    const players = view.players.filter((p) => !p.isMJ);
    const alive = players.filter((p) => p.alive);
    const dead = players.filter((p) => !p.alive);
    const mj = view.players.find((p) => p.isMJ && p.id !== me.id);
    const sel = ui.sel.length ? ui.sel : st && typeof st.myInput === 'string' ? [st.myInput] : [];
    const myTargeting = st && st.isActor && !st.resolved ? sel : [];
    const night = r.phase === 'night' && !isDayCtx();
    let hint = '';
    if (st && !st.resolved && ['vote', 'captain_vote', 'debate'].includes(st.type) && st.actorsCount != null) {
      hint = `${st.done.length} sur ${st.actorsCount} ${st.type === 'debate' ? 'prêts' : 'ont voté'}`;
    } else if (night && me.alive && !me.isMJ) {
      hint = st && st.type === 'loups' && me.role === 'loup' ? 'Seule ta meute est visible' : 'Le village dort';
    }
    const tiles = (mj ? tileHTML(mj) : '') + alive.map((p) => tileHTML(p, {
      wolfMate: me.role === 'loup' && p.role === 'loup' && p.id !== me.id && night,
      target: myTargeting.includes(p.id)
    })).join('');
    const cemetery = dead.length ? `<div class="cemetery">
        <div class="sub"><h3>${icon('grave', 16)} Cimetière · ${dead.length}</h3><span class="muted" style="font-size:13px">Ils écoutent, mais ne parlent plus aux vivants</span></div>
        <div class="dgrid">${dead.map(deadRowHTML).join('')}</div></div>` : '';
    const body = `<div class="sub"><h3><span class="dot"></span>Vivants · ${alive.length}</h3><span class="muted" style="font-size:14px">${esc(hint)}</span></div>
      <div class="grid">${tiles}</div>${cemetery}`;
    return zone(2, 'Le village', body, 'z-village');
  }

  function deadRowHTML(p) {
    const causes = { loups: 'mort(e)', sorciere: 'mort(e)', vote: 'éliminé(e)', bouc: 'sacrifié(e)', chasseur: 'abattu(e)', chagrin: 'mort(e) de chagrin' };
    const d = p.death || {};
    const info = [p.role ? roleName(p.role) : null, `${causes[d.cause] || 'mort(e)'}${d.when ? ' · ' + d.when.toLowerCase() : ''}`].filter(Boolean).join(' · ');
    const isMe = p.id === view.me.id;
    return `<div class="drow has-video-host ${isMe ? 'me' : ''}">
      <div class="dav"><span class="avatar" aria-hidden="true">${esc(p.name[0])}</span><div class="vslot" data-vslot="${isMe ? 'me2' : p.id}"></div></div>
      <div style="min-width:0"><div class="dname">${esc(p.name)}${isMe ? ' (toi)' : ''}</div><div class="dinfo">${esc(info)}</div></div></div>`;
  }

  function targetOptions(st) {
    const me = view.me;
    let list = alivePlayers();
    switch (st.type) {
      case 'voyante': case 'vote': case 'sorciere': list = list.filter((p) => p.id !== me.id); break;
      case 'salvateur': list = list.filter((p) => p.id !== st.lastProtected); break;
      case 'loups': list = list.filter((p) => !me.wolves.includes(p.id)); break;
    }
    return list;
  }

  function optsHTML(list, selected, act = 'sel') {
    return `<div class="opts">${list.map((p) => `<button class="opt ${selected.includes(p.id) ? 'on' : ''}" aria-pressed="${selected.includes(p.id)}" data-act="${act}" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
  }

  function progressHTML(st, verb) {
    if (st.actorsCount == null) return '';
    const pct = st.actorsCount ? Math.round((st.done.length / st.actorsCount) * 100) : 0;
    return `<div class="row" style="justify-content:space-between;font-size:14px;font-weight:600"><span>${verb}</span><span>${st.done.length} / ${st.actorsCount}</span></div>
      <div class="bar"><div style="width:${pct}%"></div></div>`;
  }

  function actionZone() {
    const st = view.step, me = view.me, r = view.room;
    if (r.phase === 'end') {
      const body = `<div class="bigrole">${esc(r.winner ? r.winner.text : '')}</div>
        ${me.isHost ? '<button class="primary" data-act="restart">Nouvelle partie</button>' : '<div class="note">L\'hôte peut relancer une partie.</div>'}`;
      return zone(3, 'Fin de partie', body, 'z-action v-accent');
    }
    if (!st) return zone(3, 'Patiente', '<p class="muted" style="margin:0">…</p>', 'z-action v-muted');
    let title, variant, body;
    if (st.resolved) {
      title = 'Résultat';
      variant = 'v-accent';
      const next = r.waitingMJ ? (me.canControl ? '' : '<div class="muted">En attente du MJ…</div>')
        : st.nextAt ? `<div class="muted" style="font-size:14px">Suite dans <span data-deadline="${st.nextAt}"></span></div>` : '';
      body = resultHTML(st) + next;
    } else if (st.isActor) {
      const voteLike = st.type === 'vote' || st.type === 'captain_vote';
      title = voteLike ? 'À toi de voter' : 'À toi de jouer';
      variant = st.type === 'loups' ? 'v-wolf' : voteLike || DAY_STEPS.includes(st.type) ? 'v-vote' : 'v-accent';
      body = actorHTML(st);
    } else {
      const night = !DAY_STEPS.includes(st.type) && !['roles_reveal', 'compoVote'].includes(st.type);
      if (me.isMJ) {
        title = 'Maître du jeu';
        variant = 'v-accent';
        body = `<p style="margin:0">En attente de : <strong>${st.actors.filter((a) => !st.done.includes(a)).map(nm).join(', ') || '—'}</strong></p>`;
      } else if (!me.alive) {
        title = 'Tu observes';
        variant = 'v-muted';
        body = `<div class="q">Aucune action pour toi</div><p class="muted" style="margin:0">Tu ne joues plus.${['vote', 'captain_vote'].includes(st.type) ? ' Les votes des vivants seront révélés en même temps.' : ''}</p>`;
      } else {
        title = 'Patiente';
        variant = 'v-muted';
        body = `<p class="muted" style="margin:0">${night ? 'Le village dort… ferme les yeux et attends ton tour.' : 'Tu ne participes pas à cette étape.'}</p>`;
      }
      body += progressHTML(st, st.type === 'debate' ? 'Prêts à voter' : night ? 'Ont agi' : 'Votes reçus');
    }
    return zone(3, title, body + controlHTML(), `z-action ${variant}`);
  }

  function actorHTML(st) {
    const r = view.room;
    const sent = st.submitted ? `<div class="note">${icon('check', 14)} Choix envoyé. Tu peux encore le changer avant la fin.</div>` : '';
    const sel = ui.sel.length ? ui.sel : st.myInput && typeof st.myInput === 'string' ? [st.myInput] : [];
    switch (st.type) {
      case 'roles_reveal':
        return `<div class="q">Découvre ton rôle</div><p class="muted" style="margin:0">Il est affiché dans la zone « Moi ». Garde-le secret !</p>
          ${st.submitted ? sent : '<button class="primary" data-act="ready">J\'ai vu mon rôle</button>'}${progressHTML(st, 'Prêts')}`;
      case 'compoVote': {
        const opts = Object.entries(ROLES).filter(([k, d]) => d.impl && k !== 'loup' && k !== 'villageois' && (d.ext === 'base' || r.settings.extensions[d.ext]));
        const cur = ui.cv || (Array.isArray(st.myInput) ? st.myInput : []);
        return `<div class="q">Quels rôles veux-tu ?</div>
          ${opts.map(([k, d]) => `<label class="check"><input type="checkbox" data-act="cv" data-role="${k}" ${cur.includes(k) ? 'checked' : ''}> ${esc(d.name)}</label>`).join('')}
          <button class="primary" data-act="submit">Envoyer mon choix</button>${sent}${progressHTML(st, 'Votes reçus')}`;
      }
      case 'debate':
        return `<div class="q">Débat</div><p class="muted" style="margin:0">Discutez ! Le vote s'ouvre à la fin du temps, ou quand tout le monde est prêt.</p>
          ${st.submitted ? sent : '<button class="primary" data-act="ready">Je suis prêt à voter</button>'}${progressHTML(st, 'Prêts à voter')}`;
      case 'cupidon': {
        const cur = ui.sel.length ? ui.sel : Array.isArray(st.myInput) ? st.myInput : [];
        return `<div class="q">Désigne deux amoureux</div>${optsHTML(alivePlayers(), cur, 'sel2')}
          <button class="primary" data-act="submit" ${cur.length === 2 ? '' : 'disabled'}>Valider${cur.length === 2 ? ` : ${nm(cur[0])} et ${nm(cur[1])}` : ''}</button>${sent}`;
      }
      case 'sorciere': {
        const victim = st.victim ? `<div class="note">Les loups ont choisi <strong>${nm(st.victim)}</strong>.</div>` : '<div class="note">Les loups n\'ont choisi personne.</div>';
        const saveBox = st.victim && st.potions.life ? `<label class="check"><input type="checkbox" data-act="save" ${ui.save ? 'checked' : ''}> Utiliser la potion de vie sur ${nm(st.victim)}</label>` : '';
        const kill = st.potions.death ? `<div class="label">Potion de mort</div>${optsHTML(targetOptions(st), ui.kill ? [ui.kill] : [], 'kill')}` : '';
        return `<div class="q">Sorcière</div>${victim}${saveBox}${kill}
          <button class="primary" data-act="submit">${ui.save || ui.kill ? 'Valider' : 'Ne rien faire'}</button>${sent}`;
      }
      default: {
        const titles = { salvateur: 'Qui protéger cette nuit ?', voyante: 'Qui veux-tu sonder ?', loups: 'Choisis la victime', captain_vote: 'Qui élire Capitaine ?', vote: 'Qui veux-tu éliminer ?', hunter: 'Qui emporter avec toi ?', successor: 'Qui sera le nouveau Capitaine ?' };
        let extra = '';
        if (st.type === 'loups') {
          extra += `<div class="note">${icon('lock', 14)} Les choix des loups sont révélés ensemble. En cas de désaccord, vous revotez une fois.</div>`;
          if (st.rounds && st.rounds.length) {
            extra += `<div class="note">Tour précédent : ${st.rounds[st.rounds.length - 1].map((c) => `${nm(c.voter)} → ${c.target ? nm(c.target) : 'personne'}`).join(', ')}</div>`;
          }
        }
        if (st.type === 'vote' || st.type === 'captain_vote') {
          const cap = st.type === 'vote' && r.captainId ? ` Le vote de ${nm(r.captainId)} (Capitaine) compte double.` : '';
          extra += `<div class="note">${icon('lock', 14)} Votes cachés, révélés tous en même temps.${cap}</div>`;
        }
        const btnClass = st.type === 'loups' ? 'wolf' : 'primary';
        const abst = st.type === 'vote' || st.type === 'captain_vote' ? '<button data-act="abstain">S\'abstenir</button>' : '';
        return `<div class="q">${titles[st.type] || 'Ton action'}</div>${optsHTML(targetOptions(st), sel)}
          <div class="row"><button class="${btnClass}" style="flex:1" data-act="submit" ${sel.length ? '' : 'disabled'}>Valider${sel.length ? ' : ' + nm(sel[0]) : ''}</button>${abst}</div>
          ${sent}${extra}`;
      }
    }
  }

  function resultHTML(st) {
    const res = st.result;
    if (!res) return '<div class="q">Étape terminée</div>';
    if (st.type === 'vote' || st.type === 'captain_vote') {
      const max = Math.max(1, ...Object.values(res.tally));
      const bars = Object.entries(res.tally).sort((a, b) => b[1] - a[1]).map(([id, k]) => `
        <div><div class="row" style="justify-content:space-between;font-weight:600"><span>${nm(id)}</span><span>${k} voix</span></div>
        <div class="bar"><div style="width:${Math.round((k / max) * 100)}%"></div></div></div>`).join('');
      const list = res.choices.map((c) => `<div>${nm(c.voter)}${c.double ? ' (×2)' : ''} → <strong>${c.target ? nm(c.target) : 'abstention'}</strong></div>`).join('');
      return `<div class="q">Révélation des votes</div><div class="bars">${bars || '<span class="muted">Aucun vote.</span>'}</div><div class="votes">${list}</div><div class="note">${esc(res.text)}</div>`;
    }
    if (st.type === 'voyante' && res.seen) return `<div class="q">Vision</div><div class="bigrole">${nm(res.seen.id)} est <span class="t-${teamOf(res.seen.role)}">${esc(roleName(res.seen.role))}</span></div>`;
    if (st.type === 'loups' && 'victim' in res) return `<div class="q">Victime</div><p style="margin:0">${res.victim ? `La meute a choisi <strong>${nm(res.victim)}</strong>.` : 'Aucune victime cette nuit.'}</p>`;
    if (st.type === 'compoVote') {
      const rows = Object.entries(res.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div>${esc(roleName(k))} : ${n} voix</div>`).join('') || '<span class="muted">Aucun vote.</span>';
      const compo = Object.entries(res.compo).map(([k, n]) => `${n} ${esc(roleName(k))}`).join(', ');
      return `<div class="q">Résultat du vote</div><div class="votes">${rows}</div><div class="note">Composition retenue : ${compo}</div>`;
    }
    if (res.text) return `<div class="q">Annonce</div><p style="margin:0">${esc(res.text)}</p>`;
    return '<div class="q">Étape terminée</div>';
  }

  function controlHTML() {
    const me = view.me, r = view.room, st = view.step;
    if (!me.canControl || r.phase === 'end' || !st) return '';
    if (r.waitingMJ) return '<button class="primary" data-act="control">Continuer</button>';
    if (!st.resolved) {
      if (!me.isMJ && !['compoVote', 'roles_reveal', 'captain_vote', 'debate', 'vote'].includes(st.type)) return '';
      const label = st.type === 'debate' ? 'Ouvrir le vote maintenant' : "Clore l'étape maintenant";
      return `<div class="ctrl"><span class="label">${me.isMJ ? 'Maître du jeu' : 'Hôte'}</span><button data-act="control">${label}</button></div>`;
    }
    return '';
  }

  function logZone() {
    if (!view.log.length) return '';
    const items = view.log.slice().reverse().map((l) => `<li class="${l.pub ? '' : 'priv'}"><span class="when">${esc(l.when || '')}</span><span>${esc(l.text)}</span></li>`).join('');
    const full = view.me.isMJ || (!view.me.alive && view.room.settings.deadSeeRoles);
    return zone(4, full ? 'Journal complet' : 'Journal', `<ol class="log">${items}</ol>`, 'z-log');
  }

  // ---------- Événements ----------
  $app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    const st = view && view.step;
    switch (act) {
      case 'create': case 'join': {
        const name = document.getElementById('f-name').value.trim();
        const code = (document.getElementById('f-code') || {}).value || '';
        localStorage.setItem('lg-name', name);
        send(act, { name, code: code.trim().toUpperCase() }, (r) => { save(r.code, r.token); history.replaceState(null, '', '/'); });
        break;
      }
      case 'copy': {
        const link = el.dataset.link;
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(link).then(() => toast('Lien copié !'));
        else prompt('Copie ce lien :', link);
        break;
      }
      case 'leave':
        send('leave', {}, () => { sessionStorage.removeItem('lg'); setView(null); });
        break;
      case 'media-start': RTC.start(); break;
      case 'media-cam': RTC.toggle('cam'); break;
      case 'media-mic': RTC.toggle('mic'); break;
      case 'compo': send('compo', { role: el.dataset.role, delta: +el.dataset.delta }); break;
      case 'compoReset': send('compoReset'); break;
      case 'start': send('start'); break;
      case 'control': send('control'); break;
      case 'restart': send('restart'); break;
      case 'ready': send('act', {}); break;
      case 'sel': ui.sel = [el.dataset.id]; render(); break;
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
      const code = (document.getElementById('f-code') || {}).value;
      const btn = $app.querySelector(code ? '[data-act="join"]' : '[data-act="create"]') || $app.querySelector('[data-act="join"]');
      if (btn) btn.click();
    }
  });
})();
