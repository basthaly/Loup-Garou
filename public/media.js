/* Loup-Garou — micro et caméra.
   Deux transports, même interface :
   - « livekit » : chacun envoie sa vidéo une fois au serveur vidéo (VPS), qui la redistribue. Pour jouer nombreux / hors réseau.
   - « mesh »    : chaque navigateur est relié directement aux autres (test en local, petits groupes).
   Le serveur de jeu calcule pour chaque paire de joueurs qui peut voir / entendre qui (view.media) :
   on ne s'abonne qu'à ce qui est autorisé, et le serveur coupe en plus l'accès des joueurs endormis. */
window.LGMedia = (() => {
  let socket = null;
  let config = {};
  let view = null;
  let onChange = () => {};
  let transport = null;
  const local = { mic: false, cam: false, audioTrack: null, videoTrack: null, error: null, busy: { audio: false, video: false } };
  const videos = new Map();   // id -> <video> persistant entre deux rendus
  const pool = document.getElementById('media-pool');

  // Choix micro / caméra mémorisés : on les rallume tout seuls à la prochaine connexion.
  const prefs = () => { try { return JSON.parse(localStorage.getItem('lg-media') || '{}'); } catch (e) { return {}; } };
  const savePrefs = (patch) => { try { localStorage.setItem('lg-media', JSON.stringify(Object.assign(prefs(), patch))); } catch (e) { /* stockage indisponible */ } };
  const remember = () => savePrefs({ mic: !!(local.audioTrack && local.mic), cam: !!local.cam });

  // ---------- Choix du micro et de la caméra (pour ceux qui en ont plusieurs) ----------
  const devices = { audio: [], video: [] };
  async function refreshDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      devices.audio = list.filter((d) => d.kind === 'audioinput' && d.deviceId);
      devices.video = list.filter((d) => d.kind === 'videoinput' && d.deviceId);
      onChange();
    } catch (e) { /* liste indisponible */ }
  }
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
  // Appareil en cours d'utilisation (ou celui choisi la dernière fois).
  function selected(kind) {
    const t = kind === 'audio' ? local.audioTrack : local.videoTrack;
    const cur = t && t.getSettings ? t.getSettings().deviceId : null;
    return cur || prefs()[kind === 'audio' ? 'micId' : 'camId'] || '';
  }
  const constraintsFor = (kind, deviceId) => {
    const dev = deviceId ? { deviceId: { exact: deviceId } } : {};
    return kind === 'audio'
      ? { audio: Object.assign({ echoCancellation: true, noiseSuppression: true, autoGainControl: true }, dev) }
      : { video: Object.assign({ width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 }, facingMode: 'user' }, dev) };
  };
  // Changer d'appareil : si la piste est active, on la remplace sans couper la partie.
  async function choose(kind, deviceId) {
    savePrefs({ [kind === 'audio' ? 'micId' : 'camId']: deviceId || null });
    const old = kind === 'audio' ? local.audioTrack : local.videoTrack;
    if (!old) return onChange();
    local.busy[kind] = true;
    onChange();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraintsFor(kind, deviceId));
      const track = kind === 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
      if (kind === 'audio') {
        track.enabled = local.mic;
        local.audioTrack = track;
        if (view) meter(view.me.id, track);
      } else {
        local.videoTrack = track;
        setPreview();
      }
      old.stop();
      local.error = null;
    } catch (e) {
      local.error = kind === 'audio' ? 'Ce micro est indisponible.' : 'Cette caméra est indisponible.';
    }
    local.busy[kind] = false;
    transport.applyLocal();
    onChange();
  }
  let restored = false;
  async function restore() {
    if (restored) return;
    restored = true;
    const p = prefs();
    if (!window.isSecureContext || !navigator.mediaDevices) return;
    // Sans autorisation déjà accordée, le navigateur redemanderait : on laisse alors le joueur cliquer.
    const granted = async (name) => {
      try { return !navigator.permissions || (await navigator.permissions.query({ name })).state !== 'denied'; } catch (e) { return true; }
    };
    if (p.mic && !local.audioTrack && await granted('microphone')) await enable('audio', true);
    if (p.cam && !local.videoTrack && await granted('camera')) await enable('video', true);
  }

  const rule = (id) => (view && view.media && view.media[id]) || { send: {}, recv: {} };

  function videoEl(id) {
    let v = videos.get(id);
    if (!v) {
      v = document.createElement('video');
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true; // le son passe par des <audio> séparés
      v.className = 'vid';
      videos.set(id, v);
    }
    return v;
  }

  function setPreview() {
    const stream = local.videoTrack ? new MediaStream([local.videoTrack]) : null;
    for (const id of ['me', 'me2']) {
      const v = videoEl(id);
      v.srcObject = stream;
      v.classList.add('mirror');
    }
  }

  // ---------- Qui parle ? (comme sur Discord) ----------
  // Niveau sonore mesuré localement sur chaque piste audio reçue (et sur son propre micro).
  const meters = new Map(); // id joueur -> { track, src, an, data, until }
  let mctx = null;
  function meterCtx() {
    try { mctx = mctx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    if (mctx.state === 'suspended') mctx.resume().catch(() => {});
    return mctx;
  }
  document.addEventListener('pointerdown', () => { if (mctx && mctx.state === 'suspended') mctx.resume().catch(() => {}); }, { passive: true });
  function meter(id, track) {
    if (!id || !track) return;
    const cur = meters.get(id);
    if (cur && cur.track === track) return;
    unmeter(id);
    const ctx = meterCtx();
    if (!ctx) return;
    try {
      const src = ctx.createMediaStreamSource(new MediaStream([track]));
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      meters.set(id, { track, src, an, data: new Uint8Array(an.fftSize), until: 0 });
    } catch (e) { /* piste non mesurable */ }
  }
  function unmeter(id) {
    const m = meters.get(id);
    if (!m) return;
    try { m.src.disconnect(); } catch (e) { /* déjà déconnectée */ }
    meters.delete(id);
  }
  // Garde-fou : le son normal d'un joueur déformé reste coupé, même si le transport vidéo
  // recrée ou réactive son élément audio (micro allumé en cours de route, reconnexion…).
  let tick = 0;
  setInterval(() => {
    if (!view || !view.media) return;
    const any = Object.values(view.media).some((m) => m.recv && m.recv.distort);
    if (!any && !distorted.size && !pool.querySelector('audio[data-distort]')) return;
    if (++tick % 5 === 0) distortSync();
    // Son d'origine coupé dès que la règle demande la voix déformée, que l'effet soit prêt ou non.
    pool.querySelectorAll('audio[data-pid]').forEach((el) => {
      if (rule(el.dataset.pid).recv.distort && (!el.muted || el.volume > 0)) { el.dataset.distort = '1'; el.muted = true; el.volume = 0; }
    });
  }, 100);
  // Temps de parole du jour (ms), par joueur : remis à zéro chaque matin par l'interface.
  const talk = new Map();
  setInterval(() => {
    if (!view) return;
    const now = Date.now();
    for (const [id, m] of meters) {
      if (m.track.readyState === 'ended') { unmeter(id); continue; }
      m.an.getByteTimeDomainData(m.data);
      let sum = 0;
      for (const v of m.data) { const x = (v - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / m.data.length);
      // Voix déformée (Petite Fille) : pas d'anneau vert, sinon elle saurait exactement qui parle.
      const allowed = id === view.me.id ? local.mic : !!rule(id).recv.audio && !rule(id).recv.distort;
      if (allowed && rms > 0.03) m.until = now + 350;
      const on = now < m.until;
      const lvl = on ? Math.min(1, rms * 7) : 0;
      if (on && view.room && view.room.phase === 'day') talk.set(id, (talk.get(id) || 0) + 90);
      document.querySelectorAll(`[data-speak="${id}"]`).forEach((el) => {
        el.classList.toggle('speaking', on);
        el.style.setProperty('--lvl', lvl.toFixed(2));
      });
    }
  }, 90);

  // ---------- Voix déformée : la Petite Fille entend les loups « de loin » ----------
  // Son très filtré (comme à travers un mur), effet robot (modulation en anneau) et volume faible.
  // L'élément <audio> d'origine est coupé ; Chrome en a besoin pour faire circuler le son, il reste en place.
  const distorted = new Map(); // id -> { track, nodes }
  // Baisse la hauteur de la voix (technique des deux têtes de lecture à retard croissant, fondues l'une dans l'autre).
  function pitchDown(ctx, input, ratio, win) {
    const sr = ctx.sampleRate;
    const period = win / (1 - ratio);
    const len = Math.max(64, Math.round(period * sr));
    const saw = ctx.createBuffer(1, len, sr);
    const fade = ctx.createBuffer(1, len, sr);
    const a = saw.getChannelData(0), f = fade.getChannelData(0);
    for (let i = 0; i < len; i++) { const x = i / len; a[i] = x; f[i] = Math.sin(Math.PI * x) ** 2; }
    const out = ctx.createGain();
    const srcs = [];
    const t = ctx.currentTime + 0.05;
    for (const off of [0, period / 2]) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0;
      const mod = ctx.createBufferSource(); mod.buffer = saw; mod.loop = true;
      const depth = ctx.createGain(); depth.gain.value = win;
      mod.connect(depth).connect(delay.delayTime);
      const env = ctx.createBufferSource(); env.buffer = fade; env.loop = true;
      const g = ctx.createGain(); g.gain.value = 0;
      env.connect(g.gain);
      input.connect(delay).connect(g).connect(out);
      mod.start(t, off); env.start(t, off);
      srcs.push(mod, env);
    }
    return { out, srcs };
  }

  function distortChain(track) {
    const ctx = meterCtx();
    if (!ctx) return null;
    try {
      const src = ctx.createMediaStreamSource(new MediaStream([track]));
      // 1. Voix beaucoup plus grave.
      const low = pitchDown(ctx, src, 0.58, 0.09);
      // 2. Étouffée, comme entendue de loin à travers un mur.
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 850; lp.Q.value = 1.5;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;
      low.out.connect(hp).connect(lp);
      // 3. Brouillée : une part d'effet robot qui ondule, et un léger souffle.
      const ring = ctx.createGain(); ring.gain.value = 0;
      const osc = ctx.createOscillator(); osc.frequency.value = 23;
      const wob = ctx.createOscillator(); wob.frequency.value = 0.4;
      const wobGain = ctx.createGain(); wobGain.gain.value = 9;
      wob.connect(wobGain).connect(osc.frequency);
      osc.connect(ring.gain);
      const dry = ctx.createGain(); dry.gain.value = 0.55;
      const wet = ctx.createGain(); wet.gain.value = 0.6;
      lp.connect(dry); lp.connect(ring).connect(wet);
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < nd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; nd[i] = last * 3.5; }
      const noise = ctx.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
      const ng = ctx.createGain(); ng.gain.value = 0.05;
      noise.connect(ng);
      // 4. Faible : on entend de loin.
      const out = ctx.createGain(); out.gain.value = 0.22;
      dry.connect(out); wet.connect(out); ng.connect(out);
      out.connect(ctx.destination);
      osc.start(); wob.start(); noise.start();
      return { src, osc, wob, out, extra: [...low.srcs, noise] };
    } catch (e) { return null; }
  }
  function stopChain(d) {
    try { d.osc.stop(); d.wob.stop(); (d.extra || []).forEach((n) => n.stop()); d.src.disconnect(); d.out.disconnect(); } catch (e) { /* déjà arrêté */ }
  }
  function distortSync() {
    if (!view) { for (const [id, d] of distorted) { stopChain(d); distorted.delete(id); } return; }
    for (const [id, m] of meters) {
      if (id === view.me.id) continue;
      const want = !!(rule(id).recv.audio && rule(id).recv.distort) && m.track.readyState !== 'ended';
      const cur = distorted.get(id);
      if (want && (!cur || cur.track !== m.track)) {
        if (cur) stopChain(cur);
        const nodes = distortChain(m.track);
        if (nodes) distorted.set(id, Object.assign(nodes, { track: m.track }));
      } else if (!want && cur) { stopChain(cur); distorted.delete(id); }
    }
    for (const [id, d] of distorted) if (!meters.has(id)) { stopChain(d); distorted.delete(id); }
    // Le son normal de ces joueurs est coupé (seule la version déformée passe).
    const tracks = new Set([...distorted.values()].map((d) => d.track));
    let restored = false;
    pool.querySelectorAll('audio').forEach((el) => {
      const t = el.srcObject && el.srcObject.getAudioTracks ? el.srcObject.getAudioTracks() : [];
      const hide = t.some((x) => tracks.has(x)) || (el.dataset.pid && rule(el.dataset.pid).recv.distort);
      if (hide) { el.dataset.distort = '1'; el.muted = true; el.volume = 0; } else if (el.dataset.distort) { delete el.dataset.distort; el.muted = false; el.volume = 1; restored = true; }
    });
    // Fin de l'effet : le transport réapplique les règles normales (le maillage recoupe ce qui n'est pas autorisé).
    if (restored && transport) transport.applyLocal();
  }

  function init(s, cfg, cb) {
    socket = s;
    config = cfg || {};
    onChange = cb || onChange;
    transport = config.video === 'livekit' ? liveKitTransport() : meshTransport();
    transport.init();
  }

  // ---------- Micro / caméra locaux (indépendants) ----------
  async function enable(kind, quiet) {
    if (local.busy[kind]) return;
    if (!window.isSecureContext || !navigator.mediaDevices) {
      local.error = 'Le micro et la caméra demandent une connexion sécurisée (https://).';
      return onChange();
    }
    local.busy[kind] = true;
    onChange();
    try {
      const want = prefs()[kind === 'audio' ? 'micId' : 'camId'];
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia(constraintsFor(kind, want)); } catch (e) {
        // Appareil choisi débranché : on prend celui par défaut.
        if (!want) throw e;
        stream = await navigator.mediaDevices.getUserMedia(constraintsFor(kind, null));
      }
      if (kind === 'audio') {
        local.audioTrack = stream.getAudioTracks()[0];
        local.mic = true;
        if (view) meter(view.me.id, local.audioTrack);
      } else {
        local.videoTrack = stream.getVideoTracks()[0];
        local.cam = true;
        setPreview();
      }
      local.error = null;
    } catch (e) {
      if (quiet) { local.busy[kind] = false; return onChange(); }
      local.error = kind === 'audio'
        ? 'Micro refusé ou indisponible. Autorise-le dans les réglages du navigateur.'
        : 'Caméra refusée ou indisponible. Autorise-la dans les réglages du navigateur.';
    }
    local.busy[kind] = false;
    if (!quiet || local.error === null) remember();
    refreshDevices();
    publish();
    transport.applyLocal();
    onChange();
  }

  function toggle(kind) {
    if (kind === 'mic') {
      if (!local.audioTrack) return enable('audio');
      local.mic = !local.mic;
      local.audioTrack.enabled = local.mic;
    } else {
      if (!local.videoTrack) return enable('video');
      // Caméra coupée = vraiment éteinte (le voyant s'éteint).
      local.cam = false;
      local.videoTrack.stop();
      local.videoTrack = null;
      setPreview();
    }
    remember();
    publish();
    transport.applyLocal();
    onChange();
  }

  function publish() {
    if (socket && view) socket.emit('media', { cam: local.cam, mic: local.mic }, () => {});
  }

  function update(v) {
    const first = !view && v;
    view = v;
    if (!v) { distortSync(); return transport.close(); }
    if (first) { publish(); restore(); }
    if (local.audioTrack) meter(v.me.id, local.audioTrack);
    transport.sync();
    distortSync();
  }

  function visible(id) {
    if (id === 'me' || id === 'me2') return { show: !!(local.cam && local.videoTrack), blur: false };
    const p = view && view.players.find((x) => x.id === id);
    const r = rule(id);
    return { show: !!(p && p.cam && r.recv.video && transport.hasVideo(id)), blur: !!r.recv.blur };
  }

  // Après chaque rendu : place les <video> persistants dans les emplacements [data-vslot].
  function mount(root) {
    root.querySelectorAll('[data-vslot]').forEach((slot) => {
      const id = slot.dataset.vslot;
      const vis = visible(id);
      const host = slot.closest('.has-video-host');
      if (vis.show) {
        const v = videoEl(id);
        if (v.parentNode !== slot) slot.appendChild(v);
        v.classList.toggle('blur', vis.blur);
        v.play().catch(() => {});
        if (host) host.classList.add('has-video');
      } else if (host) host.classList.remove('has-video');
    });
  }

  // ---------- Transport LiveKit ----------
  function liveKitTransport() {
    let room = null;
    let roomKey = null;
    let connecting = false;
    let scriptReady = null;
    const published = { audio: null, video: null };
    const remote = new Map(); // id -> { video: track|null, audio: [elements] }

    function init() {
      scriptReady = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = '/vendor/livekit-client.umd.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    function entry(id) {
      let e = remote.get(id);
      if (!e) { e = { video: null, audio: [] }; remote.set(id, e); }
      return e;
    }

    function attach(track, id) {
      const e = entry(id);
      if (track.kind === 'video') {
        e.video = track;
        track.attach(videoEl(id));
      } else {
        const el = track.attach();
        el.dataset.pid = id;
        pool.appendChild(el);
        e.audio.push(el);
        meter(id, track.mediaStreamTrack);
        distortSync();
      }
    }

    function detach(track, id) {
      const e = entry(id);
      for (const el of track.detach()) if (el.tagName === 'AUDIO') el.remove();
      if (track.kind === 'video') e.video = null;
      else { e.audio = e.audio.filter((el) => el.isConnected); unmeter(id); }
    }

    async function connect() {
      if (room || connecting || !view) return;
      connecting = true;
      try {
        await scriptReady;
        const L = window.LivekitClient;
        const r = await new Promise((res) => socket.emit('lkToken', {}, res));
        if (!r || !r.ok) throw new Error((r && r.error) || 'jeton refusé');
        const rm = new L.Room({ adaptiveStream: false, dynacast: true });
        rm.on(L.RoomEvent.TrackSubscribed, (track, pub, part) => { attach(track, part.identity); onChange(); })
          .on(L.RoomEvent.TrackUnsubscribed, (track, pub, part) => { detach(track, part.identity); onChange(); })
          .on(L.RoomEvent.TrackPublished, () => applySubs())
          .on(L.RoomEvent.ParticipantConnected, () => applySubs())
          .on(L.RoomEvent.ParticipantPermissionsChanged, (prev, part) => {
            // Droit d'abonnement rendu par le serveur (fin de la nuit) : on redemande les flux voulus.
            if (part === rm.localParticipant && part.permissions && part.permissions.canSubscribe) resubscribe = true;
            applySubs();
          })
          .on(L.RoomEvent.Disconnected, () => {
            if (room !== rm) return;
            room = null;
            published.audio = published.video = null;
            remote.clear();
            onChange();
            setTimeout(connect, 2000);
          });
        await rm.connect(r.url, r.token, { autoSubscribe: false });
        room = rm;
        window.__lgRoom = rm; // utile pour le débogage
        roomKey = `${view.room.code}:${view.me.id}`;
        if (local.error && local.error.startsWith('Serveur vidéo')) local.error = null;
        applyLocal();
        applySubs();
      } catch (e) {
        console.error('LiveKit', e);
        local.error = 'Serveur vidéo injoignable, nouvel essai…';
        onChange();
        setTimeout(() => { connecting = false; connect(); }, 5000);
        return;
      }
      connecting = false;
      onChange();
    }

    function applyLocal() {
      if (!room) return;
      const L = window.LivekitClient;
      const lp = room.localParticipant;
      for (const kind of ['audio', 'video']) {
        const track = kind === 'audio' ? local.audioTrack : local.videoTrack;
        if (published[kind] === track) continue;
        if (published[kind]) lp.unpublishTrack(published[kind], false).catch(() => {});
        published[kind] = track;
        if (track) {
          const opts = kind === 'audio'
            ? { source: L.Track.Source.Microphone }
            : { source: L.Track.Source.Camera, simulcast: false, videoEncoding: { maxBitrate: 300000, maxFramerate: 15 } };
          lp.publishTrack(track, opts).catch((e) => console.error('publication', e));
        }
      }
      const micPub = lp.getTrackPublication(L.Track.Source.Microphone);
      if (micPub) (local.mic ? micPub.unmute() : micPub.mute()).catch(() => {});
    }

    // S'abonner uniquement à ce que les règles autorisent (et se désabonner du reste).
    let resubscribe = false;
    function applySubs() {
      if (!room) return;
      const again = resubscribe;
      resubscribe = false;
      for (const part of room.remoteParticipants.values()) {
        const r = rule(part.identity);
        for (const pub of part.trackPublications.values()) {
          const want = pub.kind === 'video' ? !!r.recv.video : !!r.recv.audio;
          if (want && again && !pub.isSubscribed) pub.setSubscribed(false);
          if (pub.isDesired !== want || (want && !pub.isSubscribed && again)) pub.setSubscribed(want);
        }
      }
    }

    function sync() {
      const key = `${view.room.code}:${view.me.id}`;
      if (room && roomKey !== key) { const rm = room; room = null; rm.disconnect(); }
      if (!room) return connect();
      applySubs();
    }

    function close() {
      if (room) { const rm = room; room = null; rm.disconnect(); }
      published.audio = published.video = null;
      remote.clear();
    }

    const hasVideo = (id) => !!(remote.get(id) && remote.get(id).video);
    return { init, sync, applyLocal, close, hasVideo };
  }

  // ---------- Transport maillage (WebRTC direct) ----------
  function meshTransport() {
    const peers = new Map();

    function init() { socket.on('rtc', onSignal); }

    function sync() {
      const me = view.me;
      const present = new Set();
      for (const p of view.players) {
        if (p.id === me.id || !p.connected || !p.conn) continue;
        present.add(p.id);
        const peer = peers.get(p.id);
        if (peer && peer.conn === p.conn && peer.myConn === me.conn) continue;
        if (peer) closePeer(p.id);
        if (me.id < p.id) createPeer(p.id, p.conn, true); // le plus petit identifiant fait l'offre
      }
      for (const id of [...peers.keys()]) if (!present.has(id)) closePeer(id);
      applyLocal();
    }

    function createPeer(id, conn, offerer) {
      const pc = new RTCPeerConnection({ iceServers: config.iceServers || [] });
      const peer = { id, conn, myConn: view.me.conn, pc, audioT: null, videoT: null, pending: [], stream: new MediaStream(), sent: {} };
      peers.set(id, peer);
      peer.audioEl = document.createElement('audio');
      peer.audioEl.dataset.pid = id;
      peer.audioEl.autoplay = true;
      peer.audioEl.srcObject = peer.stream;
      pool.appendChild(peer.audioEl);
      const v = videoEl(id);
      v.srcObject = peer.stream;
      pc.ontrack = (e) => {
        if (!peer.stream.getTracks().includes(e.track)) peer.stream.addTrack(e.track);
        if (e.track.kind === 'audio') { meter(id, e.track); distortSync(); }
        v.play().catch(() => {});
        peer.audioEl.play().catch(() => {});
        onChange();
      };
      pc.onicecandidate = (e) => { if (e.candidate) signal(peer, { candidate: e.candidate }); };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') limitBitrate(peer);
        if (pc.connectionState === 'failed' && peers.get(id) === peer) { closePeer(id); if (view) sync(); }
      };
      if (offerer) {
        peer.audioT = pc.addTransceiver('audio', { direction: 'sendrecv' });
        peer.videoT = pc.addTransceiver('video', { direction: 'sendrecv' });
        applyPeer(peer);
        pc.createOffer()
          .then((o) => pc.setLocalDescription(o))
          .then(() => signal(peer, { sdp: pc.localDescription }))
          .catch((e) => console.error('RTC offre', e));
      }
      return peer;
    }

    function signal(peer, data) {
      socket.emit('rtc', { to: peer.id, data: Object.assign({ fromConn: view.me.conn, toConn: peer.conn }, data) });
    }

    async function onSignal({ from, data }) {
      if (!view || !data) return;
      if (data.toConn && data.toConn !== view.me.conn) return;
      let peer = peers.get(from);
      if (peer && peer.conn !== data.fromConn) { closePeer(from); peer = null; }
      if (!peer) {
        if (!data.sdp || data.sdp.type !== 'offer') return;
        peer = createPeer(from, data.fromConn, false);
      }
      const pc = peer.pc;
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp);
          if (data.sdp.type === 'offer') {
            for (const t of pc.getTransceivers()) {
              t.direction = 'sendrecv';
              const kind = t.receiver.track.kind;
              if (kind === 'audio' && !peer.audioT) peer.audioT = t;
              if (kind === 'video' && !peer.videoT) peer.videoT = t;
            }
            applyPeer(peer);
            await pc.setLocalDescription(await pc.createAnswer());
            signal(peer, { sdp: pc.localDescription });
          }
          for (const c of peer.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        } else if (data.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
          else peer.pending.push(data.candidate);
        }
      } catch (e) {
        console.error('RTC', e);
      }
    }

    function applyPeer(peer) {
      const r = rule(peer.id);
      const a = local.mic && r.send.audio ? local.audioTrack : null;
      const v = local.cam && r.send.video ? local.videoTrack : null;
      if (peer.audioT && peer.sent.a !== a) { peer.sent.a = a; peer.audioT.sender.replaceTrack(a).catch(() => {}); }
      if (peer.videoT && peer.sent.v !== v) { peer.sent.v = v; peer.videoT.sender.replaceTrack(v).then(() => limitBitrate(peer)).catch(() => {}); }
      if (peer.audioEl) peer.audioEl.muted = !r.recv.audio || !!r.recv.distort;
    }

    function applyLocal() { for (const peer of peers.values()) applyPeer(peer); }

    function limitBitrate(peer) {
      if (!peer.videoT) return;
      const s = peer.videoT.sender;
      const p = s.getParameters();
      if (!p.encodings || !p.encodings.length) return;
      p.encodings[0].maxBitrate = 300000;
      s.setParameters(p).catch(() => {});
    }

    function closePeer(id) {
      const peer = peers.get(id);
      if (!peer) return;
      peers.delete(id);
      unmeter(id);
      try { peer.pc.close(); } catch (e) { /* déjà fermée */ }
      if (peer.audioEl) peer.audioEl.remove();
      const v = videos.get(id);
      if (v) { v.srcObject = null; v.remove(); videos.delete(id); }
    }

    function close() { for (const id of [...peers.keys()]) closePeer(id); }

    const hasVideo = (id) => { const p = peers.get(id); return !!(p && p.stream.getVideoTracks().length); };
    return { init, sync, applyLocal, close, hasVideo };
  }

  return { init, enable, toggle, update, mount, visible, local, devices, refreshDevices, selected, choose, talk };
})();
