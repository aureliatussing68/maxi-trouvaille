/**
 * Informations de securite affichees sur la fiche produit.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * L'audit du 05/08/2026 a mesure que 283 fiches publiees sur 287 ne portaient
 * AUCUN avertissement de securite. Or l'article 19 du reglement (UE) 2023/988
 * impose que l'offre en ligne comporte les informations de securite du produit,
 * et l'article 9 impose que ces informations soient dans une langue aisement
 * comprehensible par le consommateur — donc en francais.
 *
 * CE QUE CE FICHIER FAIT, ET SURTOUT CE QU'IL NE FAIT PAS
 *
 * Il n'invente aucune caracteristique technique. Il n'affirme aucun marquage
 * CE, aucune classe laser, aucune capacite de batterie, aucune conformite. Tout
 * cela suppose des documents que nous n'avons pas.
 *
 * Il affiche uniquement des precautions d'usage qui sont vraies pour toute la
 * famille de produits concernee, et qu'aucun document fournisseur n'est
 * necessaire pour connaitre : un appareil qui chauffe brule, un faisceau laser
 * ne se pointe pas vers un oeil, une batterie lithium n'aime ni la chaleur ni
 * les chocs. Aucune de ces phrases ne peut devenir fausse selon le modele.
 *
 * Une exception : le message audio ci-dessous n'est pas une precaution redigee
 * par nous, c'est un texte LEGAL impose mot pour mot. Il ne doit pas etre
 * reformule.
 *
 * CE QUE CA NE REMPLACE PAS
 *
 * Ces informations ne remplacent pas la notice du fabricant, ni la declaration
 * UE de conformite, ni les avertissements qui doivent figurer sur le produit
 * lui-meme ou son emballage. Ces obligations-la pesent sur le colis physique et
 * supposent la cooperation du fournisseur. Voir le rapport du 05/08/2026.
 *
 * COMMENT LE CLASSEMENT EST FAIT
 *
 * Sur le NOM du produit uniquement, jamais sur la description. Un premier essai
 * qui cherchait aussi dans la description classait « Support casque gamer RGB »
 * comme un casque et « Support eponge evier » comme un appareil chauffant. Le
 * nom est court, choisi par nous, et ne parle que du produit lui-meme.
 * Les motifs `sauf` retirent les accessoires qui portent le nom de l'appareil
 * sans en etre un.
 */

type RegleSecurite = {
  /** Nom de la famille, pour s'y retrouver. */
  famille: string;
  /** Motifs cherches dans le nom normalise (minuscules, sans accents). */
  motifs: RegExp[];
  /** Motifs qui excluent la fiche meme si un motif ci-dessus correspond. */
  sauf?: RegExp[];
  /** Phrases affichees au client. */
  avertissements: string[];
};

