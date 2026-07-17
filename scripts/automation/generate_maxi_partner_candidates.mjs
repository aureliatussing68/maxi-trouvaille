import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "business-maxi-trouvailles", "produits-a-valider");
const logsDir = path.join(root, "business-maxi-trouvailles", "logs");

const sources = [
  {
    name: "VelocitySpy pet trends",
    url: "https://velocityspy.com/trending/pet-supplies/",
    note: "Pet grooming, pet hair removers, water bottles and pet utility products are active TikTok-style niches.",
  },
  {
    name: "VelocitySpy niches",
    url: "https://velocityspy.com/blog/best-tiktok-niches-dropshipping",
    note: "Phone accessories, clever kitchen gadgets and car tech gadgets keep producing short-video winners.",
  },
  {
    name: "Kalodata TikTok Shop 2026",
    url: "https://www.kalodata.com/blog/tiktok/the-2026-tiktok-shop-goldmine-20-best-selling-products-the-data-behind-the-viral-trends/",
    note: "Visible transformations and desk setup/home-tech products are useful angles.",
  },
  {
    name: "FindNiche AliExpress EU electronics 2026",
    url: "https://findniche.com/aliexpress/best-selling-consumer-electronics-products-europe",
    note: "Consumer electronics shipped from Europe remain a relevant research lane.",
  },
  {
    name: "AliExpress Choice shipping context",
    url: "https://secretali.com/guide/aliexpress-choice-vs-standard-shipping-2026",
    note: "Choice/fast-shipping labels should be verified manually per product and destination.",
  },
];

