/**
 * ============================================================================
 *  IDENTITE LEGALE — c'est le SEUL fichier a modifier pour le juridique.
 * ============================================================================
 *
 * Tout le reste du site (mentions legales, CGV, retractation, confidentialite)
 * se met a jour tout seul a partir d'ici : il n'y a aucun autre endroit ou
 * recopier ces informations.
 *
 * Une ligne laissee vide s'affiche sur le site en clair comme
 * « [A COMPLETER : ...] ». C'est volontaire : mieux vaut un trou visible
 * qu'une mention legale fausse. Aucune information n'est inventee ici.
 *
 * ---------------------------------------------------------------------------
 *  REGLE ABSOLUE — LE NOM AFFICHE
 * ---------------------------------------------------------------------------
 * Le nom commercial de cette boutique est « Maxi Trouvaille », et rien d'autre.
 * L'entreprise individuelle exploite aussi une autre activite sous un nom
 * commercial different ; ce nom ne doit JAMAIS apparaitre sur maxitrouvaille.fr,
 * ni dans les pages, ni dans les emails, ni dans les metadonnees. Un client de
 * la boutique n'a pas a savoir qu'une autre activite existe.
 *
 * ---------------------------------------------------------------------------
 *  LE JOUR OU TU PASSES EN SASU
 * ---------------------------------------------------------------------------
 * Ce fichier est fait pour etre remplace d'un bloc, sans toucher au reste du
 * site. Il n'y aura que ce bloc IDENTITE_LEGALE a reecrire :
 *
 *   denomination           -> le nom de la societe (ex : "MAXI TROUVAILLE")
 *   entrepreneurIndividuel -> passer a false (la mention « EI » disparait)
 *   formeJuridique         -> "Societe par actions simplifiee unipersonnelle (SASU)"
 *   capitalSocial          -> le capital, qui devient obligatoire a afficher
 *   siren / siret          -> les nouveaux numeros de la societe
 *   immatriculation        -> le nouveau RCS
 *   dirigeant              -> "President : CHAHI Mustapha"
 *
 * Le nom commercial, l'adresse, l'email et le mediateur ne bougeront pas.
 * Aucun autre fichier du site n'est a modifier ce jour-la.
 *
 * Source des donnees ci-dessous : extrait Kbis a jour au 18 fevrier 2026,
 * transmis par l'exploitant. Rien n'a ete complete de tete.
 */

