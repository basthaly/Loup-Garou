// Définition des rôles et composition automatique.
// impl: true = règles gérées par le moteur dans cette version.

const ROLES = {
  // Jeu de base
  loup:        { name: 'Loup-Garou',        team: 'loups',     ext: 'base', impl: true, desc: 'Chaque nuit, les loups désignent ensemble une victime.' },
  villageois:  { name: 'Simple Villageois', team: 'village',   ext: 'base', impl: true, desc: 'Aucun pouvoir, seulement son vote et sa parole.' },
  voyante:     { name: 'Voyante',           team: 'village',   ext: 'base', impl: true, desc: "Chaque nuit, découvre le rôle d'un joueur." },
  sorciere:    { name: 'Sorcière',          team: 'village',   ext: 'base', impl: true, desc: 'Une potion de vie et une potion de mort, utilisables une fois chacune.' },
  chasseur:    { name: 'Chasseur',          team: 'village',   ext: 'base', impl: true, desc: 'En mourant, il emporte un joueur avec lui.' },
  cupidon:     { name: 'Cupidon',           team: 'village',   ext: 'base', impl: true, desc: 'La première nuit, il désigne deux amoureux qui vivent et meurent ensemble.' },
  petitefille: { name: 'Petite Fille',      team: 'village',   ext: 'base', impl: true, desc: 'Pendant le tour des loups, voit tout le village flou (sans le son).' },
  voleur:      { name: 'Voleur',            team: 'village',   ext: 'base', impl: true, desc: 'La première nuit, peut prendre une des deux cartes restantes. Deux loups : il doit en prendre une.' },
  // Nouvelle Lune
  ancien:      { name: 'Ancien',            team: 'village',   ext: 'nouvelleLune', impl: true, desc: 'Survit à la première attaque des loups.' },
  salvateur:   { name: 'Salvateur',         team: 'village',   ext: 'nouvelleLune', impl: true, desc: "Chaque nuit, protège un joueur (pas le même deux nuits de suite)." },
  idiot:       { name: 'Idiot du village',  team: 'village',   ext: 'nouvelleLune', impl: true, desc: 'Gracié la première fois que le village vote contre lui, mais ne vote plus.' },
  bouc:        { name: 'Bouc émissaire',    team: 'village',   ext: 'nouvelleLune', impl: true, desc: "En cas d'égalité au vote du village, c'est lui qui meurt." },
  flute:       { name: 'Joueur de flûte',   team: 'solitaire', ext: 'nouvelleLune', impl: true, desc: 'Charme deux joueurs par nuit. Gagne seul quand tous les vivants sont charmés.' },
  // Personnages
  loupblanc:   { name: 'Loup-Garou Blanc',  team: 'solitaire', ext: 'personnages', impl: true, desc: 'Chasse avec les loups. Une nuit sur deux, peut tuer un loup. Gagne s\'il reste seul.' },
  grandloup:   { name: 'Grand Méchant Loup', team: 'loups',    ext: 'personnages', impl: true, desc: "Dévore une victime de plus tant qu'aucun loup n'est mort." },
  infect:      { name: 'Infect Père des Loups', team: 'loups', ext: 'personnages', impl: true, desc: 'Une fois par partie, transforme la victime des loups en loup au lieu de la tuer.' },
  enfant:      { name: 'Enfant Sauvage',    team: 'village',   ext: 'personnages', impl: true, desc: 'Choisit un modèle la première nuit. Si le modèle meurt, il devient loup.' },
  renard:      { name: 'Renard',            team: 'village',   ext: 'personnages', impl: true, desc: "Chaque nuit, flaire un joueur et ses deux voisins. S'il n'y a aucun loup, il perd son flair." },
  soeur:       { name: 'Sœur',              team: 'village',   ext: 'personnages', impl: true, desc: 'Les deux Sœurs se connaissent et se concertent une nuit sur deux.', count: 2 },
  chevalier:   { name: "Chevalier à l'épée rouillée", team: 'village', ext: 'personnages', impl: true, desc: 'Tué par les loups, il blesse le premier loup après lui, qui meurt la nuit suivante.' },
  ange:        { name: 'Ange',              team: 'solitaire', ext: 'personnages', impl: true, desc: "Gagne seul s'il est éliminé au premier vote du village." }
};