const categoryBatches = {
  "auto-moto": [
    "mini aspirateur voiture sans fil compact",
    "support telephone voiture rotation 360",
    "organisateur coffre voiture filet rangement",
    "compresseur air portable pneus voiture",
    "kit nettoyage interieur voiture detailing",
    "lampe secours LED voiture rechargeable",
    "cable charge rapide voiture USB C",
    "protection siege voiture animaux",
    "camera recul voiture universelle",
    "support lunettes pare soleil voiture",
  ],
  "high-tech": [
    "mini imprimante thermique bluetooth",
    "projecteur galaxie LED ambiance chambre",
    "support ordinateur portable pliant aluminium",
    "hub USB C multiport compact",
    "lampe ecran moniteur LED USB",
    "station charge multiple bureau",
    "telecommande universelle climatiseur",
    "ecouteurs gaming faible latence",
    "mini clavier bluetooth retroeclaire",
    "ventilateur tour de cou rechargeable",
  ],
  "telephonie": [
    "support telephone bureau magnetique",
    "coque antichoc universelle smartphone",
    "cable USB C nylon charge rapide",
    "chargeur voiture USB C double port",
    "anneau support telephone magsafe",
    "pochette etanche telephone sport",
    "mini trepied telephone vlog",
    "objectif macro telephone clip",
    "support velo telephone silicone",
    "station charge telephone montre ecouteurs",
  ],
  "maison-deco": [
    "lampe LED detecteur mouvement placard",
    "organisateur tiroir modulable maison",
    "tapis silicone anti eclaboussures evier",
    "projecteur coucher soleil LED deco",
    "boite rangement cables multiprise",
    "crochets adhesifs cuisine salle de bain",
    "mini humidificateur USB bureau",
    "veilleuse couloir detection mouvement",
    "range chaussures gain place",
    "brosse nettoyage joints carrelage",
  ],
  jardin: [
    "lampe solaire jardin detecteur mouvement",
    "pistolet arrosage haute pression jardin",
    "capteur humidite sol plante",
    "gants jardinage griffes plantation",
    "attaches plantes reutilisables jardin",
    "mini serre semis balcon",
    "kit goutte a goutte plantes balcon",
    "brosse nettoyage terrasse perceuse",
    "sac plantation pommes de terre balcon",
    "thermometre humidite serre jardin",
  ],
  "outillage-electricite": [
    "kit tournevis precision 24 pieces",
    "organisateur embouts perceuse",
    "lampe travail LED rechargeable",
    "testeur tension sans contact",
    "serre cable reutilisable velcro",
    "mini niveau laser bricolage",
    "boite rangement vis compartiments",
    "pince denuder automatique cable",
    "ruban adhesif nano double face",
    "multimetre numerique compact",
  ],
  animaux: [
    "brosse anti poils animaux reutilisable",
    "gourde portable chien promenade",
    "gant toilettage animaux poils",
    "laisse retractable chien LED",
    "tapis gamelle silicone animaux",
    "coupe griffes electrique chien chat",
    "jouet distributeur friandises chien",
    "fontaine eau chat silencieuse",
    "siege voiture chien securite",
    "rouleau nettoyage poils animaux lavable",
  ],
  "sport-loisirs": [
    "gourde pliable silicone sport voyage",
    "elastiques resistance fitness kit",
    "lampe frontale rechargeable camping",
    "serviette microfibre sport voyage",
    "pompe velo portable mini",
    "support telephone course brassard",
    "sac etanche camping randonnee",
    "corde a sauter compteur fitness",
    "mousquetons accessoires camping",
    "mini trousse premiers secours sport",
  ],
  "jeux-video-gaming": [
    "support casque gaming RGB",
    "tapis souris gaming XXL LED",
    "refroidisseur telephone gaming",
    "grips joystick manette silicone",
    "dock charge manette PS5 compatible",
    "support manette bureau gaming",
    "clavier mecanique mini RGB",
    "micro cravate USB C streaming",
    "led strip setup gaming bureau",
    "range cables setup gaming",
  ],
  "gadgets-jouets": [
    "mini drone interieur debutant",
    "stylo 3D basse temperature enfant",
    "jouet puzzle magnetique construction",
    "veilleuse astronaute galaxie",
    "camera enfant rechargeable",
    "robot dessin educatif enfant",
    "tapis eau dessin enfant",
    "kit experiences sciences enfant",
    "mini projecteur dessin enfant",
    "jouet lance balle automatique animaux",
  ],
};

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function supplierSearchUrl(query) {
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(`${query} Choice Europe`)}`;
}

function buildCandidate(category, query, index) {
  const name = query
    .split(" ")
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(" ");

  return {
    id: `maxi_c006_${category}_${String(index + 1).padStart(2, "0")}`,
    status: "a_valider",
    publicationStatus: "not_published",
    category,
    name,
    supplierSearchUrl: supplierSearchUrl(query),
    supplierTarget: "AliExpress Choice / fournisseur Europe a verifier",
    deliveryTarget: "Ideal 4 a 10 jours, maximum conseille 14 jours apres verification",
    sellingAngle: "Produit visuel, utile au quotidien, simple a demontrer en video courte.",
    checksRequired: [
      "Verifier fournisseur reel, stock, delai France/Europe et tracking.",
      "Verifier droits d'utilisation des visuels avant publication publique.",
      "Verifier conformite produit, notices, securite et retours.",
      "Ne pas commander automatiquement.",
    ],
  };
}

const candidates = Object.entries(categoryBatches).flatMap(([category, queries]) =>
  queries.map((query, index) => buildCandidate(category, query, index)),
);

const generatedAt = new Date().toISOString();
const output = {
  generatedAt,
  mode: "supplier_research_queue_no_order_no_publication",
  warning:
    "File de selection uniquement. Chaque produit doit etre verifie manuellement avant import public ou commande fournisseur.",
  candidateCount: candidates.length,
  sources,
  candidates,
};

function markdownTable() {
  const lines = [
    "# Selection produits fournisseurs - Couche 006",
    "",
    `Date: ${generatedAt}`,
    "",
    "Statut: recherche a valider, aucune commande, aucune publication.",
    "",
    "## Sources de tendance consultees",
    "",
    ...sources.map((source) => `- ${source.name}: ${source.url}`),
    "",
    "## Candidats par categorie",
    "",
  ];

  for (const [category, queries] of Object.entries(categoryBatches)) {
    lines.push(`### ${category}`, "");
    for (const [index, query] of queries.entries()) {
      const candidate = buildCandidate(category, query, index);
      lines.push(
        `- ${candidate.name} | recherche fournisseur: ${candidate.supplierSearchUrl}`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(logsDir, { recursive: true });

const jsonPath = path.join(outputDir, "selection_couche_006_20260527.json");
const mdPath = path.join(outputDir, "selection_couche_006_20260527.md");
writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
writeFileSync(mdPath, markdownTable(), "utf8");
writeFileSync(
  path.join(logsDir, "RAPPORT_MAXI_COUCHE_006_SELECTION_PRODUITS_20260527.md"),
  [
    "# Rapport Maxi - Couche 006 - Selection produits",
    "",
    "Objectif: preparer une file de produits fournisseurs a valider par categorie, sans achat ni publication.",
    "",
    `Candidats generes: ${candidates.length}`,
    "",
    "Sorties:",
    `- ${jsonPath}`,
    `- ${mdPath}`,
    "",
    "Garde-fous:",
    "- Aucun secret affiche.",
    "- Aucune commande fournisseur.",
    "- Aucune publication TikTok ou reseau social.",
    "- Chaque visuel/source/delai reste a verifier avant mise en ligne publique.",
    "",
  ].join("\n"),
  "utf8",
);

console.log(JSON.stringify({ jsonPath, mdPath, candidateCount: candidates.length }, null, 2));
