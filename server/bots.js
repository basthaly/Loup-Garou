// Faux joueurs pour la page de test (/test) : ils jouent tout seuls, au hasard, avec des choix valides.
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const shuffled = (a) => [...a].sort(() => Math.random() - 0.5);
const NAMES = ['Robin', 'Margot', 'Léon', 'Jade', 'Hugo', 'Lina', 'Noé', 'Chloé', 'Sacha', 'Inès', 'Malo', 'Rose', 'Nino', 'Zoé', 'Gaspard', 'Lou', 'Basile'];

// Loups : un faux loup se range derrière le choix d'un vrai joueur de la meute, sinon derrière la majorité.
function wolfFollow(v) {
  const st = v.step;
  if (!st || st.type !== 'loups' || !Array.isArray(st.live)) return null;
  const isBot = (id) => { const p = v.players.find((x) => x.id === id); return !p || p.bot; };
  const human = st.live.find((c) => c.target && c.voter !== v.me.id && !isBot(c.voter));
  if (human) return human.target;
  const tally = {};
  for (const c of st.live) if (c.target && c.voter !== v.me.id) tally[c.target] = (tally[c.target] || 0) + 1;
  const best = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
  return best || null;
}

// Choix d'un faux joueur à partir de sa propre vue (comme un vrai joueur).
function choose(v) {
  const st = v.step;
  if (!st || st.resolved || !st.isActor || st.submitted) return null;
  const alive = v.players.filter((p) => p.alive && !p.isMJ);
  const others = alive.filter((p) => p.id !== v.me.id).map((p) => p.id);
  const opts = Array.isArray(st.options) && st.options.length ? st.options : others;
  switch (st.type) {
    case 'cupidon': case 'flute': { const a = shuffled(opts); return { targets: a.slice(0, Math.min(2, a.length)) }; }
    case 'renard': return { target: Math.random() < 0.2 ? null : rnd(opts) };
    case 'loupblanc': return { target: Math.random() < 0.5 || !st.options || !st.options.length ? null : rnd(st.options) };
    case 'voleur': return { take: st.mustTake || Math.random() < 0.6 ? Math.floor(Math.random() * 2) : null };
    case 'infect': return { infect: Math.random() < 0.5 };
    case 'sorciere': return { save: Math.random() < 0.5, kill: st.potions && st.potions.death && Math.random() < 0.3 ? rnd(others) : null };
    case 'vote': return { target: Math.random() < 0.1 ? null : rnd(opts) };
    case 'loups': return { target: wolfFollow(v) || rnd(opts) };
    case 'n_voyante': return Math.random() < 0.5 ? { center: [0, 2] } : { target: rnd(opts) };
    case 'n_noiseuse': return Math.random() < 0.2 ? { targets: null } : { targets: shuffled(opts).slice(0, 2) };
    case 'n_soulard': return { center: Math.floor(Math.random() * 3) };
    case 'n_loups': return st.lone ? { center: 1 } : {};
    case 'roles_reveal': case 'soeurs': case 'amoureux': case 'debate': case 'n_sbire': case 'n_macons': case 'n_insomniaque': return {};
    case 'compoVote': return { roles: [] };
    default: return opts.length ? { target: rnd(opts) } : {};
  }
}

// Appelé à chaque changement du salon : chaque faux joueur attendu agit après un petit délai.
function drive(room) {
  if (!room.test || !room.test.auto) return;
  const s = room.step;
  if (!s || s.resolved) return;
  room.botPending = room.botPending || new Set();
  for (const id of s.actors) {
    const p = room.players.get(id);
    // Loups : un faux loup qui a déjà choisi se range derrière la meute si elle change d'avis.
    if (p && p.bot && s.type === 'loups' && s.inputs && id in s.inputs) {
      const want = wolfFollow(room.viewFor(id));
      const key = `follow:${id}:${JSON.stringify(s.inputs)}`;
      if (want && want !== s.inputs[id] && !room.botPending.has(key)) {
        room.botPending.add(key);
        setTimeout(() => { try { if (room.step === s && !s.resolved) room.act(id, { target: want }); } catch (e) { /* cible refusée */ } }, (900 + Math.random() * 1500) * Math.max(0.3, room.speed || 1));
      }
      continue;
    }
    if (!p || !p.bot || (s.inputs && id in s.inputs)) continue;
    const key = `${s.type}:${s.round || 1}:${s.deadline}:${id}`;
    if (room.botPending.has(key)) continue;
    room.botPending.add(key);
    const delay = (700 + Math.random() * 2300) * Math.max(0.3, room.speed || 1);
    setTimeout(() => {
      try {
        if (room.step !== s || s.resolved || (s.inputs && id in s.inputs)) return;
        const payload = choose(room.viewFor(id));
        if (payload) room.act(id, payload);
      } catch (e) { /* choix refusé : le minuteur fera avancer la partie */ }
    }, delay);
  }
}

module.exports = { choose, drive, NAMES };
