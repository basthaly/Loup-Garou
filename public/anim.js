// Page cachée /animations : voir le ciel du site en grand, sans joueurs, pour choisir les animations à garder ou changer.
'use strict';
(() => {
  const AMBS = [
    ['', 'Aucune'], ['loups', 'Loups-Garous'], ['loupblanc', 'Loup-Garou Blanc'], ['cupidon', 'Cupidon'], ['voyante', 'Voyante'],
    ['sorciere', 'Sorcière'], ['voleur', 'Voleur'], ['flute', 'Joueur de flûte'],
  ];
  const ITEMS = [['cycle', 'Passage jour ↔ nuit'], ...AMBS.filter(([k]) => k)];
  const LS = 'lg-anim';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS) || '{}'); } catch { saved = {}; }
  const st = {
    theme: 'night', amb: '', loop: false, loopS: saved.loopS || 20, tour: false, tourS: saved.tourS || 15,
    speed: saved.speed || 1, dock: saved.dock ?? true, panel: true, focus: 'cycle', notes: saved.notes || {},
  };
  const save = () => { try { localStorage.setItem(LS, JSON.stringify({ loopS: st.loopS, tourS: st.tourS, speed: st.speed, dock: st.dock, notes: st.notes })); } catch { /* stockage indisponible */ } };
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.dataset.appearance = localStorage.getItem('lg-appearance') || (prefersDark ? 'dark' : 'light');
  const $ = document.getElementById('anim');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nameOf = (k) => (ITEMS.find(([x]) => x === k) || [k, k])[1];

  const dockH = () => (innerWidth <= 700 ? 190 : 140);
  function apply() {
    document.body.dataset.theme = st.theme;
    Sky.set(st.theme);
    Sky.amb(st.theme === 'night' ? st.amb : '');
    Sky.dock(st.dock ? dockH() : 0);
    Sky.place(true);
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
    $.innerHTML = `
      <div class="an-now">${st.theme === 'night' ? 'Nuit' : 'Jour'}<small>${st.theme === 'night' && st.amb ? 'Ambiance : ' + esc(nameOf(st.amb)) : 'Sans ambiance'}${st.speed !== 1 ? ' · vitesse ' + sp.find(([v]) => v === st.speed)[1] : ''}</small></div>
      ${st.dock ? `<div class="an-dock" style="height:${dockH()}px" aria-hidden="true">Place de la barre du bas (en jeu)</div>` : ''}
      <button class="an-btn an-toggle" data-a="panel" aria-expanded="${st.panel}">${st.panel ? 'Masquer le panneau (H)' : 'Réglages (H)'}</button>
      <section class="an-panel ${st.panel ? '' : 'hidden'}" aria-label="Réglages des animations">
        <div class="an-row"><b>Ciel</b><span class="an-seg">
          <button class="an-btn big ${st.theme === 'day' ? 'on' : ''}" data-a="theme" data-v="day">Jour</button>
          <button class="an-btn big ${st.theme === 'night' ? 'on' : ''}" data-a="theme" data-v="night">Nuit</button>
          <button class="an-btn ${st.loop ? 'on' : ''}" data-a="loop" aria-pressed="${st.loop}">${stDot('cycle')}Bascule auto</button></span>
          <label class="an-hint">toutes les <select class="an-sel" data-a="loopS">${[8, 12, 20, 30, 60].map((s) => `<option value="${s}" ${s === st.loopS ? 'selected' : ''}>${s} s</option>`).join('')}</select></label>
          <button class="an-btn ${f === 'cycle' ? 'on' : ''}" data-a="focus" data-v="cycle">Noter la bascule</button></div>
        <div class="an-row"><b>Ambiance</b><span class="an-seg">${AMBS.map(([k, l]) => `<button class="an-btn ${st.amb === k ? 'on' : ''}" data-a="amb" data-v="${k}">${k ? stDot(k) : ''}${esc(l)}</button>`).join('')}</span></div>
        <div class="an-row"><b>Défilé</b><span class="an-seg"><button class="an-btn" data-a="prev" aria-label="Ambiance précédente">‹ Précédente</button><button class="an-btn" data-a="next" aria-label="Ambiance suivante">Suivante ›</button>
          <button class="an-btn ${st.tour ? 'on' : ''}" data-a="tour" aria-pressed="${st.tour}">Défilé auto</button></span>
          <label class="an-hint">chacune <select class="an-sel" data-a="tourS">${[8, 15, 30, 60].map((s) => `<option value="${s}" ${s === st.tourS ? 'selected' : ''}>${s} s</option>`).join('')}</select></label></div>
        <div class="an-row"><b>Affichage</b><span class="an-seg">${sp.map(([v, l]) => `<button class="an-btn ${st.speed === v ? 'on' : ''}" data-a="speed" data-v="${v}">${l}</button>`).join('')}</span>
          <span class="an-seg"><button class="an-btn ${document.body.dataset.appearance === 'dark' ? 'on' : ''}" data-a="app" data-v="dark">Sombre</button><button class="an-btn ${document.body.dataset.appearance === 'light' ? 'on' : ''}" data-a="app" data-v="light">Clair</button></span>
          <button class="an-btn ${st.dock ? 'on' : ''}" data-a="dock" aria-pressed="${st.dock}">Place de la barre du bas</button></div>
        <div class="an-fb"><label>Ton avis · ${esc(nameOf(f))}</label><span class="an-seg">
          ${[['keep', 'Garder'], ['change', 'À changer'], ['drop', 'Retirer']].map(([v, l]) => `<button class="an-btn ${n.s === v ? 'on' : ''}" data-a="stat" data-v="${v}">${l}</button>`).join('')}</span>
          <textarea data-a="note" placeholder="Ce que tu changerais (couleur, vitesse, taille…)">${esc(n.t || '')}</textarea>
          <button class="an-btn" data-a="export">Copier mes retours</button></div>
        <span class="an-hint">Raccourcis : Espace = jour/nuit · flèches gauche/droite = ambiance · H = masquer le panneau. L'ambiance passe la nuit, comme en jeu.</span>
      </section>`;
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
    if (!b || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA') return;
    const a = b.dataset.a, v = b.dataset.v;
    if (a === 'theme') { st.theme = v; st.focus = 'cycle'; }
    else if (a === 'loop') { st.loop = !st.loop; st.focus = 'cycle'; setLoop(); }
    else if (a === 'amb') { st.amb = v; if (v) { st.theme = 'night'; st.focus = v; } }
    else if (a === 'prev') step(-1);
    else if (a === 'next') step(1);
    else if (a === 'tour') { st.tour = !st.tour; if (st.tour && !st.amb) step(1); setTour(); }
    else if (a === 'speed') { st.speed = +v; setLoop(); setTour(); save(); }
    else if (a === 'app') { document.body.dataset.appearance = v; try { localStorage.setItem('lg-appearance', v); } catch { /* */ } }
    else if (a === 'dock') { st.dock = !st.dock; save(); }
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