export const IDENTITE_LEGALE = {
  /**
   * Nom sous lequel l'activite est immatriculee.
   * Pour une entreprise individuelle, c'est le nom de la personne physique.
   */
  denomination: "CHAHI Mustapha",

  /**
   * Nom commercial affiche aux clients de CETTE boutique. Voir la regle
   * absolue en haut de fichier : aucune autre enseigne ne doit apparaitre.
   */
  nomCommercial: "Maxi Trouvaille",

  /**
   * Entreprise individuelle : la loi du 14 fevrier 2022 impose d'ajouter la
   * mention « EI » ou « Entrepreneur individuel » a cote du nom sur tous les
   * documents professionnels (article R526-27 du code de commerce).
   * Passer a false le jour du passage en societe.
   */
  entrepreneurIndividuel: true,

  /** Forme juridique telle qu'elle figure sur le Kbis. */
  formeJuridique: "Entreprise individuelle (personne physique)",

  /**
   * SIREN — les 9 chiffres. C'est LUI que les mentions legales doivent
   * afficher (article R123-237 du code de commerce), avec le RCS et la ville
   * du greffe. Present : la boutique est en regle sur ce point.
   */
  siren: "793 292 285",

  /**
   * SIRET — les 14 chiffres (SIREN + 5 chiffres d'etablissement).
   * MANQUANT : le Kbis ne le donne pas, il figure sur l'avis de situation
   * INSEE. Necessaire pour les factures, pas pour les mentions legales.
   * NE PAS DEVINER les 5 derniers chiffres.
   */
  siret: "",

  /** Immatriculation au registre du commerce et des societes. */
  immatriculation: "793 292 285 R.C.S. Colmar",

  /** Numero de gestion attribue par le greffe. */
  numeroGestion: "2020A00607",

  /** Greffe competent. */
  greffe: "Tribunal Judiciaire de Colmar",

  /** Date d'immatriculation, telle qu'elle figure sur le Kbis. */
  dateImmatriculation: "28/10/2020",

  /**
   * Statut TVA. Trois valeurs possibles, et TROIS SEULEMENT :
   *   "franchise"  -> franchise en base, article 293 B du CGI (pas de TVA)
   *   "assujetti"  -> TVA facturee, remplir aussi tvaIntracommunautaire
   *   ""           -> inconnu : le site affiche un trou visible
   *
   * MANQUANT. Tant que c'est vide, le site n'affirme RIEN sur la TVA — ecrire
   * « TVA non applicable » sans le savoir serait une mention fausse, et sur un
   * prix affiche c'est une pratique commerciale trompeuse.
   */
  statutTva: "" as "" | "franchise" | "assujetti",

  /** Numero de TVA intracommunautaire. A remplir UNIQUEMENT si assujetti. */
  tvaIntracommunautaire: "",

  /** Capital social. Vide pour une entreprise individuelle : elle n'en a pas. */
  capitalSocial: "",

  /** Adresse de l'etablissement : numero et rue. */
  adresseRue: "127 la Chapelle",

  /** Code postal. */
  adresseCodePostal: "68650",

  /** Ville. */
  adresseVille: "Le Bonhomme",

  /** Pays. */
  adressePays: "France",

  /** Email de contact affiche publiquement. */
  email: "contact@maxitrouvaille.fr",

  /**
   * Telephone du service client.
   * MANQUANT et OBLIGATOIRE : depuis la reforme de 2022, l'article L221-5 du
   * code de la consommation impose au vendeur a distance d'afficher un numero
   * de telephone, et pas seulement un email. Un numero de portable convient.
   */
  telephone: "",

  /** Personne responsable du contenu du site. */
  directeurPublication: "CHAHI Mustapha",

  /**
   * Mediateur de la consommation. OBLIGATOIRE (article L616-1 du code de la
   * consommation) : tout vendeur en ligne doit adherer a un mediateur agree et
   * afficher ses coordonnees.
   *
   * MANQUANT : l'adhesion est PAYANTE et n'a pas encore ete souscrite.
   * Le jour ou elle le sera, il n'y a que ces trois lignes a remplir — les
   * pages Mentions legales et CGV se mettront a jour toutes seules.
   */
  mediateurNom: "",
  mediateurAdresse: "",
  mediateurSite: "",
};

/**
 * Hebergeur du site. A verifier si Vercel change d'adresse un jour.
 */
export const HEBERGEUR = {
  nom: "Vercel Inc.",
  adresse: "340 S Lemon Ave #4133, Walnut, CA 91789, Etats-Unis",
  site: "https://vercel.com",
};

/** Delai legal de retractation en France, en jours. */
export const DELAI_RETRACTATION_JOURS = 14;

type ChampIdentite = keyof typeof IDENTITE_LEGALE;

const ETIQUETTES: Record<ChampIdentite, string> = {
  denomination: "nom de l'exploitant",
  nomCommercial: "nom commercial",
  entrepreneurIndividuel: "mention entrepreneur individuel",
  formeJuridique: "forme juridique",
  siren: "SIREN",
  siret: "SIRET (14 chiffres, avis de situation INSEE)",
  immatriculation: "immatriculation RCS",
  numeroGestion: "numero de gestion",
  greffe: "greffe",
  dateImmatriculation: "date d'immatriculation",
  statutTva: "statut TVA (franchise en base ou assujetti)",
  tvaIntracommunautaire: "numero de TVA intracommunautaire",
  capitalSocial: "capital social",
  adresseRue: "adresse (rue)",
  adresseCodePostal: "code postal",
  adresseVille: "ville",
  adressePays: "pays",
  email: "email de contact",
  telephone: "telephone du service client",
  directeurPublication: "directeur de la publication",
  mediateurNom: "mediateur de la consommation",
  mediateurAdresse: "adresse du mediateur",
  mediateurSite: "site du mediateur",
};