// Rôles qui se réveillent avec les loups.
const WOLF_ROLES = ['loup', 'grandloup', 'infect', 'loupblanc'];
// Nombre de cartes ajoutées d'un coup (les Sœurs vont par deux).
const cardStep = (key) => (ROLES[key] && ROLES[key].count) || 1;
// Nombre de cartes à distribuer : le Voleur en ajoute deux au centre.
const cardsNeeded = (n, compo) => n + (compo && compo.voleur ? 2 : 0);

const EXTENSIONS = { base: 'Jeu de base', nouvelleLune: 'Nouvelle Lune', personnages: 'Personnages' };

// Rôles spéciaux ajoutés dans cet ordre selon le nombre de joueurs.
const PRIORITY = [
  ['voyante', 6], ['chasseur', 6], ['sorciere', 7], ['cupidon', 8], ['petitefille', 10],
  ['salvateur', 11], ['ancien', 12], ['idiot', 13], ['bouc', 14], ['renard', 15], ['chevalier', 16]
];

const MIN_PLAYERS = 6;
const MAX_PLAYERS = 18;

function wolfCount(n) {
  if (n >= 16) return 4;
  if (n >= 12) return 3;
  if (n >= 6) return 2;
  return 1;
}

function extAllowed(key, extensions) {
  const ext = ROLES[key].ext;
  return ext === 'base' || !!extensions[ext];
}

// Composition automatique pour n joueurs.
function autoComposition(n, extensions) {
  const compo = {};
  if (n < 1) return compo;
  const wolves = Math.min(wolfCount(n), Math.max(1, n - 1));
  compo.loup = wolves;
  let used = wolves;
  for (const [key, min] of PRIORITY) {
    if (n >= min && used < n && ROLES[key].impl && extAllowed(key, extensions)) {
      compo[key] = 1;
      used++;
    }
  }
  if (n - used > 0) compo.villageois = n - used;
  return compo;
}

// Composition issue du vote des joueurs : un rôle est retenu s'il a au moins la moitié des voix.
function votedComposition(n, extensions, ballots) {
  const counts = {};
  for (const roles of ballots) for (const r of roles) counts[r] = (counts[r] || 0) + 1;
  const needed = Math.ceil(ballots.length / 2);
  const wolves = Math.min(wolfCount(n), Math.max(1, n - 1));
  const compo = { loup: wolves };
  let used = wolves;
  const order = PRIORITY.map((p) => p[0]);
  const rank = (r) => (order.includes(r) ? order.indexOf(r) : 100);
  const chosen = Object.keys(counts)
    .filter((r) => counts[r] >= needed && ROLES[r] && ROLES[r].impl && r !== 'loup' && r !== 'villageois' && extAllowed(r, extensions))
    .sort((a, b) => rank(a) - rank(b) || counts[b] - counts[a]);
  for (const r of chosen) {
    // Un loup spécial remplace un simple loup.
    if ((r === 'grandloup' || r === 'infect') && compo.loup > 0) {
      compo.loup--; if (!compo.loup) delete compo.loup;
      compo[r] = 1;
      continue;
    }
    const k = cardStep(r);
    if (used + k > n) continue;
    compo[r] = k;
    used += k;
  }
  let vill = n - used + (compo.voleur ? 2 : 0);
  if (vill > 0) compo.villageois = vill;
  return { compo, counts };
}

function compoSize(compo) {
  return Object.values(compo).reduce((a, b) => a + b, 0);
}

module.exports = { ROLES, EXTENSIONS, WOLF_ROLES, MIN_PLAYERS, MAX_PLAYERS, autoComposition, votedComposition, compoSize, extAllowed, cardStep, cardsNeeded };
