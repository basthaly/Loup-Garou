/* Loup-Garou — musique d'ambiance générée dans le navigateur (aucun fichier, aucun droit d'auteur).
   Nuit : nappe grave en mineur, vent, grillons et un hibou de temps en temps. Jour : nappe plus claire, vent léger.
   Volume bas par défaut pour qu'on s'entende ; chaque joueur peut couper ou régler à son goût (mémorisé). */
window.LGAmbience = (() => {
  const KEY = 'lg-ambience';
  const read = () => { try { return Object.assign({ on: true, vol: 0.4 }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { on: true, vol: 0.4 }; } };
  const prefs = read();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* stockage indisponible */ } };
  const MAX_GAIN = 0.22; // curseur au maximum : reste discret sous les voix

  let ctx = null, master = null, layers = null, mood = null, wanted = false, timers = [];

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

    // Nappe : 4 voix légèrement désaccordées, filtrées, qui respirent lentement.
    const padGain = ctx.createGain(); padGain.gain.value = 0.5;
    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 520; padFilter.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(padFilter.frequency); lfo.start();
    padFilter.connect(padGain).connect(master);
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
    wind.connect(windFilter).connect(windGain).connect(master); wind.start();

    // Grillons (nuit seulement) : petites rafales aiguës.
    const crickets = ctx.createGain(); crickets.gain.value = 0;
    crickets.connect(master);

    layers = { padGain, padFilter, voices, windGain, crickets, chord: 0 };
  }

  function chirp() {
    if (!ctx || mood !== 'night') return;
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

  function owl() {
    if (!ctx || mood !== 'night') return;
    const t = ctx.currentTime;
    [[0, 0.35], [0.55, 0.9]].forEach(([a, b]) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(410, t + a); o.frequency.linearRampToValueAtTime(380, t + b);
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, t + a); g.gain.linearRampToValueAtTime(0.09, t + a + 0.06); g.gain.linearRampToValueAtTime(0, t + b);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      o.connect(f).connect(g).connect(master); o.start(t + a); o.stop(t + b + 0.05);
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
  }
  function clear() { timers.forEach(clearTimeout); timers = []; }

  function level() { return prefs.on && wanted ? prefs.vol * MAX_GAIN : 0; }
  function apply(fast) {
    if (!ctx) return;
    master.gain.setTargetAtTime(level(), ctx.currentTime, fast ? 0.15 : 1.2);
  }

  function setMood(m) {
    if (!ctx || m === mood) return;
    mood = m;
    const t = ctx.currentTime;
    const night = m === 'night';
    layers.crickets.gain.setTargetAtTime(night ? 1 : 0, t, 1.5);
    layers.windGain.gain.setTargetAtTime(night ? 0.35 : 0.15, t, 2);
    layers.padFilter.frequency.setTargetAtTime(night ? 480 : 900, t, 2);
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
  return { update, setVolume, toggle, prefs };
})();
