// Page cachée /animations : voir le ciel du site en grand, sans joueurs, pour choisir les animations à garder ou changer.
'use strict';
(() => {
  const AMBS = [
    ['', 'Aucune'], ['loups', 'Loups-Garous'], ['loupblanc', 'Loup-Garou Blanc'], ['cupidon', 'Cupidon'], ['voyante', 'Voyante'],
    ['sorciere', 'Sorcière'], ['voleur', 'Voleur'], ['flute', 'Joueur de flûte'],
  ];
  // Petites animations sur les vignettes (vues seulement par ceux qui ont le droit) : on les joue sur des vignettes d'exemple.
  const FXS = [['fx-claw', 'Loups : la victime'], ['fx-arrow', 'Cupidon : cœurs'], ['fx-flip', 'Voyante : carte'], ['fx-save', 'Sorcière : vie'],
    ['fx-poison', 'Sorcière : poison'], ['fx-shield', 'Salvateur'], ['fx-scope', 'Chasseur : tir'], ['fx-death', 'Mort au matin']];
  const ITEMS = [['cycle', 'Passage jour ↔ nuit'], ...AMBS.filter(([k]) => k), ...FXS];
  const DEMO = [['d1', 'Inès', '#7FD1AE'], ['d2', 'Marc', '#C9A7F5'], ['d3', 'Hugo', '#F2B05E'], ['d4', 'Léa', '#8AB4F8']];
  const LS = 'lg-anim';
  // (la barre du bas de cette page prend la place de celle du jeu : le village se pose dessus)
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS) || '{}'); } catch { saved = {}; }
  let fxT = null;
  function playFx(k) {
    const kind = k.slice(3);
    const ids = kind === 'arrow' ? ['d1', 'd4'] : ['d2'];
    const src = kind === 'flip' ? '/cards/loup.webp' : kind === 'death' ? '/cards/villageois.webp' : '';
    FX.play(kind, { ids, src });
  }
  function setFxLoop() {
    clearInterval(fxT);
    if (st.fx && st.fxLoop) fxT = setInterval(() => playFx(st.fx), 4500 / st.speed);
  }
  const st = {
    theme: 'night', amb: '', loop: false, loopS: saved.loopS || 20, tour: false, tourS: saved.tourS || 15,
    speed: saved.speed || 1, panel: true, focus: 'cycle', notes: saved.notes || {}, fx: '', fxLoop: true,
  };
  const save = () => { try { localStorage.setItem(LS, JSON.stringify({ loopS: st.loopS, tourS: st.tourS, speed: st.speed, notes: st.notes })); } catch { /* stockage indisponible */ } };
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.dataset.appearance = localStorage.getItem('lg-appearance') || (prefersDark ? 'dark' : 'light');
  const $ = document.getElementById('anim');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nameOf = (k) => (ITEMS.find(([x]) => x === k) || [k, k])[1];

  function apply() {
    document.body.dataset.theme = st.theme;
    Sky.set(st.theme);
    Sky.amb(st.theme === 'night' ? st.amb : '');
  }
  // Ralenti : on règle la vitesse de toutes les animations et transitions en cours (elles naissent à chaque changement).
  setInterval(() => { for (const a of document.getAnimations()) if (a.playbackRate !== st.speed) a.playbackRate = st.speed; }, 120);

  let loopT = null, tourT = null;
  function setLoop() {
    clearInterval(loopT);
    if (st.loop) loopT = setInterval(() => { st.theme = st.theme === 'night' ? 'day' : 'night'; apply(); render(); }, st.loopS * 1000 / st.speed);
  }
  function setTour() {
    clearInterval(tourT);
    if (st.tour) tourT = setInterval(() => step(1), st.tourS * 1000 / st.speed);
  }
  function step(d) {
    const keys = AMBS.map(([k]) => k).filter(Boolean);
    const i = keys.indexOf(st.amb);
    st.amb = keys[(i + d + keys.length) % keys.length];
    st.theme = 'night'; st.focus = st.amb;
    apply(); render();
  }

  function stDot(k) { const s = (st.notes[k] || {}).s; return `<span class="st ${s || ''}" aria-hidden="true"></span>`; }
  function render() {
    const f = st.focus, n = st.notes[f] || {};
    const sp = [[0.25, '×¼'], [0.5, '×½'], [1, '×1'], [2, '×2']];
    const calm = Sky.motion() === 'calm';
    const sel = (a, list, v) => `<select class="an-sel" data-a="${a}" aria-label="Durée">${list.map((x) => `<option value="${x}" ${x === v ? 'selected' : ''}>${x} s</option>`).join('')}</select>`;
    $.innerHTML = `
      <div class="an-now">${st.theme === 'night' ? 'Nuit' : 'Jour'}<small>${st.theme === 'night' && st.amb ? 'Ambiance : ' + esc(nameOf(st.amb)) : 'Sans ambiance'}${st.speed !== 1 ? ' · vitesse ' + sp.find(([v]) => v === st.speed)[1] : ''}</small></div>
      ${st.fx ? `<main class="stage an-stage"><div class="an-tiles">${DEMO.map(([id, nm, c]) => `<div class="tile" data-speak="${id}"><span class="avatar" style="background:${c}">${nm[0]}</span><span class="nm">${nm}</span></div>`).join('')}</div></main>` : ''}
      ${st.panel ? '' : '<button class="an-btn an-show" data-a="panel">Réglages (H)</button>'}
      <section class="an-bar ${st.panel ? '' : 'hidden'}" aria-label="Réglages des animations"><div class="an-in">
        ${calm ? `<div class="an-warn"><span>Ton appareil demande des <b>animations réduites</b> : le soleil, la lune et les ambiances ne bougent presque pas.</span><button class="an-btn on" data-a="motion" data-v="full">Voir les animations complètes</button></div>` : ''}
        <div class="an-row">
          <span class="an-lab">Ciel</span><span class="an-seg">
            <button class="an-btn ${st.theme === 'day' ? 'on' : ''}" data-a="theme" data-v="day">Jour</button>
            <button class="an-btn ${st.theme === 'night' ? 'on' : ''}" data-a="theme" data-v="night">Nuit</button>
            <button class="an-btn ${st.loop ? 'on' : ''}" data-a="loop" aria-pressed="${st.loop}">${stDot('cycle')}Bascule auto</button></span>${sel('loopS', [8, 12, 20, 30, 60], st.loopS)}
          <span class="an-sep"></span>
          <span class="an-lab">Ambiance</span><span class="an-seg">${AMBS.map(([k, l]) => `<button class="an-btn ${st.amb === k ? 'on' : ''}" data-a="amb" data-v="${k}">${k ? stDot(k) : ''}${esc(l)}</button>`).join('')}</span>
          <span class="an-seg"><button class="an-btn" data-a="prev" aria-label="Ambiance précédente">‹</button><button class="an-btn" data-a="next" aria-label="Ambiance suivante">›</button><button class="an-btn ${st.tour ? 'on' : ''}" data-a="tour" aria-pressed="${st.tour}">Défilé auto</button></span>${sel('tourS', [8, 15, 30, 60], st.tourS)}
        </div>
        <div class="an-row">
          <span class="an-lab">Sur les vignettes</span><span class="an-seg">${FXS.map(([k, l]) => `<button class="an-btn ${st.fx === k ? 'on' : ''}" data-a="fx" data-v="${k}">${stDot(k)}${esc(l)}</button>`).join('')}</span>
          <button class="an-btn ${st.fxLoop ? 'on' : ''}" data-a="fxloop" aria-pressed="${st.fxLoop}">Rejouer en boucle</button>
        </div>
        <div class="an-row">
          <span class="an-lab">Vitesse</span><span class="an-seg">${sp.map(([v, l]) => `<button class="an-btn ${st.speed === v ? 'on' : ''}" data-a="speed" data-v="${v}">${l}</button>`).join('')}</span>
          <span class="an-seg"><button class="an-btn ${document.body.dataset.appearance === 'dark' ? 'on' : ''}" data-a="app" data-v="dark">Sombre</button><button class="an-btn ${document.body.dataset.appearance === 'light' ? 'on' : ''}" data-a="app" data-v="light">Clair</button></span>
          <span class="an-seg"><button class="an-btn ${calm ? '' : 'on'}" data-a="motion" data-v="full">Animations complètes</button><button class="an-btn ${calm ? 'on' : ''}" data-a="motion" data-v="calm">Réduites</button></span>
          <span class="an-sep"></span>
          <span class="an-lab">Avis · ${esc(nameOf(f))}</span><span class="an-seg">
            ${[['keep', 'Garder'], ['change', 'À changer'], ['drop', 'Retirer']].map(([v, l]) => `<button class="an-btn ${n.s === v ? 'on' : ''}" data-a="stat" data-v="${v}">${l}</button>`).join('')}
            <button class="an-btn ${f === 'cycle' ? 'on' : ''}" data-a="focus" data-v="cycle" title="Noter la bascule jour/nuit">Bascule</button></span>
          <input class="an-note" data-a="note" value="${esc(n.t || '')}" placeholder="Ce que tu changerais (couleur, vitesse, taille…)" aria-label="Note">
          <button class="an-btn" data-a="export">Copier mes retours</button>
          <button class="an-btn" data-a="panel" title="Masquer la barre (H)">Masquer</button>
        </div></div></section>`;
    const bar = $.querySelector('.an-bar');
    Sky.dock(st.panel && bar ? bar.offsetHeight : 0);
    Sky.place(true);
  }
  function exportText() {
    const lines = ITEMS.map(([k, l]) => { const n = st.notes[k] || {}; const s = { keep: 'Garder', change: 'À changer', drop: 'Retirer' }[n.s] || '—'; return `- ${l} : ${s}${n.t ? ' — ' + n.t.trim() : ''}`; });
    return `Retours animations :\n${lines.join('\n')}`;
  }
  function showExport() {
    const txt = exportText();
    const o = document.createElement('div');
    o.className = 'an-out';
    o.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Mes retours"><b>Tes retours (copiés, colle-les dans la discussion)</b><textarea readonly>${esc(txt)}</textarea><button class="an-btn big" data-close>Fermer</button></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', (e) => { if (e.target === o || e.target.closest('[data-close]')) o.remove(); });
    const ta = o.querySelector('textarea'); ta.focus(); ta.select();
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
  }

  $.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA' || b.tagName === 'INPUT') return;
    const a = b.dataset.a, v = b.dataset.v;
    if (a === 'theme') { st.theme = v; st.focus = 'cycle'; }
    else if (a === 'loop') { st.loop = !st.loop; st.focus = 'cycle'; setLoop(); }
    else if (a === 'amb') { st.amb = v; if (v) { st.theme = 'night'; st.focus = v; } }
    else if (a === 'prev') step(-1);
    else if (a === 'next') step(1);
    else if (a === 'tour') { st.tour = !st.tour; if (st.tour && !st.amb) step(1); setTour(); }
    else if (a === 'speed') { st.speed = +v; setLoop(); setTour(); setFxLoop(); save(); }
    else if (a === 'app') { document.body.dataset.appearance = v; try { localStorage.setItem('lg-appearance', v); } catch { /* */ } }
    else if (a === 'motion') Sky.setMotion(v);
    else if (a === 'fx') { st.fx = st.fx === v ? '' : v; st.focus = st.fx || 'cycle'; setFxLoop(); if (st.fx) setTimeout(() => playFx(st.fx), 60); }
    else if (a === 'fxloop') { st.fxLoop = !st.fxLoop; setFxLoop(); }
    else if (a === 'focus') st.focus = v;
    else if (a === 'stat') { const n = st.notes[st.focus] || (st.notes[st.focus] = {}); n.s = n.s === v ? '' : v; save(); }
    else if (a === 'export') { showExport(); return; }
    else if (a === 'panel') st.panel = !st.panel;
    if (a !== 'prev' && a !== 'next') { apply(); render(); }
  });
  $.addEventListener('change', (e) => {
    const a = e.target.dataset.a;
    if (a === 'loopS') { st.loopS = +e.target.value; setLoop(); save(); }
    if (a === 'tourS') { st.tourS = +e.target.value; setTour(); save(); }
  });
  $.addEventListener('input', (e) => {
    if (e.target.dataset.a !== 'note') return;
    const n = st.notes[st.focus] || (st.notes[st.focus] = {});
    n.t = e.target.value; save();
  });
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('textarea, select, input')) return;
    if (e.key === ' ') { e.preventDefault(); st.theme = st.theme === 'night' ? 'day' : 'night'; st.focus = 'cycle'; apply(); render(); }
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'h' || e.key === 'H') { st.panel = !st.panel; render(); }
  });
  addEventListener('resize', () => { apply(); render(); });
  apply(); render();
})();
