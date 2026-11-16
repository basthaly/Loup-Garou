/* Loup-Garou — audio/vidéo en maillage WebRTC.
   Chaque joueur est relié directement à chaque autre joueur. Le serveur indique, pour chaque paire,
   qui peut envoyer/recevoir l'audio et la vidéo (nuit, loups, morts…) : on n'envoie une piste
   qu'aux joueurs autorisés, et on coupe à la réception ce qui n'est pas autorisé. */
window.LGRTC = (() => {
  let socket = null;
  let iceServers = [];
  let view = null;
  let onChange = () => {};
  const local = { stream: null, cam: false, mic: false, error: null, starting: false };
  const peers = new Map();     // id joueur -> liaison
  const videos = new Map();    // id -> <video> (persistants entre deux rendus)
  const pool = document.getElementById('media-pool');

  function init(s, ice, cb) {
    socket = s;
    iceServers = ice || [];
    onChange = cb || onChange;
    socket.on('rtc', onSignal);
  }

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

  async function start() {
    if (local.stream || local.starting) return;
    if (!window.isSecureContext || !navigator.mediaDevices) {
      local.error = 'La caméra et le micro demandent une connexion sécurisée : ouvre le site en https:// (ou sur localhost).';
      return onChange();
    }
    local.starting = true;
    onChange();
    const video = { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } };
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    try {
      local.stream = await navigator.mediaDevices.getUserMedia({ audio, video });
      local.error = null;
    } catch (e) {
      try {
        local.stream = await navigator.mediaDevices.getUserMedia({ audio });
        local.error = 'Caméra indisponible : micro seul.';
      } catch (e2) {
        local.error = 'Accès à la caméra et au micro refusé par le navigateur.';
      }
    }
    local.starting = false;
    if (local.stream) {
      local.cam = local.stream.getVideoTracks().length > 0;
      local.mic = local.stream.getAudioTracks().length > 0;
      for (const id of ['me', 'me2']) { const v = videoEl(id); v.srcObject = local.stream; }
      publish();
      apply();
    }
    onChange();
  }

  function toggle(kind) {
    if (!local.stream) return start();
    if (kind === 'cam' && local.stream.getVideoTracks().length) local.cam = !local.cam;
    if (kind === 'mic' && local.stream.getAudioTracks().length) local.mic = !local.mic;
    publish();
    apply();
    onChange();
  }

  function publish() {
    if (socket && view) socket.emit('media', { cam: local.cam, mic: local.mic }, () => {});
  }

  function update(v) {
    const first = !view && v;
    view = v;
    if (!v) return closeAll();
    if (first && local.stream) publish();
    sync();
    apply();
  }

  // Crée / ferme les liaisons selon les joueurs connectés. Le plus petit identifiant fait l'offre.
  function sync() {
    const me = view.me;
    const present = new Set();
    for (const p of view.players) {
      if (p.id === me.id || !p.connected || !p.conn) continue;
      present.add(p.id);
      const peer = peers.get(p.id);
      if (peer && peer.conn === p.conn && peer.myConn === me.conn) continue;
      if (peer) close(p.id);
      if (me.id < p.id) createPeer(p.id, p.conn, true);
    }
    for (const id of [...peers.keys()]) if (!present.has(id)) close(id);
  }

  function createPeer(id, conn, offerer) {
    const pc = new RTCPeerConnection({ iceServers });
    const peer = { id, conn, myConn: view.me.conn, pc, audioT: null, videoT: null, pending: [], stream: new MediaStream(), sent: {} };
    peers.set(id, peer);
    peer.audioEl = document.createElement('audio');
    peer.audioEl.autoplay = true;
    peer.audioEl.srcObject = peer.stream;
    pool.appendChild(peer.audioEl);
    const v = videoEl(id);
    v.srcObject = peer.stream;
    pc.ontrack = (e) => {
      if (!peer.stream.getTracks().includes(e.track)) peer.stream.addTrack(e.track);
      v.play().catch(() => {});
      peer.audioEl.play().catch(() => {});
      onChange();
    };
    pc.onicecandidate = (e) => { if (e.candidate) signal(peer, { candidate: e.candidate }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') limitBitrate(peer);
      if (pc.connectionState === 'failed' && peers.get(id) === peer) { close(id); if (view) sync(); }
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
    if (data.toConn && data.toConn !== view.me.conn) return; // message destiné à une ancienne connexion
    let peer = peers.get(from);
    if (peer && peer.conn !== data.fromConn) { close(from); peer = null; }
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

  function rule(id) {
    return (view && view.media && view.media[id]) || { send: {}, recv: {} };
  }

  // Applique les règles : quelles pistes envoyer à ce joueur, et faut-il l'entendre.
  function applyPeer(peer) {
    const r = rule(peer.id);
    const a = local.stream && local.mic && r.send.audio ? local.stream.getAudioTracks()[0] || null : null;
    const v = local.stream && local.cam && r.send.video ? local.stream.getVideoTracks()[0] || null : null;
    if (peer.audioT && peer.sent.a !== a) { peer.sent.a = a; peer.audioT.sender.replaceTrack(a).catch(() => {}); }
    if (peer.videoT && peer.sent.v !== v) { peer.sent.v = v; peer.videoT.sender.replaceTrack(v).then(() => limitBitrate(peer)).catch(() => {}); }
    if (peer.audioEl) peer.audioEl.muted = !r.recv.audio;
  }

  function apply() {
    for (const peer of peers.values()) applyPeer(peer);
  }

  function limitBitrate(peer) {
    if (!peer.videoT) return;
    const s = peer.videoT.sender;
    const p = s.getParameters();
    if (!p.encodings || !p.encodings.length) return;
    p.encodings[0].maxBitrate = 300000;
    s.setParameters(p).catch(() => {});
  }

  function close(id) {
    const peer = peers.get(id);
    if (!peer) return;
    peers.delete(id);
    try { peer.pc.close(); } catch (e) { /* déjà fermée */ }
    if (peer.audioEl) peer.audioEl.remove();
    const v = videos.get(id);
    if (v) { v.srcObject = null; v.remove(); videos.delete(id); }
  }

  function closeAll() {
    for (const id of [...peers.keys()]) close(id);
  }

  // Peut-on afficher la vidéo de ce joueur ? (règle serveur + sa caméra allumée + liaison établie)
  function visible(id) {
    if (id === 'me' || id === 'me2') return { show: !!(local.stream && local.cam), blur: false };
    const p = view && view.players.find((x) => x.id === id);
    const r = rule(id);
    const peer = peers.get(id);
    const hasVideo = peer && peer.stream.getVideoTracks().length > 0;
    return { show: !!(p && p.cam && r.recv.video && hasVideo), blur: !!r.recv.blur };
  }

  // Après chaque rendu : place les <video> persistants dans les emplacements [data-vslot].
  function mount(root) {
    root.querySelectorAll('[data-vslot]').forEach((slot) => {
      const id = slot.dataset.vslot;
      const vis = visible(id);
      const tile = slot.closest('.has-video-host');
      if (vis.show) {
        const v = videoEl(id);
        if (v.parentNode !== slot) slot.appendChild(v);
        v.classList.toggle('blur', vis.blur);
        v.play().catch(() => {});
        if (tile) tile.classList.add('has-video');
      } else if (tile) tile.classList.remove('has-video');
    });
  }

  return { init, start, toggle, update, mount, visible, local };
})();
