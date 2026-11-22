// Petites animations posées sur les vignettes des joueurs (Voyante, Sorcière, Salvateur, griffes des loups,
// flèche de Cupidon, tir du Chasseur, mort au matin). Elles vivent dans un calque à part, au-dessus des vignettes :
// le jeu peut redessiner la page autant qu'il veut, l'animation continue. Utilisé par app.js et la page /animations.
'use strict';
window.FX = (() => {
  let layer = null;
  const live = new Set();
  const DUR = { claw: 2800, ring: 2400, flip: 3000, save: 3200, poison: 3200, shield: 2800, scope: 2600, death: 3600, arrow: 3400 };
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.4 3.3 5 6.8 5c2 0 3.6 1.1 4.2 2.6C11.6 6.1 13.2 5 15.2 5c3.5 0 5.6 3.4 4.3 6.7C19.5 16.4 12 21 12 21z" fill="#FF8FB1"/></svg>';
  let tileOf = (id) => document.querySelector(`.stage .tile[data-speak="${CSS.escape(id)}"]`) || document.querySelector(`.tile[data-speak="${CSS.escape(id)}"]`);
  function ensure() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'fx';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    return layer;
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function inner(kind, o) {
    switch (kind) {
      case 'claw': return '<span class="fx-prey"></span><span class="fx-weyes"><i></i><i></i></span>'; // la victime : l'ombre rouge des loups et deux yeux qui s'ouvrent
      case 'flip': return `<div class="fx-card"><div class="fx-in"><div class="fx-f"></div><div class="fx-b">${o.src ? `<img src="${esc(o.src)}" alt="">` : ''}</div></div></div><span class="fx-shine"></span>${[0, 1, 2, 3].map((i) => `<i class="fx-spark s${i}"></i>`).join('')}`;
      case 'save': return `<span class="fx-glow"></span>${[0, 1, 2, 3, 4, 5].map((i) => `<i class="fx-bub b${i}"></i>`).join('')}`;
      case 'poison': return `<span class="fx-dim"></span>${[0, 1, 2, 3].map((i) => `<i class="fx-smoke k${i}"></i>`).join('')}`;
      case 'shield': return '<svg class="fx-shield" viewBox="0 0 150 150"><path d="M75 12 L128 32 V72 C128 104 104 128 75 140 C46 128 22 104 22 72 V32 Z"/></svg>';
      case 'scope': return '<svg class="fx-scope" viewBox="0 0 120 120"><circle cx="60" cy="60" r="44"/><circle cx="60" cy="60" r="3"/><line x1="60" y1="4" x2="60" y2="28"/><line x1="60" y1="92" x2="60" y2="116"/><line x1="4" y1="60" x2="28" y2="60"/><line x1="92" y1="60" x2="116" y2="60"/></svg><span class="fx-flash"></span>';
      case 'death': return `<span class="fx-grey"></span><span class="fx-candle"></span>${o.src ? `<span class="fx-reveal"><img src="${esc(o.src)}" alt=""></span>` : ''}`;
      case 'ring': return `<span class="fx-ring"></span>${[0, 1, 2].map((i) => `<i class="fx-heart h${i}">${HEART}</i>`).join('')}`;
      default: return '';
    }
  }
  function box(el, id) {
    const t = tileOf(id);
    if (!t) return false;
    const r = t.getBoundingClientRect();
    if (!r.width) return false;
    Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: getComputedStyle(t).borderRadius });
    return true;
  }
  function add(el, ms) {
    ensure().appendChild(el);
    live.add(el);
    setTimeout(() => { el.remove(); live.delete(el); }, ms);
  }
  // kind : claw | flip | save | poison | shield | scope | death | arrow ; ids : vignettes visées ; src : image de carte.
  function play(kind, o = {}) {
    if (document.body.classList.contains('calm')) return; // animations réduites : on n'en joue pas
    const ids = (o.ids || []).filter(Boolean);
    if (kind === 'arrow') return arrow(ids);
    for (const id of ids) {
      const el = document.createElement('div');
      el.className = `fx fx-${kind}-box`;
      const g = o.ghosts && o.ghosts[id];
      if (g && !tileOf(id)) {
        // La vignette a quitté la grille (mort) : on rejoue sur son fantôme, à sa place d'avant, qui s'efface ensuite.
        el.classList.add('fx-ghostbox');
        el.style.setProperty('--fxd', `${DUR[kind] || 3000}ms`);
        Object.assign(el.style, { left: `${g.rect.left}px`, top: `${g.rect.top}px`, width: `${g.rect.width}px`, height: `${g.rect.height}px`, borderRadius: g.radius });
        el.innerHTML = `<div class="fx-ghost">${g.html}</div>${inner(kind, o)}`;
        el.querySelectorAll('.fx-ghost [data-vslot], .fx-ghost .kick, .fx-ghost .tile-tools').forEach((x) => x.remove());
      } else {
        el.dataset.id = id;
        el.innerHTML = inner(kind, o);
        if (!box(el, id)) continue;
      }
      add(el, DUR[kind] || 3000);
    }
  }
  // Cupidon : des cœurs s'envolent des deux vignettes, qui s'entourent d'un liseré rose (sans flèche).
  function arrow(ids) { play('ring', { ids }); }
  // Après chaque rendu : les animations suivent leur vignette si la grille a bougé.
  function sync() {
    if (!layer) return;
    const hide = [...document.querySelectorAll('.drawer.open')].some((d) => d.offsetWidth);
    layer.style.visibility = hide ? 'hidden' : '';
    for (const el of live) if (el.dataset.id && !box(el, el.dataset.id)) el.style.visibility = 'hidden';
  }
  addEventListener('resize', sync);
  addEventListener('scroll', sync, { passive: true });
  return { play, sync, setTileOf: (f) => { tileOf = f; } };
})();
