// Définition des rôles et composition automatique.
// impl: true = règles gérées par le moteur dans cette version.

const ROLES = {
  // Jeu de base
  loup:        { name: 'Loup-Garou',        team: 'loups',     ext: 'base', impl: true, desc: 'Chaque nuit, les loups désignent ensemble une victime.', how: ["La nuit, tu te réveilles avec la meute : vous vous voyez et vous vous entendez.", "Touchez le visage de votre victime. En cas de désaccord, il y a un second tour.", "Le jour, fais-toi passer pour un villageois.", "Les loups gagnent quand ils sont aussi nombreux que les autres."] },
  villageois:  { name: 'Simple Villageois', team: 'village',   ext: 'base', impl: true, desc: 'Aucun pouvoir, seulement son vote et sa parole.', how: ["La nuit, tu dors.", "Le jour, écoute, débats et vote pour éliminer un suspect.", "Le village gagne quand tous les loups sont morts."] },
  voyante:     { name: 'Voyante',           team: 'village',   ext: 'base', impl: true, desc: "Chaque nuit, découvre le rôle d'un joueur.", how: ["Chaque nuit, touche un joueur : son rôle s'affiche, pour toi seule.", "Tes visions restent dans le panneau (bouton en bas à droite).", "Guide le village sans te dévoiler trop tôt : les loups te cherchent."] },
  sorciere:    { name: 'Sorcière',          team: 'village',   ext: 'base', impl: true, desc: 'Une potion de vie et une potion de mort, utilisables une fois chacune.', how: ["Chaque nuit, tu vois qui les loups ont choisi (badge « En danger »).", "Potion de vie : bouton « Sauver » sur sa vignette. Une fois par partie.", "Poison : bouton « Poison » sur un autre joueur. Une fois par partie.", "Rien à faire ? Touche « Passer »."] },
  chasseur:    { name: 'Chasseur',          team: 'village',   ext: 'base', impl: true, desc: 'En mourant, il emporte un joueur avec lui.', how: ["Quand tu meurs, tu choisis aussitôt un joueur à emporter avec toi.", "Touche son visage, puis valide."] },
  cupidon:     { name: 'Cupidon',           team: 'village',   ext: 'base', impl: true, desc: 'La première nuit, il désigne deux amoureux qui vivent et meurent ensemble.', how: ["La première nuit, touche deux joueurs : ils deviennent amoureux (tu peux te choisir).", "Si l'un meurt, l'autre meurt de chagrin.", "Un loup et un villageois amoureux gagnent ensemble s'ils sont les deux derniers."] },
  petitefille: { name: 'Petite Fille',      team: 'village',   ext: 'base', impl: true, desc: 'Pendant le tour des loups, voit tout le village flou (sans le son).', how: ["Pendant le tour des loups, tu vois tout le village, flou et sans le son.", "Repère qui est réveillé… sans te faire remarquer."] },
  voleur:      { name: 'Voleur',            team: 'village',   ext: 'base', impl: true, desc: 'La première nuit, peut prendre une des deux cartes restantes. Deux loups : il doit en prendre une.', how: ["La première nuit, les deux cartes en trop s'affichent.", "Prends-en une (tu joues ce rôle) ou garde ta carte.", "S'il y a deux loups, tu dois en prendre un."] },
  // Nouvelle Lune
  ancien:      { name: 'Ancien',            team: 'village',   ext: 'nouvelleLune', impl: true, desc: 'Survit à la première attaque des loups.', how: ["Les loups doivent t'attaquer deux fois pour te tuer.", "Si le village t'élimine, tous les villageois perdent leurs pouvoirs."] },
  salvateur:   { name: 'Salvateur',         team: 'village',   ext: 'nouvelleLune', impl: true, desc: "Chaque nuit, protège un joueur (pas le même deux nuits de suite).", how: ["Chaque nuit, touche un joueur à protéger des loups (toi compris).", "Pas le même deux nuits de suite."] },
  idiot:       { name: 'Idiot du village',  team: 'village',   ext: 'nouvelleLune', impl: true, desc: 'Gracié la première fois que le village vote contre lui, mais ne vote plus.', how: ["Si le village vote contre toi, tu es gracié et ton rôle est dévoilé.", "Ensuite, tu ne votes plus."] },
  bouc:        { name: 'Bouc émissaire',    team: 'village',   ext: 'nouvelleLune', impl: true, desc: "En cas d'égalité au vote du village, c'est lui qui meurt.", how: ["En cas d'égalité au vote du village, c'est toi qui meurs.", "Pousse le village à se décider !"] },
  flute:       { name: 'Joueur de flûte',   team: 'solitaire', ext: 'nouvelleLune', impl: true, desc: 'Charme deux joueurs par nuit. Gagne seul quand tous les vivants sont charmés.', how: ["Chaque nuit, touche deux joueurs pour les charmer.", "Les charmés le savent et se reconnaissent.", "Tu gagnes seul quand tous les vivants sont charmés."] },
  // Personnages
  loupblanc:   { name: 'Loup-Garou Blanc',  team: 'solitaire', ext: 'personnages', impl: true, desc: 'Chasse avec les loups. Une nuit sur deux, peut tuer un loup. Gagne s\'il reste seul.', how: ["Tu chasses avec les loups, qui te prennent pour l'un des leurs.", "Une nuit sur deux, tu peux tuer un loup, ou passer.", "Tu gagnes seul si tu es le dernier survivant."] },
  grandloup:   { name: 'Grand Méchant Loup', team: 'loups',    ext: 'personnages', impl: true, desc: "Dévore une victime de plus tant qu'aucun loup n'est mort.", how: ["Tu chasses avec la meute.", "Ensuite, seul, tu dévores une victime de plus.", "Ce pouvoir s'arrête dès qu'un loup meurt."] },
  infect:      { name: 'Infect Père des Loups', team: 'loups', ext: 'personnages', impl: true, desc: 'Une fois par partie, transforme la victime des loups en loup au lieu de la tuer.', how: ["Tu chasses avec la meute.", "Une fois par partie, après le choix des loups, tu peux infecter la victime : elle survit, devient loup et garde son pouvoir."] },
  enfant:      { name: 'Enfant Sauvage',    team: 'village',   ext: 'personnages', impl: true, desc: 'Choisit un modèle la première nuit. Si le modèle meurt, il devient loup.', how: ["La première nuit, touche un joueur : ce sera ton modèle.", "Tant qu'il vit, tu joues avec le village. S'il meurt, tu deviens loup."] },
  renard:      { name: 'Renard',            team: 'village',   ext: 'personnages', impl: true, desc: "Chaque nuit, flaire un joueur et ses deux voisins. S'il n'y a aucun loup, il perd son flair.", how: ["Chaque nuit, touche un joueur : tu sais s'il y a un loup parmi lui et ses deux voisins.", "Aucun loup ? Tu perds ton flair."] },
  soeur:       { name: 'Sœur',              team: 'village',   ext: 'personnages', impl: true, desc: 'Les deux Sœurs se connaissent et se concertent une nuit sur deux.', count: 2, how: ["Tu sais qui est ta sœur.", "Une nuit sur deux, vous vous réveillez pour vous parler. Touchez « Terminé » quand c'est fini."] },
  chevalier:   { name: "Chevalier à l'épée rouillée", team: 'village', ext: 'personnages', impl: true, desc: 'Tué par les loups, il blesse le premier loup après lui, qui meurt la nuit suivante.', how: ["Si les loups te tuent, le premier loup assis après toi meurt la nuit suivante."] },
  ange:        { name: 'Ange',              team: 'solitaire', ext: 'personnages', impl: true, desc: "Gagne seul s'il est éliminé au premier vote du village.", how: ["Fais-toi éliminer au premier vote du village : tu gagnes seul.", "Sinon, tu deviens un simple villageois."] }
};