/**
 * Champs sans lesquels la boutique n'est pas conforme.
 * Le SIRET n'y figure pas : les mentions legales exigent le SIREN, le RCS et
 * la ville du greffe (article R123-237), tous les trois presents.
 */
export const CHAMPS_OBLIGATOIRES: ChampIdentite[] = [
  "denomination",
  "formeJuridique",
  "siren",
  "adresseRue",
  "adresseCodePostal",
  "adresseVille",
  "email",
  "telephone",
  "directeurPublication",
  "statutTva",
  "mediateurNom",
];

/** Utiles mais non bloquants pour la publication. */
export const CHAMPS_RECOMMANDES: ChampIdentite[] = ["siret"];

/** Renvoie la valeur, ou un trou visible si elle n'est pas renseignee. */
export function champ(nom: ChampIdentite) {
  const valeur = String(IDENTITE_LEGALE[nom] ?? "").trim();
  return valeur || `[A COMPLETER : ${ETIQUETTES[nom]}]`;
}

/** Renvoie la valeur, ou une chaine vide (pour les champs facultatifs). */
export function champFacultatif(nom: ChampIdentite) {
  return String(IDENTITE_LEGALE[nom] ?? "").trim();
}

/**
 * Nom legal du vendeur, avec la mention « EI » imposee aux entrepreneurs
 * individuels. Ex : « CHAHI Mustapha (EI) ».
 */
export function vendeurLegal() {
  const nom = champ("denomination");
  return IDENTITE_LEGALE.entrepreneurIndividuel ? `${nom} (EI)` : nom;
}

/**
 * Identification complete du vendeur, nom commercial compris.
 * C'est cette forme qui doit apparaitre dans les mentions legales et en tete
 * des CGV : le client doit pouvoir relier « Maxi Trouvaille » a une personne
 * juridique reelle.
 */
export function vendeurComplet() {
  const commercial = champFacultatif("nomCommercial");
  return commercial
    ? `${vendeurLegal()}, exerçant sous le nom commercial « ${commercial} »`
    : vendeurLegal();
}

/** Adresse postale complete, sur une seule ligne. */
export function adressePostale() {
  return [
    champ("adresseRue"),
    `${champ("adresseCodePostal")} ${champ("adresseVille")}`,
    champFacultatif("adressePays") || "France",
  ].join(", ");
}

/**
 * Phrase sur la TVA. Ne dit RIEN tant que le statut n'est pas connu : une
 * mention fiscale inventee est plus grave qu'une mention absente.
 */
export function mentionTva() {
  const statut = champFacultatif("statutTva");

  if (statut === "franchise") {
    return "TVA non applicable, article 293 B du code général des impôts (franchise en base de TVA). Les prix affichés sont nets de taxe.";
  }

  if (statut === "assujetti") {
    const numero = champFacultatif("tvaIntracommunautaire");
    const suffixe = numero
      ? ` Numéro de TVA intracommunautaire : ${numero}.`
      : ` ${champ("tvaIntracommunautaire")}.`;
    return `Les prix affichés s'entendent toutes taxes comprises.${suffixe}`;
  }

  return `Régime de TVA : ${champ("statutTva")}.`;
}

/** Liste des champs obligatoires encore vides. Vide = pret a publier. */
export function champsManquants() {
  return CHAMPS_OBLIGATOIRES.filter(
    (nom) => !String(IDENTITE_LEGALE[nom] ?? "").trim(),
  ).map((nom) => ETIQUETTES[nom]);
}

/** Liste des champs recommandes encore vides. */
export function champsRecommandesManquants() {
  return CHAMPS_RECOMMANDES.filter(
    (nom) => !String(IDENTITE_LEGALE[nom] ?? "").trim(),
  ).map((nom) => ETIQUETTES[nom]);
}

export function identiteLegaleComplete() {
  return champsManquants().length === 0;
}