const REGLES: RegleSecurite[] = [
  {
    famille: "Audio",
    motifs: [/\becouteurs?\b/, /\bcasque\b/, /\boreillette/, /\bearbuds?\b/],
    sauf: [
      /\bsupport\b/,
      /\bporte-/,
      /\bcrochet/,
      /\bstand\b/,
      /\bpochette/,
      /\bhousse/,
      /\betui/,
    ],
    avertissements: [
      // Texte impose mot pour mot par l'article L5232-1 du code de la sante
      // publique et l'arrete du 25 juillet 2013. NE PAS REFORMULER.
      "À pleine puissance, l'écoute prolongée du baladeur peut endommager l'oreille de l'utilisateur.",
    ],
  },
  {
    famille: "Batterie lithium",
    motifs: [
      /\bbatterie externe\b/,
      /\bpowerbank\b/,
      /\bbooster de demarrage\b/,
      /\bstation electrique\b/,
    ],
    // Formulation revue le 05/08/2026 : la version precedente affirmait « une
    // batterie au lithium ». C'etait une deduction, pas un fait mesure — la
    // chimie exacte n'est ecrite nulle part dans nos donnees. Ces produits sont
    // au lithium dans l'immense majorite des cas, mais « immense majorite » ne
    // suffit pas pour l'ecrire au client. Le texte parle donc de « batterie
    // rechargeable », ce qui est vrai par construction, et les precautions
    // restent identiques.
    avertissements: [
      "Cet appareil contient une batterie rechargeable. Ne l'exposez pas à une source de chaleur, ne le percez pas, ne le démontez pas, et cessez de l'utiliser s'il gonfle, chauffe anormalement ou se déforme.",
      "Rechargez-le avec un câble adapté et sous surveillance. Une batterie usagée ne se jette jamais avec les ordures ménagères : déposez-la dans une borne de collecte.",
    ],
  },
  {
    famille: "Appareil chauffant",
    motifs: [
      /\bfer a souder\b/,
      /\bpistolet a colle\b/,
      /\bbouilloire\b/,
      /\bair fryer\b/,
      /\bdefroisseur\b/,
      /\bboucleur\b/,
      // Pas de \b final sur ces trois-la, VOLONTAIREMENT : la frontiere de mot
      // apres « chauffant » exclut « chauffante », et la fiche « Brosse
      // lissante chauffante electrique » passait donc entre les mailles. C'est
      // le genre de detail qui ne se voit qu'en comptant les fiches couvertes
      // et en cherchant les manquantes une par une.
      /\bchauffant/,
      /\blissant/,
      /\blisseur/,
    ],
    sauf: [/\bsupport\b/, /\beponge\b/],
    avertissements: [
      "Cet appareil atteint une température élevée en fonctionnement : risque de brûlure au contact. Tenez-le hors de portée des enfants, ne le laissez pas sans surveillance allumé, et laissez-le refroidir complètement avant de le ranger.",
    ],
  },
  {
    famille: "Laser",
    motifs: [/\blaser\b/],
    avertissements: [
      "Cet appareil émet un rayonnement laser. Ne dirigez jamais le faisceau vers les yeux d'une personne ou d'un animal, et ne le regardez pas directement, y compris à travers un instrument optique.",
    ],
  },

  // Familles ajoutees le 05/08/2026 apres l'audit des 89 fiches sans document
  // requis. Meme doctrine que ci-dessus : rien qui depende du modele exact.
  {
    famille: "Aimants",
    motifs: [/\bmagnetique\b/, /\baimante?e?s?\b/],
    avertissements: [
      "Ce produit contient des aimants. Un aimant avalé peut provoquer des lésions internes graves : tenez-le hors de portée des enfants et consultez immédiatement un médecin en cas d'ingestion.",
      "Les aimants peuvent perturber les stimulateurs cardiaques et autres implants médicaux : gardez le produit à distance de ces dispositifs.",
    ],
  },
  {
    famille: "Tapis de sol voiture",
    motifs: [
      /\btapis de sol voiture\b/,
      /\btapis (?:de sol )?(?:de |pour )?voiture\b/,
    ],
    avertissements: [
      "Un tapis mal positionné peut gêner ou bloquer les pédales. Après l'installation, vérifiez que le tapis côté conducteur est bien maintenu en place et n'entrave ni l'accélérateur, ni le frein, ni l'embrayage. Ne superposez jamais deux tapis côté conducteur.",
    ],
  },
  {
    famille: "Sacs sous vide",
    motifs: [/\bsous vide\b/],
    avertissements: [
      "Les films et sacs plastiques présentent un risque d'étouffement : tenez-les hors de portée des enfants et des bébés, et ne les utilisez jamais comme jouet.",
    ],
  },
  {
    famille: "Paracorde",
    motifs: [/\bparacorde\b/, /\bcorde de survie\b/],
    avertissements: [
      "Cette corde n'est pas un équipement de protection individuelle : elle ne doit jamais servir à assurer, suspendre ou retenir une personne (escalade, travaux en hauteur, sécurité).",
    ],
  },
  {
    famille: "Élastiques de résistance",
    motifs: [
      /\belastique.{0,20}(musculation|resistance|fitness|sport)\b/,
      /\bbande.{0,15}resistance\b/,
    ],
    avertissements: [
      "Un élastique qui lâche ou glisse de son ancrage revient violemment vers le visage. Avant chaque séance, vérifiez l'état de l'élastique (coupures, craquelures) et la solidité du point d'ancrage, et remplacez-le au moindre signe d'usure.",
    ],
  },
  {
    famille: "Arbre à chat",
    motifs: [/\barbre a chat\b/],
    avertissements: [
      "Installez l'arbre à chat sur un sol plat et stable, contre un mur si possible. Vérifiez régulièrement le serrage des fixations : un meuble instable peut basculer sur l'animal ou sur un enfant.",
    ],
  },
  {
    famille: "Pince à dénuder",
    motifs: [/\bdenuder\b/],
    avertissements: [
      "Cet outil n'est pas un outil isolé pour travaux électriques : ne l'utilisez jamais sur un circuit ou un câble sous tension. Coupez l'alimentation avant toute intervention.",
    ],
  },
];

/** Minuscules, sans accents — pour comparer un nom aux motifs ci-dessus. */
function normaliser(valeur: string) {
  return valeur.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Avertissements de securite a afficher pour ce produit.
 *
 * Renvoie un tableau vide quand aucune regle ne s'applique — et c'est le cas le
 * plus frequent. On n'affiche jamais un avertissement generique « par
 * securite » : une precaution qui ne correspond a rien decredibilise toutes les
 * autres, et finit par etre ignoree la ou elle compte vraiment.
 */
export function getAvertissementsSecurite(nomProduit: string): string[] {
  const nom = normaliser(nomProduit);

  return REGLES.filter(
    (regle) =>
      regle.motifs.some((motif) => motif.test(nom)) &&
      !(regle.sauf ?? []).some((motif) => motif.test(nom)),
  ).flatMap((regle) => regle.avertissements);
}
