// Le ciel vivant du site : ciel jour/nuit, soleil et lune sur un même cercle, village dont les fenêtres
// s'allument la nuit, et ambiances pendant le tour des rôles. Utilisé par app.js et par la page /animations.
'use strict';
// ---------- Le ciel vivant : soleil et lune sur un même cercle, village en bas dont les fenêtres s'allument la nuit ----------
window.Sky = (() => {
  // Animations complètes ou réduites : réglage du site (gardé dans le navigateur), sinon celui du téléphone/ordinateur.
  const motionQ = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = () => { let v = null; try { v = localStorage.getItem('lg-motion'); } catch { /* */ } return v === 'full' || v === 'calm' ? v : (motionQ.matches ? 'calm' : 'full'); };
  const applyMotion = () => document.body.classList.toggle('calm', motion() === 'calm');
  const setMotion = (v) => { try { localStorage.setItem('lg-motion', v); } catch { /* */ } applyMotion(); };
  applyMotion();
  motionQ.addEventListener?.('change', applyMotion);
  let el = null, orbit = null, theme = null, turn = 0, duskT = null, roofSvg = '';
  const rnd = (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
  function village() {
    const W = 1600, H = 170, out = [], wins = [], roofs = [];
    out.push(`<path class="sk-hill2" d="M0 ${H - 70} Q ${W * 0.15} ${H - 120} ${W * 0.32} ${H - 78} T ${W * 0.62} ${H - 86} T ${W} ${H - 74} L ${W} ${H} L 0 ${H} Z"/>`);
    out.push(`<path class="sk-hill1" d="M0 ${H - 40} Q ${W * 0.2} ${H - 70} ${W * 0.45} ${H - 46} T ${W} ${H - 50} L ${W} ${H} L 0 ${H} Z"/>`);
    let x = 6, k = 0;
    const R = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    while (x < W - 30) {
      const r = rnd();
      if (r < 0.22) {
        const h = R(46, 78), w = h * 0.45;
        out.push(`<path class="sk-h" d="M${x} ${H - 14} L${x + w / 2} ${H - 14 - h} L${x + w} ${H - 14} Z"/>`);
        x += w + R(2, 10);
      } else if (r < 0.27 && k > 3) {
        const w = 60, h = 70, b = H - 12;
        out.push(`<path class="sk-h" d="M${x} ${b} V${b - h} L${x + w / 2} ${b - h - 26} L${x + w} ${b - h} V${b} Z"/>`);
        roofs.push([x, b - h, x + w / 2, b - h - 26, x + w, b - h], [x + w * 0.38, b - h - 64, x + w / 2, b - h - 84, x + w * 0.62, b - h - 64]);
        out.push(`<path class="sk-h" d="M${x + w * 0.38} ${b - h - 20} V${b - h - 64} L${x + w / 2} ${b - h - 84} L${x + w * 0.62} ${b - h - 64} V${b - h - 20} Z"/>`);
        wins.push([x + w * 0.44, b - h - 52, 7, 12], [x + w * 0.42, b - h + 8, 10, 18]);
        x += w + 14;
      } else {
        const w = R(40, 70), h = R(30, 52), roof = R(14, 26), b = H - 12;
        out.push(`<path class="sk-h" d="M${x} ${b} V${b - h} L${x + w / 2} ${b - h - roof} L${x + w} ${b - h} V${b} Z"/>`);
        roofs.push([x, b - h, x + w / 2, b - h - roof, x + w, b - h]);
        out.push(`<rect class="sk-h" x="${x + w * 0.7}" y="${b - h - roof + 4}" width="7" height="${roof}"/>`);
        const n = R(1, 2);
        for (let j = 0; j < n; j++) wins.push([n === 1 ? x + w / 2 - 5 : x + 8 + j * (w - 25), b - h + 10, 9, 11]);
        x += w + R(4, 16);
      }
      k++;
    }
    const lit = [];
    for (const [wx, wy, ww, wh] of wins) {
      const r = `x="${Math.round(wx)}" y="${Math.round(wy)}" width="${ww}" height="${wh}" rx="1.5"`;
      out.push(`<rect class="sk-wo" ${r}/>`);
      const g = `x="${Math.round(wx) - 5}" y="${Math.round(wy) - 5}" width="${ww + 10}" height="${wh + 10}" rx="6"`;
      lit.push(`<g class="sk-win" style="--wd:${(rnd() * 1.6).toFixed(2)}s"><rect class="sk-glow" ${g}/><rect ${r}/></g>`);
    }
    out.push(`<rect class="sk-h" x="0" y="${H - 14}" width="${W}" height="14"/>`);
    // Deux silhouettes (jour, nuit) en fondu, et les fenêtres allumées par-dessus : tout bouge en opacité, sans repeindre les couleurs.
    const svg = (c, body) => `<svg class="sk-village ${c}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${body}</svg>`;
    // Pour le Voleur : des reflets d'or qui glissent le long des toits (gardés pour l'ambiance, posés au même endroit que le village).
    roofSvg = svg('ab-roofs', roofs.map(([a, b, c, d, e, f]) => `<path class="ab-roof" style="animation-delay:${(rnd() * 4.5).toFixed(2)}s" d="M${a} ${b} L${c} ${d} L${e} ${f}"/>`).join(''));
    return svg('sk-vd', out.join('')) + svg('sk-vn', out.join('')) + svg('sk-vl', lit.join(''));
  }
  function build() {
    el = document.createElement('div');
    el.id = 'sky'; el.className = 'still'; el.setAttribute('aria-hidden', 'true');
    // Étoiles en trois groupes qui scintillent chacun à leur rythme (trois calques au lieu d'un par étoile).
    let stars = '';
    for (let gi = 0; gi < 3; gi++) {
      let g = '';
      for (let i = 0; i < 28; i++) g += `<i style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 60).toFixed(1)}%;--s:${[1, 1, 1.5, 2][Math.floor(rnd() * 4)]}px"></i>`;
      stars += `<div class="sk-sg">${g}</div>`;
    }
    const clouds = [[6, 9, 130], [34, 16, 95], [74, 7, 150]].map(([l, t, w]) => `<span class="sk-cloud" style="left:${l}%;top:${t}%;width:${w}px"></span>`).join('');
    el.innerHTML = `<div class="sk-l sk-day"></div><div class="sk-l sk-dusk"></div><div class="sk-l sk-night"></div><div class="sk-l sk-stars">${stars}</div><div class="sk-l sk-clouds">${clouds}</div><div class="sk-veil"></div><div class="sk-clip"><div class="sk-pos"><div class="sk-orbit"><span class="sk-sun"></span><span class="sk-moon"></span></div></div></div>${village()}`;
    document.body.insertBefore(el, document.body.firstChild);
    orbit = el.querySelector('.sk-orbit');
    buildAmb();
  }
  function set(t) {
    if (!el) build();
    if (t === theme) return;
    const first = theme === null;
    theme = t;
    // Toujours dans le même sens : le soleil se couche à droite, la lune se lève à gauche, et inversement au matin.
    turn = first ? (t === 'night' ? 180 : 0) : turn + 180;
    orbit.style.transform = `rotate(${turn}deg)`;
    el.dataset.sky = t;
    if (first) { requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('still'))); return; }
    el.classList.add('dusk');
    clearTimeout(duskT);
    duskT = setTimeout(() => el.classList.remove('dusk'), 1300);
  }
  // ---- Ambiances des rôles : couches posées une fois, montrées selon data-amb ----
  let amb = '';
  function buildAmb() {
    const eyes = (cls, spots) => spots.map(([l, b, d]) => `<span class="sk-eyes ${cls}" style="left:${l}%;bottom:${b}%;animation-delay:${d}s"><i style="animation-delay:${d}s"></i><i style="animation-delay:${d}s"></i></span>`).join('');
    const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.4 3.3 5 6.8 5c2 0 3.6 1.1 4.2 2.6C11.6 6.1 13.2 5 15.2 5c3.5 0 5.6 3.4 4.3 6.7C19.5 16.4 12 21 12 21z" fill="#FF8FB1"/></svg>';
    const box = document.createElement('div');
    box.className = 'sk-amb';
    box.innerHTML = `
      <div class="ab ab-loups"><div class="ab-vil">${eyes('', [[9, 34, 0], [27, 22, 0.8], [46, 38, 1.6], [64, 26, 2.4], [83, 32, 3.2], [95, 20, 1.2]])}</div></div>
      <div class="ab ab-loupblanc"><div class="ab-vil">${eyes('white', [[31, 30, 0], [72, 34, 1.8]])}</div></div>
      <div class="ab ab-cupidon"><div class="ab-vil">${[5, 14, 24, 33, 43, 52, 62, 71, 81, 90].map((l, i) => `<span class="ab-heart" style="left:${l}%;animation-delay:${(i * 0.6).toFixed(1)}s">${heart}</span>`).join('')}</div><span class="ab-streak"></span></div>
      <div class="ab ab-voyante"><div class="ab-aur a1"></div><div class="ab-aur a2"></div>${[[18, 30, 0], [42, 22, 1.2], [66, 36, 2.4], [84, 18, 3.6], [30, 46, 1.8]].map(([l, t, d]) => `<span class="ab-mote" style="left:${l}%;top:${t}%;animation-delay:${d}s"></span>`).join('')}</div>
      <div class="ab ab-sorciere"><div class="ab-vil">${[[7, 0], [19, 2.6], [31, 1.1], [44, 3.9], [56, 0.6], [68, 2.2], [80, 4.6], [92, 1.6]].map(([l, d], k) => `<span class="ab-bub${k % 2 ? ' v' : ''}" style="left:${l}%;animation-delay:${d}s"></span>`).join('')}</div></div>
      <div class="ab ab-voleur">${roofSvg}</div>
      <div class="ab ab-flute"><div class="ab-vil">${['♪', '♫', '♪', '♬', '♪', '♫', '♪'].map((g, i) => `<span class="ab-note" style="animation-delay:${i * 2}s,${-i * 0.8}s">${g}</span>`).join('')}</div></div>`;
    el.appendChild(box);
  }
  function setAmb(k) {
    if (!el) build();
    if (k === amb) return;
    amb = k;
    el.dataset.amb = k;
  }
  function dock(h) { document.body.style.setProperty('--dock-h', `${Math.round(h)}px`); place(); }
  // Où poser le soleil et la lune : on note chaque place possible selon ce qu'on y voit du ciel
  // (1 = ciel libre, 0,5 = derrière le verre dépoli d'une barre, 0 = vignette, panneau, texte, bouton),
  // puis on garde la place actuelle si elle reste bonne, sinon la meilleure, au plus près du coin haut-droit.
  let px = null, py = null, placeT = null, lastScan = 0, zoneKey = '', zx = 0, zoff = 0;
  let opq = new WeakMap();
  const SOLID = new Set(['IMG', 'VIDEO', 'CANVAS', 'svg', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'A']);
  function look(e) { // 0 transparent, 1 verre dépoli, 2 opaque
    if (opq.has(e)) return opq.get(e);
    const cs = getComputedStyle(e);
    const bf = cs.backdropFilter || cs.webkitBackdropFilter;
    const m = cs.backgroundColor.match(/[\d.]+/g);
    const a = !m ? 0 : m.length > 3 ? +m[3] : 1;
    const v = bf && bf !== 'none' ? 1 : (a > 0.05 || cs.backgroundImage !== 'none') ? 2 : 0; // même un panneau très transparent (cimetière, meute) cache l'astre
    opq.set(e, v);
    return v;
  }
  function seen(x, y) {
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return 0;
    const el = document.elementFromPoint(x, y);
    if (!el) return 0;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return 0;
    let glass = false;
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      if (SOLID.has(e.tagName)) return 0;
      const v = look(e);
      if (v === 2) return 0;
      if (v === 1) glass = true;
    }
    return glass ? 0.5 : 1;
  }
  function place(force) {
    clearTimeout(placeT);
    const wait = force ? 0 : Math.max(250, 1200 - (Date.now() - lastScan));
    placeT = setTimeout(() => {
      if (!el || [...document.querySelectorAll('.drawer.open, .reveal-scrim')].some((e) => e.offsetWidth)) return; // un panneau ouvert cache tout : on ne bouge pas
      lastScan = Date.now();
      if (Math.random() < 0.05) opq = new WeakMap();
      const W = innerWidth, H = innerHeight;
      const dk = parseFloat(getComputedStyle(document.body).getPropertyValue('--dock-h')) || 0;
      const vil = W <= 700 ? 96 : Math.max(150, W * 0.10625); // même hauteur que le village (style.css)
      const rad = W <= 700 ? 30 : 42, s = rad;
      const x0 = rad, y0 = rad, x1 = W - rad, y1 = H - dk - vil * 0.45; // jusqu'au faîte des toits : l'astre peut se poser derrière le village
      const memo = new Map();
      const at = (x, y) => { const k = x + ',' + y; if (!memo.has(k)) memo.set(k, seen(x, y)); return memo.get(k); };
      // On sonde tout le disque (13 points : centre, deux cercles et diagonales) pour ne pas se croire visible dans l'espace étroit entre deux vignettes.
      const h = Math.round(s / 2), dg = Math.round(s * 0.7);
      const OFF = [[0, 0, 2], [-s, 0, 1], [s, 0, 1], [0, -s, 1], [0, s, 1], [-h, 0, 1], [h, 0, 1], [0, -h, 1], [0, h, 1], [-dg, -dg, 1], [dg, -dg, 1], [-dg, dg, 1], [dg, dg, 1]];
      const score = (x, y) => { let t = 0; for (const [dx, dy, w] of OFF) t += w * at(x + dx, y + dy); return t; }; // sur 14
      const snap = (v, o) => o + Math.round((v - o) / s) * s;
      // Une zone fixe par écran (accueil, salon, partie) et par taille de fenêtre : on la choisit une fois,
      // puis l'astre ne fait que de petits déplacements autour, s'il est vraiment caché.
      const scr = document.body.dataset.screen || '';
      const zkey = `${scr}|${W}|${H}`;
      const R = W <= 700 ? 70 : 130;
      // Sur grand écran, la bande au-dessus des toits reste toujours libre (accueil, salon, partie) : même zone partout,
      // à droite, bien au-dessus des toits (il s'y couche derrière les maisons). Sur téléphone, en haut à droite.
      const home = W > 700 ? [W * 0.78, H - dk - vil * 0.73] : [W * 0.76, H * 0.3]; // juste au-dessus des toits, sous le contenu
      // La place bien dégagée la plus proche du but ; à défaut, la moins cachée la plus proche (dans la zone si on en a une).
      const search = (tx, ty, zone) => {
        let good = null, gd = Infinity, fair = null, fd = Infinity;
        for (let y = y0; y <= y1; y += s) for (let x = x0; x <= x1; x += s) {
          if (zone && (Math.abs(x - tx) > R || Math.abs(y - ty) > R)) continue;
          const sc = score(x, y);
          if (sc < 10.5) continue;
          const d = Math.hypot(x - tx, (y - ty) * 1.4);
          if (sc >= 14 && d < gd) { gd = d; good = [x, y]; }
          if (d < fd) { fd = d; fair = [x, y]; }
        }
        return good || fair;
      };
      let best = null;
      if (zkey === zoneKey) {
        const zy = H - dk - zoff;
        if (px !== null && Math.abs(py - zy) <= R && Math.abs(px - zx) <= R && score(snap(px, x0), snap(py, y0)) >= 13) return; // encore bien visible et dans sa zone : on ne bouge pas
        best = search(zx, zy, true);
      }
      if (!best) { // pas encore de zone, ou plus aucune place dans la sienne : on en choisit une nouvelle
        best = search(home[0], home[1], false);
        if (!best) return; // aucune place : on garde la position
        zoneKey = zkey; zx = best[0]; zoff = H - dk - best[1]; // la zone suit le village (hauteur au-dessus de la barre du bas)
      }
      if (px === null) { el.classList.add('still'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('still'))); }
      [px, py] = best;
      el.style.setProperty('--px', `${px}px`);
      el.style.setProperty('--py', `${py}px`);
    }, wait);
  }
  addEventListener('scroll', () => place(), { passive: true });
  return { set, dock, place, amb: setAmb, motion, setMotion };
})();