// Rôles qui se réveillent avec les loups.
const WOLF_ROLES = ['loup', 'grandloup', 'infect', 'loupblanc'];
// Nombre de cartes ajoutées d'un coup (les Sœurs vont par deux).
const cardStep = (key) => (ROLES[key] && ROLES[key].count) || 1;
// Nombre de cartes à distribuer : le Voleur en ajoute deux au centre.
const cardsNeeded = (n, compo) => n + (compo && compo.voleur ? 2 : 0);

// Déroulé d'une partie, pour le bouton d'aide.
const RULES = [
  'La nuit, chaque rôle se réveille à son tour. Les autres dorment : ni image ni son.',
  "À l'aube, on découvre qui est mort.",
  'Le jour, tout le monde débat et vote. Le plus désigné est éliminé, les votes sont révélés ensemble.',
  'Le premier jour, le village élit un Capitaine : son vote compte double.',
  "Les morts voient et entendent tout, mais ne parlent qu'aux autres morts.",
  'Le village gagne quand tous les loups sont morts, les loups quand ils sont aussi nombreux que les autres.'
];

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

module.exports = { ROLES, RULES, EXTENSIONS, WOLF_ROLES, MIN_PLAYERS, MAX_PLAYERS, autoComposition, votedComposition, compoSize, extAllowed, cardStep, cardsNeeded };
