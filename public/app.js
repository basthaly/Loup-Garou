/* Loup-Garou — client */
(() => {
  const socket = io();
  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');
  let view = null;
  let ROLES = null;
  let EXTS = null;
  let offset = 0;
  let ui = { key: null, sel: [], cv: null, save: false, kill: null };

  const COLORS = ['#E8A75D', '#8DB4F0', '#C7A6E8', '#7FC8A9', '#F08A6C'];
  const DAY_STEPS = ['dawn', 'captain_vote', 'debate', 'vote', 'hunter', 'successor'];
  const TEAM = { loups: 'Loups', village: 'Village', solitaire: 'Solitaire' };
  const ICON = {
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  const icon = (n, size = 16, color = 'currentColor') =>
    `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Connexion ----------
  const saved = () => { try { return JSON.parse(sessionStorage.getItem('lg') || 'null'); } catch { return null; } };
  const save = (code, token) => sessionStorage.setItem('lg', JSON.stringify({ code, token }));

  fetch('/api/roles').then((r) => r.json()).then((d) => { ROLES = d.roles; EXTS = d.extensions; render(); });

  socket.on('connect', () => {
    const s = saved();
    if (s) socket.emit('resume', s, (r) => { if (!r.ok) { sessionStorage.removeItem('lg'); view = null; toast(r.error); render(); } });
    else render();
  });
  socket.on('disconnect', () => toast('Connexion perdue… reconnexion en cours'));
  socket.on('state', (v) => {
    offset = v.room.serverNow - Date.now();
    view = v;
    const k = stepKey(v.step);
    if (k !== ui.key) ui = { key: k, sel: [], cv: null, save: false, kill: null };
    render();
  });

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
  const colorOf = (id) => COLORS[view.players.findIndex((p) => p.id === id) % COLORS.length];
  const alivePlayers = () => view.players.filter((p) => p.alive && !p.isMJ);
  const roleName = (r) => (ROLES && ROLES[r] ? ROLES[r].name : r);
  const teamOf = (r) => (ROLES && ROLES[r] ? ROLES[r].team : 'village');
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const timerEl = (deadline) => (deadline ? `<span class="timer" data-deadline="${deadline}">${fmt(deadline - Date.now() - offset)}</span>` : '');

  setInterval(() => {
    document.querySelectorAll('[data-deadline]').forEach((el) => { el.textContent = fmt(+el.dataset.deadline - Date.now() - offset); });
  }, 250);

  function header(right) {
    return `<header class="top"><div class="in">
      <div class="brand">${icon('moon', 28)}<span>Loup-Garou</span></div>
      <div class="row">${right || ''}</div></div></header>`;
  }

  // ---------- Rendu ----------
  function render() {
    if (!ROLES) return;
    if (!view) { document.body.dataset.theme = 'night'; $app.innerHTML = homeHTML(); return; }
    const st = view.step;
    const day = view.room.phase === 'day' || (st && DAY_STEPS.includes(st.type));
    document.body.dataset.theme = day && view.room.phase !== 'end' ? 'day' : 'night';
    $app.innerHTML = view.room.phase === 'lobby' ? lobbyHTML() : gameHTML();
  }

  function homeHTML() {
    const code = new URLSearchParams(location.search).get('code') || '';
    const name = localStorage.getItem('lg-name') || '';
    return `<main class="home">
      <div class="brand">${icon('moon', 44)}<span>Loup-Garou</span></div>
      <p class="muted" style="text-align:center;margin:0">Le Loup-Garou entre amis, chacun sur son écran.</p>
      <div class="card">
        <label for="f-name">Ton pseudo</label>
        <input type="text" id="f-name" maxlength="20" value="${esc(name)}" autocomplete="nickname">
        ${code ? '' : '<button class="primary" data-act="create">Créer une partie</button><div class="sep">ou rejoindre une partie</div>'}
        <label for="f-code">Code de la partie</label>
        <input type="text" id="f-code" maxlength="4" value="${esc(code)}" style="text-transform:uppercase;letter-spacing:3px">
        <button class="${code ? 'primary' : ''}" data-act="join">Rejoindre</button>
      </div></main>`;
  }

  // ----- Salon -----
  function lobbyHTML() {
    const r = view.room, s = r.settings, me = view.me, host = me.isHost;
    const dis = host ? '' : 'disabled';
    const nGame = view.players.filter((p) => !p.isMJ).length;
    const players = view.players.map((p) => `
      <div class="prow ${p.connected ? '' : 'off'}">
        <span class="avatar" style="background:${colorOf(p.id)}">${esc(p.name[0])}</span>
        <div style="flex:1;min-width:0"><div style="font-weight:600">${esc(p.name)}${p.id === me.id ? ' (toi)' : ''}</div>
        <div class="tag">${[p.id === r.hostId ? 'Hôte' : '', p.isMJ ? 'Maître du jeu' : '', p.connected ? '' : 'déconnecté'].filter(Boolean).join(' · ')}</div></div>
      </div>`).join('');
    const radio = (name, val, title, desc) => `
      <label class="choice ${s[name] === val ? 'on' : ''}"><input type="radio" name="${name}" value="${val}" data-set="${name}" ${s[name] === val ? 'checked' : ''} ${dis}>
      <span><span style="display:block;font-weight:600">${title}</span><span class="muted" style="font-size:14px">${desc}</span></span></label>`;
    const check = (key, label, val, path) => `<label class="check"><input type="checkbox" data-set="${path || key}" ${val ? 'checked' : ''} ${dis}> ${label}</label>`;
    const mjSelect = s.mjMode === 'joueur' ? `<label for="f-mj" class="muted" style="font-size:14px">Qui est le MJ ?</label>
      <select id="f-mj" data-set="mjId" ${dis}><option value="">— choisir —</option>${view.players.map((p) => `<option value="${p.id}" ${s.mjId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : '';
    const warn = [];
    if (nGame < r.minPlayers) warn.push(`Il faut au moins ${r.minPlayers} joueurs (hors MJ).`);
    else if (nGame < r.recommended) warn.push(`${r.recommended} joueurs ou plus recommandés pour une vraie partie.`);
    const csize = Object.values(view.compo).reduce((a, b) => a + b, 0);
    if (s.distribution === 'auto' && csize !== nGame) warn.push(`La composition compte ${csize} cartes pour ${nGame} joueurs.`);
    if (s.mjMode === 'joueur' && !s.mjId) warn.push('Choisis le joueur qui sera MJ.');
    const link = `${location.origin}/?code=${r.code}`;
    return header(`<span class="muted">Code</span><span class="code">${r.code}</span>
        <button data-act="copy" data-link="${esc(link)}">Copier le lien</button><button data-act="leave">Quitter</button>`) + `
      <main>
        <div><h1 class="title">Salon de la partie</h1>
        <p class="muted" style="margin:4px 0 0">${nGame} joueur${nGame > 1 ? 's' : ''}${s.mjMode === 'joueur' && s.mjId ? ' + 1 MJ' : ''} · ${host ? 'tu es l\'hôte' : 'en attente du lancement par l\'hôte'}</p></div>
        <div class="cols">
          <section class="main">
            <div class="card"><h2>Joueurs</h2><div class="plist">${players}</div>
              <p class="note" style="margin:0">Pour tester seul : ouvre plusieurs onglets, chacun est un joueur.</p></div>
            <div class="card">${compoHTML(nGame)}</div>
          </section>
          <section class="side">
            <div class="card">
              <h2>Réglages</h2>
              <div class="label">Maître du jeu</div>
              ${radio('mjMode', 'site', 'Le site (automatique)', 'Annonce les phases, réveille les rôles et compte les votes.')}
              ${radio('mjMode', 'joueur', 'Un joueur', 'Il voit tous les rôles, fait avancer la partie et ne joue pas.')}
              ${mjSelect}
              <div class="label" style="margin-top:8px">Distribution des rôles</div>
              ${radio('distribution', 'auto', 'Automatique selon le nombre', "Composition proposée, modifiable par l'hôte.")}
              ${radio('distribution', 'vote', 'Choisie par les joueurs', 'Chacun vote pour les rôles ; résultat révélé à tous en même temps.')}
              <div class="label" style="margin-top:8px">Extensions</div>
              <label class="check"><input type="checkbox" checked disabled> Jeu de base</label>
              ${check('nouvelleLune', 'Nouvelle Lune', s.extensions.nouvelleLune, 'ext.nouvelleLune')}
              ${check('personnages', 'Personnages', s.extensions.personnages, 'ext.personnages')}
              <div class="label" style="margin-top:8px">Règles</div>
              ${check('revealOnDeath', "Révéler le rôle d'un joueur mort", s.revealOnDeath)}
              ${check('deadSeeRoles', 'Les morts voient tous les rôles', s.deadSeeRoles)}
              <div class="row" style="justify-content:space-between"><label for="f-debate">Durée du débat</label>
                <select id="f-debate" data-set="debateSeconds" style="width:auto" ${dis}>
                  ${[[60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']].map(([v, l]) => `<option value="${v}" ${s.debateSeconds === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select></div>
            </div>
            ${warn.map((w) => `<div class="warn">${w}</div>`).join('')}
            ${host ? '<button class="primary" data-act="start">Lancer la partie</button>' : ''}
          </section>
        </div>
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
          : voteMode ? (key === 'loup' || key === 'villageois' ? '<span class="muted" style="font-size:13px">Automatique</span>' : '<span class="muted" style="font-size:13px">Soumis au vote</span>')
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
    return `<h2>Composition des rôles</h2>${summary}${groups}`;
  }

  // ----- Jeu -----
  function gameHTML() {
    const r = view.room, st = view.step, me = view.me;
    const phaseLabel = r.phase === 'end' ? 'Fin de partie'
      : r.phase === 'setup' ? 'Préparation'
      : (st && DAY_STEPS.includes(st.type)) || r.phase === 'day' ? `Jour ${Math.max(1, r.day)}` : `Nuit ${r.night}`;
    const isDay = document.body.dataset.theme === 'day';
    const right = `<span class="pill">${icon(isDay ? 'sun' : 'moon', 16)} ${phaseLabel}</span>${st && !st.resolved ? timerEl(st.deadline) : ''}`;
    let banner = '';
    if (r.phase === 'end' && r.winner) {
      banner = `<div class="end"><div class="label" style="color:inherit;opacity:.8">Fin de partie</div><div class="title">${esc(r.winner.text)}</div></div>`;
    } else if (st) {
      const txt = st.resolved && st.result && st.result.text ? st.result.text : st.narration;
      banner = `<div class="banner"><span class="label">${me.isMJ ? 'Toi (MJ)' : 'Le MJ'}</span><p>${esc(txt)}</p></div>`;
    }
    const deadNote = !me.alive && !me.isMJ && r.phase !== 'end'
      ? `<div class="note">Tu es mort : tu continues de suivre la partie${r.settings.deadSeeRoles ? ' et tu vois tous les rôles' : ''}, mais tu ne peux plus parler ni agir.</div>` : '';
    return header(right) + `<main>${banner}${deadNote}
      <div class="cols">
        <section class="main"><div class="grid">${view.players.filter((p) => !p.isMJ).map(tileHTML).join('')}</div></section>
        <aside class="side">${roleCardHTML()}${r.phase === 'end' ? endActionsHTML() : actionHTML()}${controlHTML()}${logHTML()}</aside>
      </div></main>`;
  }

  function tileHTML(p) {
    const st = view.step, me = view.me;
    const voted = st && !st.resolved && st.done.includes(p.id) && ['vote', 'captain_vote', 'debate', 'compoVote', 'roles_reveal'].includes(st.type);
    const tl = [];
    if (p.role) tl.push(`<span class="chip t-${teamOf(p.role)}">${esc(roleName(p.role))}</span>`);
    if (p.idiotRevealed) tl.push('<span class="chip">Ne vote plus</span>');
    if (!p.alive) tl.push('<span class="chip">Mort</span>');
    if (!p.connected) tl.push('<span class="chip">Déconnecté</span>');
    const tr = [];
    if (p.captain) tr.push(`<span class="chip cap" title="Capitaine">${icon('crown', 13, '#7A4210')}</span>`);
    if (p.lover || (me.lover === p.id)) tr.push(`<span class="chip" title="Amoureux">${icon('heart', 13, '#F08A6C')}</span>`);
    if (voted) tr.push(`<span class="chip" title="${st.type === 'debate' ? 'Prêt' : 'A voté'}">${icon('check', 13, '#7FC8A9')}</span>`);
    return `<div class="tile ${p.alive ? '' : 'dead'} ${p.id === me.id ? 'me' : ''}">
      <span class="avatar" style="background:${colorOf(p.id)}" aria-hidden="true">${esc(p.name[0])}</span>
      <div class="tl">${tl.join('')}</div><div class="tr">${tr.join('')}</div>
      <span class="nm">${esc(p.name)}${p.id === me.id ? ' (toi)' : ''}</span></div>`;
  }

  function roleCardHTML() {
    const me = view.me, r = view.room;
    if (me.isMJ) {
      return `<div class="card"><div class="label">Ton rôle</div><div class="bigrole">Maître du jeu</div>
        <p class="muted" style="margin:0">Tu vois tous les rôles et toutes les actions. Les votes restent secrets jusqu'à la révélation. Clique sur « Continuer » pour faire avancer la partie.</p></div>`;
    }
    if (!me.role) return '';
    const d = ROLES[me.role];
    const extra = [];
    if (me.wolves.length > 1) extra.push(`Ta meute : ${me.wolves.filter((w) => w !== me.id).map(nm).join(', ')}`);
    if (me.lover) extra.push(`${icon('heart', 14, '#F08A6C')} Tu es amoureux(se) de <strong>${nm(me.lover)}</strong> (${roleName(P(me.lover).role || '') || 'rôle inconnu'}). Si l'un meurt, l'autre aussi.`.replace(' (rôle inconnu)', ''));
    if (me.seen.length) extra.push('Tes visions : ' + me.seen.map((s) => `${esc(s.name)} → <span class="t-${teamOf(s.role)}">${esc(roleName(s.role))}</span>`).join(', '));
    if (r.potions) extra.push(`Potions : vie ${r.potions.life ? 'disponible' : 'utilisée'}, mort ${r.potions.death ? 'disponible' : 'utilisée'}`);
    if (!me.canVote) extra.push('Tu ne peux plus voter.');
    return `<div class="card"><div class="label">Ton rôle</div>
      <div class="bigrole t-${d.team}">${esc(d.name)}</div><div class="muted" style="font-size:14px">Équipe : ${TEAM[d.team]}</div>
      <p style="margin:0">${esc(d.desc)}</p>${extra.map((x) => `<div class="note">${x}</div>`).join('')}</div>`;
  }

  function targetOptions(st) {
    const me = view.me;
    let list = alivePlayers();
    switch (st.type) {
      case 'voyante': case 'vote': list = list.filter((p) => p.id !== me.id); break;
      case 'salvateur': list = list.filter((p) => p.id !== st.lastProtected); break;
      case 'loups': list = list.filter((p) => !me.wolves.includes(p.id)); break;
      case 'sorciere': list = list.filter((p) => p.id !== me.id); break;
    }
    return list;
  }

  function optsHTML(list, selected, act = 'sel') {
    return `<div class="opts">${list.map((p) => `<button class="opt ${selected.includes(p.id) ? 'on' : ''}" aria-pressed="${selected.includes(p.id)}" data-act="${act}" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
  }

  function progressHTML(st, verb) {
    if (st.actorsCount == null) return '';
    return `<div class="muted" style="font-size:14px">${st.done.length} / ${st.actorsCount} ${verb}</div>`;
  }

  function actionHTML() {
    const st = view.step, me = view.me, r = view.room;
    if (!st) return '';
    if (st.resolved) return `<div class="card">${resultHTML(st)}${r.waitingMJ ? (me.canControl ? '' : '<div class="muted">En attente du MJ…</div>') : st.nextAt ? `<div class="muted" style="font-size:14px">Suite dans <span data-deadline="${st.nextAt}"></span></div>` : ''}</div>`;
    if (!st.isActor) {
      const night = !DAY_STEPS.includes(st.type) && !['roles_reveal', 'compoVote'].includes(st.type);
      let txt = night ? (me.alive ? 'Le village dort… ferme les yeux et attends.' : 'Les vivants dorment.') : 'Tu ne participes pas à cette étape.';
      if (me.isMJ) txt = `En attente de : ${st.actors.filter((a) => !st.done.includes(a)).map(nm).join(', ') || '—'}`;
      return `<div class="card"><h2>${night ? 'Nuit' : 'Patiente'}</h2><p class="muted" style="margin:0">${txt}</p>${progressHTML(st, st.type === 'debate' ? 'prêts à voter' : 'ont agi')}</div>`;
    }
    const sent = st.submitted ? `<div class="note">${icon('check', 14)} Choix envoyé. Tu peux encore le changer avant la fin.</div>` : '';
    const sel = ui.sel.length ? ui.sel : st.myInput && typeof st.myInput === 'string' ? [st.myInput] : [];
    switch (st.type) {
      case 'roles_reveal':
        return `<div class="card"><h2>Découvre ton rôle</h2><p class="muted" style="margin:0">Lis ta carte ci-dessus, en secret.</p>
          ${st.submitted ? sent : '<button class="primary" data-act="ready">J\'ai vu mon rôle</button>'}${progressHTML(st, 'prêts')}</div>`;
      case 'compoVote': {
        const opts = Object.entries(ROLES).filter(([k, d]) => d.impl && k !== 'loup' && k !== 'villageois' && (d.ext === 'base' || r.settings.extensions[d.ext]));
        const cur = ui.cv || (Array.isArray(st.myInput) ? st.myInput : []);
        return `<div class="card"><h2>Quels rôles veux-tu ?</h2>
          ${opts.map(([k, d]) => `<label class="check"><input type="checkbox" data-act="cv" data-role="${k}" ${cur.includes(k) ? 'checked' : ''}> ${esc(d.name)}</label>`).join('')}
          <button class="primary" data-act="submit">Envoyer mon choix</button>${sent}${progressHTML(st, 'ont voté')}</div>`;
      }
      case 'debate':
        return `<div class="card"><h2>Débat</h2><p class="muted" style="margin:0">Discutez ! Le vote s'ouvre à la fin du temps, ou quand tout le monde est prêt.</p>
          ${st.submitted ? sent : '<button class="primary" data-act="ready">Je suis prêt à voter</button>'}${progressHTML(st, 'prêts à voter')}</div>`;
      case 'cupidon': {
        const cur = ui.sel.length ? ui.sel : Array.isArray(st.myInput) ? st.myInput : [];
        return `<div class="card"><h2>Désigne deux amoureux</h2>${optsHTML(alivePlayers(), cur, 'sel2')}
          <button class="primary" data-act="submit" ${cur.length === 2 ? '' : 'disabled'}>Valider${cur.length === 2 ? ` : ${nm(cur[0])} et ${nm(cur[1])}` : ''}</button>${sent}</div>`;
      }
      case 'sorciere': {
        const victim = st.victim ? `<div class="note">Les loups ont choisi <strong>${nm(st.victim)}</strong>.</div>` : '<div class="note">Les loups n\'ont choisi personne.</div>';
        const saveBox = st.victim && st.potions.life ? `<label class="check"><input type="checkbox" data-act="save" ${ui.save ? 'checked' : ''}> Utiliser la potion de vie sur ${nm(st.victim)}</label>` : '';
        const kill = st.potions.death ? `<div class="label">Potion de mort</div>${optsHTML(targetOptions(st), ui.kill ? [ui.kill] : [], 'kill')}` : '';
        return `<div class="card"><h2>Sorcière</h2>${victim}${saveBox}${kill}
          <button class="primary" data-act="submit">${ui.save || ui.kill ? 'Valider' : 'Ne rien faire'}</button>${sent}</div>`;
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
        if (st.type === 'vote' || st.type === 'captain_vote') extra += `<div class="note">${icon('lock', 14)} Ton vote reste caché. Tous les votes sont révélés au même instant.</div>`;
        const btnClass = st.type === 'loups' ? 'wolf' : 'primary';
        const abst = st.type === 'vote' || st.type === 'captain_vote' ? '<button data-act="abstain">S\'abstenir</button>' : '';
        return `<div class="card ${st.type}-step"><h2>${titles[st.type] || 'Ton action'}</h2>${optsHTML(targetOptions(st), sel)}
          <div class="row"><button class="${btnClass}" style="flex:1" data-act="submit" ${sel.length ? '' : 'disabled'}>Valider${sel.length ? ' : ' + nm(sel[0]) : ''}</button>${abst}</div>
          ${sent}${extra}${progressHTML(st, 'ont voté')}</div>`;
      }
    }
  }

  function resultHTML(st) {
    const res = st.result;
    if (!res) return '<h2>Étape terminée</h2>';
    if (st.type === 'vote' || st.type === 'captain_vote') {
      const max = Math.max(1, ...Object.values(res.tally));
      const bars = Object.entries(res.tally).sort((a, b) => b[1] - a[1]).map(([id, k]) => `
        <div><div class="row" style="justify-content:space-between;font-weight:600"><span>${nm(id)}</span><span>${k} voix</span></div>
        <div class="bar"><div style="width:${Math.round((k / max) * 100)}%"></div></div></div>`).join('');
      const list = res.choices.map((c) => `<div>${nm(c.voter)}${c.double ? ' (×2)' : ''} → <strong>${c.target ? nm(c.target) : 'abstention'}</strong></div>`).join('');
      return `<h2>Révélation des votes</h2><div class="bars">${bars || '<span class="muted">Aucun vote.</span>'}</div><div class="votes">${list}</div><div class="note">${esc(res.text)}</div>`;
    }
    if (st.type === 'voyante' && res.seen) return `<h2>Vision</h2><div class="bigrole">${nm(res.seen.id)} est <span class="t-${teamOf(res.seen.role)}">${esc(roleName(res.seen.role))}</span></div>`;
    if (st.type === 'loups' && 'victim' in res) return `<h2>Victime</h2><p style="margin:0">${res.victim ? `La meute a choisi <strong>${nm(res.victim)}</strong>.` : 'Aucune victime cette nuit.'}</p>`;
    if (st.type === 'compoVote') {
      const rows = Object.entries(res.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div>${esc(roleName(k))} : ${n} voix</div>`).join('') || '<span class="muted">Aucun vote.</span>';
      const compo = Object.entries(res.compo).map(([k, n]) => `${n} ${esc(roleName(k))}`).join(', ');
      return `<h2>Résultat du vote</h2><div class="votes">${rows}</div><div class="note">Composition retenue : ${compo}</div>`;
    }
    if (res.text) return `<h2>Annonce</h2><p style="margin:0">${esc(res.text)}</p>`;
    return '<h2>Étape terminée</h2>';
  }

  function controlHTML() {
    const me = view.me, r = view.room, st = view.step;
    if (!me.canControl || r.phase === 'end' || !st) return '';
    if (r.waitingMJ) return '<div class="card"><h2>Maître du jeu</h2><button class="primary" data-act="control">Continuer</button></div>';
    if (!st.resolved) {
      if (!me.isMJ && !['compoVote', 'roles_reveal', 'captain_vote', 'debate', 'vote'].includes(st.type)) return '';
      const label = st.type === 'debate' ? 'Ouvrir le vote maintenant' : "Clore l'étape maintenant";
      return `<div class="card"><h2>${me.isMJ ? 'Maître du jeu' : 'Hôte'}</h2><button data-act="control">${label}</button>
        <p class="muted" style="margin:0;font-size:13px">Les joueurs qui n'ont pas agi sont ignorés.</p></div>`;
    }
    return '';
  }

  function endActionsHTML() {
    return view.me.isHost ? '<div class="card"><button class="primary" data-act="restart">Nouvelle partie</button></div>' : '';
  }

  function logHTML() {
    if (!view.log.length) return '';
    return `<div class="card"><h2>Journal</h2><div class="log">${view.log.map((l) => `<div class="${l.pub ? '' : 'priv'}">${esc(l.text)}</div>`).join('')}</div></div>`;
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
        send('leave', {}, () => { sessionStorage.removeItem('lg'); view = null; render(); });
        break;
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
