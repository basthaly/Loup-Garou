// Page cachée /audio : table de mixage de l'ambiance, valeurs à copier.
(() => {
  const A = window.LGAmbience, M = A.mixer;
  const $ = (id) => document.getElementById(id);
  let mood = 'night';
  const fmt = (db) => (db <= -60 ? '−∞' : `${db > 0 ? '+' : ''}${db.toFixed(1)}`);

  function strips() {
    const mix = M.get()[mood];
    $('strips').innerHTML = `<h3 style="margin:0">${mood === 'night' ? 'Nuit' : 'Jour'}</h3>` + Object.entries(M.SOURCES).map(([k, label]) => `
      <div class="strip">
        <b>${label}</b>
        <input type="range" min="-60" max="12" step="0.5" value="${mix[k]}" data-k="${k}" aria-label="${label} en dB">
        <span class="db"><input type="number" min="-60" max="12" step="0.5" value="${mix[k]}" data-n="${k}" aria-label="${label}, valeur en dB"></span>
        <div class="m-wrap"><div class="meter"><i id="mt-${k}"></i></div><div class="lvl" id="lv-${k}">—</div></div>
        <div class="tools">${k === 'out' ? '' : `<button class="s ${M.isSolo(k) ? 'on' : ''}" data-solo="${k}" title="Écouter seul">S</button><button class="m ${M.isMuted(k) ? 'on' : ''}" data-mute="${k}" title="Couper">M</button>`}</div>
      </div>`).join('');
    output();
  }

  function output() {
    const m = M.get();
    const line = (md) => Object.entries(M.SOURCES).map(([k, l]) => `${l} ${fmt(m[md][k])} dB`).join(' · ');
    $('out').value = `Ambiance Loup-Garou — niveaux en dB (0 = niveau de base, -60 = coupé)\nNuit : ${line('night')}\nJour : ${line('day')}\n${JSON.stringify(m)}`;
  }

  document.addEventListener('input', (e) => {
    const k = e.target.dataset.k || e.target.dataset.n;
    if (!k) return;
    const v = parseFloat(e.target.value);
    if (Number.isNaN(v)) return;
    M.set(mood, k, v);
    const other = e.target.dataset.k ? document.querySelector(`[data-n="${k}"]`) : document.querySelector(`[data-k="${k}"]`);
    if (other) other.value = v;
    output();
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.solo) { M.toggleSolo(t.dataset.solo); strips(); }
    if (t.dataset.mute) { M.toggleMute(t.dataset.mute); strips(); }
    if (t.dataset.fire) { if (!M.running()) start(); M.trigger(t.dataset.fire); }
  });

  function start() { M.start(); M.setMood(mood); $('go').textContent = 'Arrêter'; }
  $('go').onclick = () => { if (M.running()) { M.stop(); $('go').textContent = 'Démarrer'; } else start(); };
  const setMood = (m) => { mood = m; $('m-night').classList.toggle('on', m === 'night'); $('m-day').classList.toggle('on', m === 'day'); document.body.dataset.theme = m; M.setMood(m); strips(); };
  $('m-night').onclick = () => setMood('night');
  $('m-day').onclick = () => setMood('day');
  $('vol').value = Math.round(A.prefs.vol * 100);
  $('vol-v').textContent = `${$('vol').value} %`;
  $('vol').oninput = (e) => { A.setVolume(+e.target.value / 100); $('vol-v').textContent = `${e.target.value} %`; };
  $('copy').onclick = async () => {
    output();
    try { await navigator.clipboard.writeText($('out').value); $('copied').textContent = 'Copié !'; }
    catch (e) { $('out').select(); document.execCommand('copy'); $('copied').textContent = 'Sélectionné : Ctrl+C si besoin'; }
    setTimeout(() => { $('copied').textContent = ''; }, 2500);
  };
  $('reset').onclick = () => { if (confirm('Revenir aux valeurs du jeu ?')) { M.reset(); strips(); } };
  $('apply').onclick = () => {
    const txt = $('in').value;
    const j = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
    try { M.load(JSON.parse(j)); strips(); $('in').value = ''; } catch (e) { alert('Texte non reconnu : colle le bloc copié avec « Copier les valeurs ».'); }
  };

  // Niveaux en direct (dBFS, avant le volume d'écoute).
  // Les sons brefs (grillons, gouttes, hibou) restent lisibles : on garde le pic un instant.
  const hold = {};
  setInterval(() => {
    for (const k of Object.keys(M.SOURCES)) {
      const now = M.levelDb(k);
      hold[k] = Math.max(Number.isFinite(now) ? now : -120, (hold[k] ?? -120) - 0.8);
      const db = hold[k] > -90 ? hold[k] : -Infinity;
      const bar = document.getElementById(`mt-${k}`), lv = document.getElementById(`lv-${k}`);
      if (!bar) continue;
      const pct = Number.isFinite(db) ? Math.max(0, Math.min(100, ((db + 60) / 60) * 100)) : 0;
      bar.style.width = `${pct}%`;
      lv.textContent = Number.isFinite(db) && db > -90 ? `${db.toFixed(1)} dBFS` : '—';
    }
  }, 100);
  strips();
})();
