/* Loup-Garou — musique d'ambiance générée dans le navigateur (aucun fichier, aucun droit d'auteur).
   Nuit : nappe grave en mineur, vent, grillons et un hibou de temps en temps. Jour : nappe plus claire, vent léger.
   Volume bas par défaut pour qu'on s'entende ; chaque joueur peut couper ou régler à son goût (mémorisé). */
window.LGAmbience = (() => {
  const KEY = 'lg-ambience';
  const read = () => { try { return Object.assign({ on: true, vol: 0.4, storm: true }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { on: true, vol: 0.4, storm: true }; } };
  const prefs = read();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* stockage indisponible */ } };
  const MAX_GAIN = 0.22; // curseur au maximum : reste discret sous les voix

  let ctx = null, master = null, layers = null, mood = null, wanted = false, timers = [], forceOn = false;

  // ---------- Table de mixage : un niveau en dB par source, la nuit et le jour ----------
  // 0 dB = niveau de base de chaque son ; -60 dB = coupé. Réglable sur la page cachée /audio.
  const SOURCES = { out: 'Sortie', pad: 'Nappe', wind: 'Vent', rain: 'Pluie', drops: 'Gouttes', crickets: 'Grillons', owl: 'Hibou', thunder: 'Tonnerre' };
  const DEFAULT_MIX = {
    night: { out: 0, pad: 0, wind: 0, rain: 0, drops: 0, crickets: 0, owl: 0, thunder: 0 },
    day: { out: 0, pad: 0, wind: -7.4, rain: -10, drops: -10.5, crickets: -60, owl: -60, thunder: -60 }
  };
  const MIX_KEY = 'lg-mix';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const mix = (() => {
    const m = clone(DEFAULT_MIX);
    try { const saved = JSON.parse(localStorage.getItem(MIX_KEY) || 'null'); if (saved) for (const md of ['night', 'day']) Object.assign(m[md], saved[md] || {}); } catch (e) { /* valeurs par défaut */ }
    return m;
  })();
  const solo = new Set(), muted = new Set();
  const dbToGain = (db) => (db <= -60 ? 0 : Math.pow(10, db / 20));
  let buses = null, analysers = null;
  function applyMix(fast) {
    if (!ctx || !buses || !mood) return;
    const t = ctx.currentTime, tc = fast ? 0.05 : 1.5;
    for (const k of Object.keys(SOURCES)) {
      let g = dbToGain(mix[mood][k]);
      if (k !== 'out' && (muted.has(k) || (solo.size && !solo.has(k)))) g = 0;
      buses[k].gain.setTargetAtTime(g, t, tc);
    }
  }

  // Suites d'accords (fréquences en Hz) : la nuit en mineur, le jour plus lumineux.
  const CHORDS = {
    night: [[55, 110, 130.8, 164.8], [43.7, 87.3, 130.8, 174.6], [36.7, 73.4, 110, 174.6], [41.2, 82.4, 123.5, 164.8]],
    day: [[65.4, 130.8, 164.8, 196], [49, 98, 146.8, 196], [55, 110, 164.8, 220], [43.7, 87.3, 130.8, 220]]
  };

  function noiseBuffer(seconds, brown) {
    const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // Une tranche par source, puis la sortie, puis le volume du joueur.
    buses = {}; analysers = {};
    buses.out = ctx.createGain(); buses.out.connect(master);
    for (const k of Object.keys(SOURCES)) {
      if (k !== 'out') { buses[k] = ctx.createGain(); buses[k].gain.value = 0; buses[k].connect(buses.out); }
      analysers[k] = ctx.createAnalyser(); analysers[k].fftSize = 2048;
      buses[k].connect(analysers[k]);
    }

    // Nappe : 4 voix légèrement désaccordées, filtrées, qui respirent lentement.
    const padGain = ctx.createGain(); padGain.gain.value = 0.5;
    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 520; padFilter.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(padFilter.frequency); lfo.start();
    padFilter.connect(padGain).connect(buses.pad);
    const voices = CHORDS.night[0].map((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 1.5) * 4;
      const g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.18;
      o.connect(g).connect(padFilter); o.start();
      return o;
    });

    // Vent : bruit filtré dont la couleur ondule.
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuffer(4, true); wind.loop = true;
    const windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 400; windFilter.Q.value = 0.8;
    const wLfo = ctx.createOscillator(); wLfo.frequency.value = 0.08;
    const wLfoGain = ctx.createGain(); wLfoGain.gain.value = 250;
    wLfo.connect(wLfoGain).connect(windFilter.frequency); wLfo.start();
    const windGain = ctx.createGain(); windGain.gain.value = 0.35;
    wind.connect(windFilter).connect(windGain).connect(buses.wind); wind.start();

    // Grillons (nuit seulement) : petites rafales aiguës.
    const crickets = buses.crickets;

    // Pluie fine : souffle aigu filtré, plus quelques gouttes.
    const rain = ctx.createBufferSource(); rain.buffer = noiseBuffer(3, false); rain.loop = true;
    const rHp = ctx.createBiquadFilter(); rHp.type = 'highpass'; rHp.frequency.value = 900;
    const rLp = ctx.createBiquadFilter(); rLp.type = 'lowpass'; rLp.frequency.value = 5200;
    // La pluie va et vient doucement.
    const rLfo = ctx.createOscillator(); rLfo.frequency.value = 0.03;
    const rLfoGain = ctx.createGain(); rLfoGain.gain.value = 0.06;
    const rainGain = ctx.createGain(); rainGain.gain.value = 0.22;
    rain.connect(rHp).connect(rLp).connect(rainGain).connect(buses.rain); rain.start();
    rLfo.connect(rLfoGain).connect(rainGain.gain); rLfo.start();
    const drops = buses.drops;

    layers = { padGain, padFilter, voices, windGain, crickets, rainGain, drops, chord: 0 };
  }

  function chirp() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 4200 + Math.random() * 600;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g).connect(layers.crickets);
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = t + i * 0.07;
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.05, s + 0.01); g.gain.linearRampToValueAtTime(0, s + 0.05);
    }
    o.start(t); o.stop(t + n * 0.07 + 0.1);
  }

  function drop() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    const f = 1800 + Math.random() * 2200;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.04);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.06 + Math.random() * 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(layers.drops); o.start(t); o.stop(t + 0.06);
  }

  // Tonnerre lointain : grondement grave et doux, sans claquement, rare (certains n'aiment pas l'orage).
  let lastThunder = 0;
  function thunder(force) {
    if (!ctx || (!force && (mood !== 'night' || !prefs.storm || mix.night.thunder <= -60))) return;
    if (!force && Date.now() - lastThunder < 90000) return;
    lastThunder = Date.now();
    const t = ctx.currentTime + 0.05;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(8, true);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.7; // assez haut pour les petits haut-parleurs
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9, t + 1.2);   // montée douce : pas de claquement
    g.gain.linearRampToValueAtTime(0.5, t + 2.4);
    g.gain.linearRampToValueAtTime(0.75, t + 3.3);  // second roulement
    g.gain.exponentialRampToValueAtTime(0.0001, t + 7.5);
    src.connect(lp).connect(g).connect(buses.thunder);
    src.start(t); src.stop(t + 8);
  }

  function owl() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [[0, 0.35], [0.55, 0.9]].forEach(([a, b]) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(410, t + a); o.frequency.linearRampToValueAtTime(380, t + b);
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, t + a); g.gain.linearRampToValueAtTime(0.09, t + a + 0.06); g.gain.linearRampToValueAtTime(0, t + b);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      o.connect(f).connect(g).connect(buses.owl); o.start(t + a); o.stop(t + b + 0.05);
    });
  }

  function nextChord() {
    if (!ctx || !mood) return;
    layers.chord = (layers.chord + 1) % 4;
    const ch = CHORDS[mood][layers.chord];
    layers.voices.forEach((o, i) => o.frequency.setTargetAtTime(ch[i], ctx.currentTime, 2.5));
  }

  function schedule() {
    clear();
    const loop = (fn, min, max) => {
      const run = () => { fn(); timers.push(setTimeout(run, min + Math.random() * (max - min))); };
      timers.push(setTimeout(run, min + Math.random() * (max - min)));
    };
    loop(nextChord, 11000, 15000);
    loop(chirp, 700, 2600);
    loop(owl, 25000, 50000);
    loop(drop, 150, 900);
    lastThunder = Date.now() - 30000; // premier tonnerre possible après environ une minute
    loop(thunder, 70000, 240000);
  }
  function clear() { timers.forEach(clearTimeout); timers = []; }

  function level() { return (prefs.on || forceOn) && wanted ? prefs.vol * MAX_GAIN : 0; }
  function apply(fast) {
    if (!ctx) return;
    master.gain.setTargetAtTime(level(), ctx.currentTime, fast ? 0.15 : 1.2);
  }

  function setMood(m) {
    if (!ctx || m === mood) return;
    mood = m;
    const t = ctx.currentTime;
    const night = m === 'night';
    layers.padFilter.frequency.setTargetAtTime(night ? 480 : 900, t, 2);
    applyMix();
    layers.chord = -1;
    nextChord();
  }

  // Appelé à chaque rendu : joue pendant la partie, se tait au salon et sur l'accueil.
  function update(phase, isNight) {
    wanted = ['setup', 'night', 'day', 'end'].includes(phase);
    if (wanted && !ctx && prefs.on) { try { build(); schedule(); } catch (e) { return; } }
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    setMood(isNight ? 'night' : 'day');
    if (phase === 'end') { wanted = true; }
    apply();
  }
  // Le navigateur exige un geste avant de jouer du son.
  document.addEventListener('pointerdown', () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }, { passive: true });

  function setVolume(v) {
    prefs.vol = Math.max(0, Math.min(1, v));
    if (prefs.vol > 0) prefs.on = true;
    save();
    if (!ctx && wanted && prefs.on) { try { build(); schedule(); setMood('night'); } catch (e) { /* pas d'audio */ } }
    apply(true);
  }
  function toggle() {
    prefs.on = !prefs.on;
    save();
    if (prefs.on && !ctx && wanted) { try { build(); schedule(); setMood('night'); } catch (e) { /* pas d'audio */ } }
    apply(true);
  }
  function toggleStorm() { prefs.storm = !prefs.storm; save(); }
  // Pour vérifier le son (page de test) : un roulement de tonnerre tout de suite.
  function thunderNow() { if (ctx) { if (ctx.state === 'suspended') ctx.resume(); thunder(true); } }
  // ---------- Page /audio : réglage source par source ----------
  function start() {
    forceOn = true; wanted = true;
    if (!ctx) { build(); schedule(); }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const m = mood || 'night'; mood = null; setMood(m);
    applyMix(true); apply(true);
  }
  function stop() { wanted = false; apply(true); }
  function saveMix() { try { localStorage.setItem(MIX_KEY, JSON.stringify(mix)); } catch (e) { /* stockage indisponible */ } }
  function levelDb(k) {
    if (!analysers) return -Infinity;
    const a = analysers[k], d = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(d);
    let sum = 0; for (const x of d) sum += x * x;
    const rms = Math.sqrt(sum / d.length);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  }
  const mixer = {
    SOURCES, DEFAULT_MIX,
    get: () => clone(mix),
    mood: () => mood || 'night',
    set(md, k, db) { mix[md][k] = Math.max(-60, Math.min(12, Math.round(db * 10) / 10)); saveMix(); applyMix(true); },
    load(o) { for (const md of ['night', 'day']) for (const k of Object.keys(SOURCES)) if (o && o[md] && typeof o[md][k] === 'number') mix[md][k] = Math.max(-60, Math.min(12, o[md][k])); saveMix(); applyMix(true); },
    reset() { Object.assign(mix.night, DEFAULT_MIX.night); Object.assign(mix.day, DEFAULT_MIX.day); try { localStorage.removeItem(MIX_KEY); } catch (e) { /* rien */ } applyMix(true); },
    setMood(m) { if (ctx) { setMood(m); applyMix(true); } else mood = m; },
    toggleSolo(k) { solo.has(k) ? solo.delete(k) : solo.add(k); applyMix(true); return solo.has(k); },
    toggleMute(k) { muted.has(k) ? muted.delete(k) : muted.add(k); applyMix(true); return muted.has(k); },
    isSolo: (k) => solo.has(k), isMuted: (k) => muted.has(k),
    trigger(name) { if (!ctx) return; ({ owl, thunder: () => thunder(true), crickets: chirp, drops: drop })[name](); },
    levelDb, start, stop, running: () => !!ctx && wanted
  };
  return { update, setVolume, toggle, toggleStorm, thunderNow, prefs, mixer };
})();
