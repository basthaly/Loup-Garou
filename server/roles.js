// Définition des rôles et composition automatique.
// impl: true = règles gérées par le moteur dans cette version.

const ROLES = {
  // Jeu de base
  loup:        { name: 'Loup-Garou',        team: 'loups',     ext: 'base', impl: true,  desc: 'Chaque nuit, les loups désignent ensemble une victime.' },
  villageois:  { name: 'Simple Villageois', team: 'village',   ext: 'base', impl: true,  desc: 'Aucun pouvoir, seulement son vote et sa parole.' },
  voyante:     { name: 'Voyante',           team: 'village',   ext: 'base', impl: true,  desc: "Chaque nuit, découvre le rôle d'un joueur." },
  sorciere:    { name: 'Sorcière',          team: 'village',   ext: 'base', impl: true,  desc: 'Une potion de vie et une potion de mort, utilisables une fois chacune.' },
  chasseur:    { name: 'Chasseur',          team: 'village',   ext: 'base', impl: true,  desc: 'En mourant, il emporte un joueur avec lui.' },
  cupidon:     { name: 'Cupidon',           team: 'village',   ext: 'base', impl: true,  desc: 'La première nuit, il désigne deux amoureux qui vivent et meurent ensemble.' },
  petitefille: { name: 'Petite Fille',      team: 'village',   ext: 'base', impl: true,  desc: 'Pendant le tour des loups, voit leur vidéo floutée (sans le son).' },
  voleur:      { name: 'Voleur',            team: 'village',   ext: 'base', impl: false, desc: 'Peut échanger sa carte la première nuit.' },
  // Nouvelle Lune
  ancien:      { name: 'Ancien',            team: 'village',   ext: 'nouvelleLune', impl: true,  desc: 'Survit à la première attaque des loups.' },
  salvateur:   { name: 'Salvateur',         team: 'village',   ext: 'nouvelleLune', impl: true,  desc: "Chaque nuit, protège un joueur (pas le même deux nuits de suite)." },
  idiot:       { name: 'Idiot du village',  team: 'village',   ext: 'nouvelleLune', impl: true,  desc: 'Gracié la première fois que le village vote contre lui, mais ne vote plus.' },
  bouc:        { name: 'Bouc émissaire',    team: 'village',   ext: 'nouvelleLune', impl: true,  desc: "En cas d'égalité au vote du village, c'est lui qui meurt." },
  flute:       { name: 'Joueur de flûte',   team: 'solitaire', ext: 'nouvelleLune', impl: false, desc: 'Charme deux joueurs par nuit pour gagner seul.' },
  // Personnages
  loupblanc:   { name: 'Loup-Garou Blanc',  team: 'solitaire', ext: 'personnages', impl: false, desc: 'Loup qui cherche à gagner seul.' },
  grandloup:   { name: 'Grand Méchant Loup', team: 'loups',    ext: 'personnages', impl: false, desc: "Dévore une victime de plus tant qu'aucun loup n'est mort." },
  infect:      { name: 'Infect Père des Loups', team: 'loups', ext: 'personnages', impl: false, desc: 'Peut transformer la victime en loup, une fois.' },
  enfant:      { name: 'Enfant Sauvage',    team: 'village',   ext: 'personnages', impl: false, desc: 'Devient loup si son modèle meurt.' },
  renard:      { name: 'Renard',            team: 'village',   ext: 'personnages', impl: false, desc: 'Flaire la présence de loups parmi trois voisins.' },
  soeurs:      { name: 'Deux Sœurs',        team: 'village',   ext: 'personnages', impl: false, desc: 'Se reconnaissent et peuvent se concerter.' },
  chevalier:   { name: "Chevalier à l'épée rouillée", team: 'village', ext: 'personnages', impl: false, desc: 'À sa mort, infecte un loup qui meurt à son tour.' },
  ange:        { name: 'Ange',              team: 'solitaire', ext: 'personnages', impl: false, desc: "Gagne s'il est éliminé au premier vote." }
};

const EXTENSIONS = { base: 'Jeu de base', nouvelleLune: 'Nouvelle Lune', personnages: 'Personnages' };

// Rôles spéciaux ajoutés dans cet ordre selon le nombre de joueurs.
const PRIORITY = [
  ['voyante', 6], ['chasseur', 6], ['sorciere', 7], ['cupidon', 8], ['petitefille', 10],
  ['salvateur', 11], ['ancien', 12], ['idiot', 13], ['bouc', 14]
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
  const chosen = Object.keys(counts)
    .filter((r) => counts[r] >= needed && ROLES[r] && ROLES[r].impl && r !== 'loup' && r !== 'villageois' && extAllowed(r, extensions))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const r of chosen) {
    if (used >= n) break;
    compo[r] = 1;
    used++;
  }
  if (n - used > 0) compo.villageois = n - used;
  return { compo, counts };
}

function compoSize(compo) {
  return Object.values(compo).reduce((a, b) => a + b, 0);
}

module.exports = { ROLES, EXTENSIONS, MIN_PLAYERS, MAX_PLAYERS, autoComposition, votedComposition, compoSize, extAllowed };
