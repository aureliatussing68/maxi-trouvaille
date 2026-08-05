/**
 * ============================================================================
 *  LES CHAMPS A REMPLIR — c'est le SEUL fichier a modifier pour le juridique.
 * ============================================================================
 *
 * Remplis les lignes ci-dessous entre les guillemets. Tout le reste du site
 * (mentions legales, CGV, retractation, confidentialite) se met a jour tout
 * seul a partir d'ici : il n'y a pas d'autre endroit ou recopier ces infos.
 *
 * Une ligne laissee vide s'affiche sur le site en clair comme
 * « [A COMPLETER : ...] ». C'est volontaire : mieux vaut un trou visible
 * qu'une mention legale fausse. Mais NE PUBLIE PAS le site avec des trous —
 * une mention legale incomplete est une infraction, pas un detail.
 *
 * Regle : aucune information inventee ici. Si tu ne connais pas une valeur,
 * laisse vide et demande — je ne la devinerai pas a ta place.
 */

export const IDENTITE_LEGALE = {
  /** Nom sous lequel tu es immatricule. Ex : "Mustapha Dupont" ou "Maxi Trouvaille SAS". */
  denomination: "",

  /** Ex : "Entrepreneur individuel (micro-entreprise)", "SASU", "SARL". */
  formeJuridique: "",

  /** Les 14 chiffres du SIRET. Obligatoire pour vendre. */
  siret: "",

  /** Ex : "RCS Paris 123 456 789". Laisse vide si tu n'es pas inscrit au RCS. */
  immatriculation: "",

  /** Numero de TVA intracommunautaire. Laisse VIDE si franchise en base de TVA. */
  tvaIntracommunautaire: "",

  /** Montant du capital. Laisse VIDE pour une entreprise individuelle. */
  capitalSocial: "",

  /** Adresse de l'entreprise : numero et rue. */
  adresseRue: "",

  /** Code postal. */
  adresseCodePostal: "",

  /** Ville. */
  adresseVille: "",

  /** Pays. */
  adressePays: "France",

  /** Email de contact affiche publiquement. */
  email: "contact@maxitrouvaille.fr",

  /**
   * Telephone du service client. OBLIGATOIRE pour une boutique en ligne
   * (article L221-5 du code de la consommation : le consommateur doit pouvoir
   * te joindre autrement que par email).
   */
  telephone: "",

  /** Nom de la personne responsable du contenu du site. En general : toi. */
  directeurPublication: "",

  /**
   * Mediateur de la consommation. OBLIGATOIRE (article L616-1 du code de la
   * consommation) : tout vendeur en ligne doit adherer a un mediateur et
   * afficher ses coordonnees.
   *
   * ATTENTION : l'adhesion est PAYANTE (compter quelques dizaines d'euros par
   * an). Je ne souscris a rien en ton nom — c'est ta decision et ta carte.
   * Tant que ce champ est vide, le site n'est pas conforme.
   */
  mediateurNom: "",
  mediateurAdresse: "",
  mediateurSite: "",
};

/**
 * Hebergeur du site. Rempli d'avance : c'est Vercel qui heberge
 * maxitrouvaille.fr. A verifier sur vercel.com si l'adresse change un jour.
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
  denomination: "nom de l'entreprise",
  formeJuridique: "forme juridique",
  siret: "SIRET",
  immatriculation: "immatriculation RCS ou RM",
  tvaIntracommunautaire: "numero de TVA",
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
 * Champs sans lesquels le site ne peut pas etre publie legalement.
 * Les autres (TVA, capital, RCS) dependent du statut et peuvent rester vides.
 */
export const CHAMPS_OBLIGATOIRES: ChampIdentite[] = [
  "denomination",
  "formeJuridique",
  "siret",
  "adresseRue",
  "adresseCodePostal",
  "adresseVille",
  "email",
  "telephone",
  "directeurPublication",
  "mediateurNom",
];

/** Renvoie la valeur, ou un trou visible si elle n'est pas renseignee. */
export function champ(nom: ChampIdentite) {
  const valeur = String(IDENTITE_LEGALE[nom] ?? "").trim();
  return valeur || `[A COMPLETER : ${ETIQUETTES[nom]}]`;
}

/** Renvoie la valeur, ou une chaine vide (pour les champs facultatifs). */
export function champFacultatif(nom: ChampIdentite) {
  return String(IDENTITE_LEGALE[nom] ?? "").trim();
}

/** Adresse postale complete, sur une seule ligne. */
export function adressePostale() {
  return [
    champ("adresseRue"),
    `${champ("adresseCodePostal")} ${champ("adresseVille")}`,
    champFacultatif("adressePays") || "France",
  ].join(", ");
}

/** Liste des champs obligatoires encore vides. Vide = pret a publier. */
export function champsManquants() {
  return CHAMPS_OBLIGATOIRES.filter(
    (nom) => !String(IDENTITE_LEGALE[nom] ?? "").trim(),
  ).map((nom) => ETIQUETTES[nom]);
}

export function identiteLegaleComplete() {
  return champsManquants().length === 0;
}
