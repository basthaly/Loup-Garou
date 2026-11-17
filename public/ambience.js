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
  const SOURCES = {
    out: 'Sortie', reverb: 'Réverbération',
    pad: 'Nappe', wind: 'Vent', rain: 'Pluie', drops: 'Gouttes', thunder: 'Tonnerre',
    crickets: 'Grillons', frogs: 'Grenouilles', owl: 'Hibou', wolf: 'Loup lointain', birds: 'Oiseaux',
    fire: 'Feu de camp', bell: 'Cloche du village',
    harp: 'Harpe (mélodie)', harp2: 'Harpe (accompagnement)', flute: 'Flûte', cello: 'Violoncelle'
  };
  // Pour la page /audio : sons regroupés.
  const GROUPS = [
    ['Général', ['out', 'reverb']],
    ['Nature', ['pad', 'wind', 'rain', 'drops', 'thunder']],
    ['Animaux', ['crickets', 'frogs', 'owl', 'wolf', 'birds']],
    ['Village', ['fire', 'bell']],
    ['Instruments', ['harp', 'harp2', 'flute', 'cello']]
  ];
  // Mixage composé par Bastien (17/11/2026).
  const DEFAULT_MIX = {
    night: { out: 0, reverb: 5.5, pad: -10, wind: -7.5, rain: -12.5, drops: 4.5, thunder: 5.5, crickets: 0, frogs: 0, owl: 5, wolf: -2, birds: -60, fire: 2.5, bell: -60, harp: -3, harp2: -3, flute: -60, cello: -60 },
    day: { out: 0, reverb: 5.5, pad: -10, wind: -13, rain: -12.5, drops: 4.5, thunder: -60, crickets: 3, frogs: -60, owl: -60, wolf: -60, birds: 3.5, fire: -12, bell: 6, harp: -3, harp2: -3, flute: -4, cello: -8 }
  };
  const MIX_KEY = 'lg-mix';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const mix = (() => {
    const m = clone(DEFAULT_MIX);
    try {
      const saved = JSON.parse(localStorage.getItem(MIX_KEY) || 'null');
      if (saved) for (const md of ['night', 'day']) for (const k of Object.keys(m[md])) if (saved[md] && typeof saved[md][k] === 'number') m[md][k] = saved[md][k];
    } catch (e) { /* valeurs par défaut */ }
    return m;
  })();
  const solo = new Set(), muted = new Set();
  const dbToGain = (db) => (db <= -60 ? 0 : Math.pow(10, db / 20));
  // Un son ponctuel ne se joue que s'il est audible (économise le processeur).
  const audible = (k) => !!mood && mix[mood][k] > -60 && !muted.has(k) && (!solo.size || solo.has(k));
  let buses = null, analysers = null;
  let previewT = null;
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

    // Réverbération partagée (instruments, loup, cloche…) : une salle de pierre, générée.
    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir;
    verb.connect(buses.reverb);
    // Chaque son « spatialisé » a une entrée qui va à sa tranche et, en partie, à la réverbération.
    const inputs = {};
    for (const [k, wet] of [['harp', 0.35], ['harp2', 0.4], ['flute', 0.4], ['wolf', 0.7], ['bell', 0.6], ['owl', 0.4], ['cello', 0.25]]) {
      const i = ctx.createGain(); i.connect(buses[k]);
      const send = ctx.createGain(); send.gain.value = wet; i.connect(send).connect(verb);
      inputs[k] = i;
    }

    // Feu de camp : grondement doux + crépitements (plus bas, dans crackle()).
    const fire = ctx.createBufferSource(); fire.buffer = noiseBuffer(4, true); fire.loop = true;
    const fLp = ctx.createBiquadFilter(); fLp.type = 'lowpass'; fLp.frequency.value = 320;
    const fGain = ctx.createGain(); fGain.gain.value = 0.35;
    fire.connect(fLp).connect(fGain).connect(buses.fire); fire.start();
    const crackleBuf = noiseBuffer(0.05, false);

    // Violoncelle : deux cordes frottées sur la fondamentale de l'accord, qui enflent lentement.
    const celloLp = ctx.createBiquadFilter(); celloLp.type = 'lowpass'; celloLp.frequency.value = 650; celloLp.Q.value = 0.8;
    const celloAmp = ctx.createGain(); celloAmp.gain.value = 0.12;
    const swell = ctx.createOscillator(); swell.frequency.value = 0.06;
    const swellG = ctx.createGain(); swellG.gain.value = 0.08;
    swell.connect(swellG).connect(celloAmp.gain); swell.start();
    const vib = ctx.createOscillator(); vib.frequency.value = 5; const vibG = ctx.createGain(); vibG.gain.value = 3; vib.connect(vibG); vib.start();
    const cello = [0, 7].map((det) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 110; o.detune.value = det; vibG.connect(o.frequency); o.connect(celloLp); o.start(); return o; });
    celloLp.connect(celloAmp).connect(inputs.cello);

    layers = { padGain, padFilter, voices, windGain, crickets, rainGain, drops, chord: 0, inputs, cello, crackleBuf };
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
      o.connect(f).connect(g).connect(layers.inputs.owl); o.start(t + a); o.stop(t + b + 0.05);
    });
  }

  const chordNow = () => CHORDS[mood || 'night'][Math.max(0, layers.chord)];

  // Harpe : arpège lent sur l'accord en cours.
  function pluck(f, t, vel, dest) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(700, t + 1.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(dest || layers.inputs.harp);
    o.start(t); o2.start(t); o.stop(t + 3.1); o2.stop(t + 3.1);
  }
  function harp(force) {
    if (!ctx || (!force && !audible('harp'))) return;
    const ch = chordNow().slice(1).map((f) => f * 4);
    const notes = [...ch, ch[0] * 2, ch[1] * 2].slice(0, 3 + Math.floor(Math.random() * 3));
    const t = ctx.currentTime + 0.05;
    notes.forEach((f, i) => pluck(f, t + i * (0.28 + Math.random() * 0.08), 0.16 - i * 0.012));
  }

  // Harpes en continu : une mélodie qui se promène sur l'accord, et un accompagnement grave.
  let melodyStep = 0, melodyDir = 1;
  function harpNote() {
    if (!ctx || !audible('harp')) return;
    if (Math.random() < 0.22) return; // un silence de temps en temps, ça respire
    const ch = chordNow().slice(1);
    const scale = [...ch.map((f) => f * 4), ...ch.map((f) => f * 8)].sort((a, b) => a - b);
    melodyStep += melodyDir * (Math.random() < 0.7 ? 1 : 2);
    if (melodyStep >= scale.length - 1 || melodyStep <= 0) { melodyDir *= -1; melodyStep = Math.max(0, Math.min(scale.length - 1, melodyStep)); }
    if (Math.random() < 0.12) melodyDir *= -1;
    pluck(scale[melodyStep], ctx.currentTime + 0.02, 0.09 + Math.random() * 0.05);
  }
  function harpBass(force) {
    if (!ctx || (force !== true && !audible('harp2'))) return;
    const ch = chordNow();
    const t = ctx.currentTime + 0.02;
    const root = ch[0] * 2, fifth = ch[0] * 3, third = ch[1] * 2;
    if (Math.random() < 0.35) [root, third, fifth].forEach((f, i) => pluck(f, t + i * 0.09, 0.13, layers.inputs.harp2)); // accord égrené
    else { pluck(root, t, 0.14, layers.inputs.harp2); pluck(Math.random() < 0.5 ? fifth : third, t + 0.6 + Math.random() * 0.3, 0.1, layers.inputs.harp2); }
  }

  // Flûte : courte phrase dans la gamme, souffle léger, vibrato.
  function flute(force) {
    if (!ctx || (!force && !audible('flute'))) return;
    const base = chordNow().slice(1).map((f) => f * 4);
    const scale = [...base, base[0] * 9 / 8, base[1] * 4 / 3].sort((a, b) => a - b);
    let t = ctx.currentTime + 0.05;
    const n = 3 + Math.floor(Math.random() * 3);
    const o = ctx.createOscillator(); o.type = 'sine';
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.value = 0;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain(); g.gain.value = 0.0001;
    const breath = ctx.createBufferSource(); breath.buffer = noiseBuffer(1, false); breath.loop = true;
    const bBp = ctx.createBiquadFilter(); bBp.type = 'bandpass'; bBp.Q.value = 6;
    const bg = ctx.createGain(); bg.gain.value = 0.025;
    breath.connect(bBp).connect(bg).connect(g);
    o.connect(g).connect(layers.inputs.flute);
    const start = t;
    for (let i = 0; i < n; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)];
      const d = 0.6 + Math.random() * 0.8;
      o.frequency.setTargetAtTime(f, t, 0.03); bBp.frequency.setTargetAtTime(f, t, 0.03);
      g.gain.setTargetAtTime(0.12, t, 0.08); vg.gain.setTargetAtTime(4, t + 0.25, 0.2);
      g.gain.setTargetAtTime(0.07, t + d * 0.8, 0.05); vg.gain.setTargetAtTime(0, t + d * 0.8, 0.05);
      t += d;
    }
    g.gain.setTargetAtTime(0.0001, t, 0.25);
    o.start(start); vib.start(start); breath.start(start);
    o.stop(t + 1.5); vib.stop(t + 1.5); breath.stop(t + 1.5);
  }

  // Loup lointain : un hurlement, parfois un second qui répond plus loin.
  function howl(t, gain, pitch) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const s = ctx.createOscillator(); s.type = 'sine';
    const f = [330, 540, 580, 400].map((x) => x * pitch);
    for (const osc of [o, s]) {
      osc.frequency.setValueAtTime(f[0], t); osc.frequency.linearRampToValueAtTime(f[1], t + 0.7);
      osc.frequency.linearRampToValueAtTime(f[2], t + 2.0); osc.frequency.linearRampToValueAtTime(f[3], t + 3.1);
    }
    const vib = ctx.createOscillator(); vib.frequency.value = 6; const vg = ctx.createGain(); vg.gain.value = 7;
    vib.connect(vg); vg.connect(o.frequency); vg.connect(s.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    const so = ctx.createGain(); so.gain.value = 0.15;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.5);
    g.gain.setValueAtTime(gain, t + 2.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
    o.connect(so).connect(lp); s.connect(lp); lp.connect(g).connect(layers.inputs.wolf);
    [o, s, vib].forEach((x) => { x.start(t); x.stop(t + 3.4); });
  }
  function wolf(force) {
    if (!ctx || (!force && !audible('wolf'))) return;
    const t = ctx.currentTime + 0.05;
    howl(t, 0.12, 1);
    if (Math.random() < 0.6) howl(t + 2.2 + Math.random(), 0.06, 0.93);
  }

  // Grenouilles : petits coassements graves.
  function frogs(force) {
    if (!ctx || (!force && !audible('frogs'))) return;
    let t = ctx.currentTime + 0.02;
    const n = 1 + Math.floor(Math.random() * 3);
    const f = 170 + Math.random() * 90;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const am = ctx.createOscillator(); am.frequency.value = 28 + Math.random() * 10; const amg = ctx.createGain(); amg.gain.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0;
      am.connect(amg).connect(g.gain);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
      const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(0.09, t + 0.02); env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(lp).connect(env).connect(buses.frogs);
      [o, am].forEach((x) => { x.start(t); x.stop(t + 0.2); });
      t += 0.22 + Math.random() * 0.1;
    }
  }

  // Oiseaux (le jour) : quelques gazouillis rapides.
  function birds(force) {
    if (!ctx || (!force && !audible('birds'))) return;
    let t = ctx.currentTime + 0.02;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2400 + Math.random() * 1500;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const d = 0.06 + Math.random() * 0.08;
      o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.5), t + d * 0.5); o.frequency.exponentialRampToValueAtTime(base * 0.9, t + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(buses.birds); o.start(t); o.stop(t + d + 0.02);
      t += d + 0.03 + Math.random() * 0.08;
    }
  }

  // Feu de camp : crépitements.
  function crackle() {
    if (!ctx || !audible('fire')) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = layers.crackleBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 2500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.05 + Math.random() * 0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.01 + Math.random() * 0.03);
    src.connect(hp).connect(g).connect(buses.fire); src.start(t);
  }

  // Cloche du village : coups lointains, son de bronze (partiels inharmoniques).
  function bellStroke(t, base) {
    [[0.5, 0.5, 4], [1, 0.6, 3.2], [1.19, 0.35, 2.4], [1.56, 0.25, 2], [2, 0.3, 1.8], [2.74, 0.15, 1.2], [3.76, 0.1, 0.9]].forEach(([r, a, d]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = base * r;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a * 0.12, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d * 1.6);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      o.connect(lp).connect(g).connect(layers.inputs.bell); o.start(t); o.stop(t + d * 1.6 + 0.1);
    });
  }
  function bell(force) {
    if (!ctx || (!force && !audible('bell'))) return;
    const t = ctx.currentTime + 0.05;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) bellStroke(t + i * 2.6, 196);
  }

  function nextChord() {
    if (!ctx || !mood) return;
    layers.chord = (layers.chord + 1) % 4;
    const ch = CHORDS[mood][layers.chord];
    layers.voices.forEach((o, i) => o.frequency.setTargetAtTime(ch[i], ctx.currentTime, 2.5));
    layers.cello.forEach((o) => o.frequency.setTargetAtTime(ch[0] * 2, ctx.currentTime, 1.8));
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
    loop(harp, 12000, 25000);     // glissando de temps en temps
    loop(harpNote, 550, 1150);    // mélodie continue
    loop(harpBass, 1800, 2800);   // accompagnement
    loop(flute, 18000, 40000);
    loop(wolf, 50000, 120000);
    loop(frogs, 900, 3500);
    loop(birds, 2500, 9000);
    loop(crackle, 40, 260);
    loop(bell, 45000, 100000);

    lastThunder = Date.now() - 30000; // premier tonnerre possible après environ une minute
    loop(thunder, 70000, 240000);
  }
  function clear() { timers.forEach(clearTimeout); timers = []; }

  function level() { return (prefs.on || forceOn) && wanted ? prefs.vol * MAX_GAIN : 0; }
  // Coupé = vraiment coupé : après le fondu, le moteur audio est mis en pause (plus aucun son ne sort).
  let pauseT = null;
  function apply(fast) {
    if (!ctx) return;
    const lv = level();
    if (lv > 0) {
      clearTimeout(pauseT); pauseT = null;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(lv, ctx.currentTime, fast ? 0.15 : 1.2);
    if (lv === 0 && !pauseT) pauseT = setTimeout(() => { pauseT = null; if (ctx && level() === 0 && ctx.state === 'running') ctx.suspend().catch(() => {}); }, fast ? 900 : 4000);
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
    if (ctx.state === 'suspended' && level() > 0) ctx.resume().catch(() => {});
    setMood(isNight ? 'night' : 'day');
    if (phase === 'end') { wanted = true; }
    apply();
  }
  // Le navigateur exige un geste avant de jouer du son.
  document.addEventListener('pointerdown', () => { if (ctx && ctx.state === 'suspended' && level() > 0) ctx.resume().catch(() => {}); }, { passive: true });

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
    GROUPS,
    trigger(name) {
      if (!ctx) return;
      const f = { owl, thunder: () => thunder(true), crickets: chirp, drops: drop, harp: () => harp(true), flute: () => flute(true), wolf: () => wolf(true), frogs: () => frogs(true), birds: () => birds(true), bell: () => bell(true), fire: crackle, harp2: () => harpBass(true) }[name];
      if (!f) return;
      // Son coupé dans cette ambiance (ex. la cloche la nuit) : on l'ouvre le temps de l'écouter.
      const k = name === 'drops' ? 'drops' : name;
      if (buses[k] && mood && mix[mood][k] <= -60) {
        buses[k].gain.setTargetAtTime(1, ctx.currentTime, 0.02);
        clearTimeout(previewT); previewT = setTimeout(() => applyMix(true), 9000);
      }
      f();
    },
    levelDb, start, stop, running: () => !!ctx && wanted
  };
  return { update, setVolume, toggle, toggleStorm, thunderNow, prefs, mixer };
})();
