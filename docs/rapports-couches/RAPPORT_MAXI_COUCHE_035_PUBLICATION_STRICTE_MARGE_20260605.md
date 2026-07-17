# Maxi Trouvailles - Couche 035 - Publication stricte et marge 40%

Date: 2026-06-05

## Objectif

Reprendre le chantier Maxi Trouvailles depuis l'existant, sans repartir de zero, puis appliquer la nouvelle strategie:

- controle obligatoire avant publication;
- publication automatique seulement si tous les criteres sont prouves;
- brouillon conserve si un seul controle echoue;
- marge cible 40% sur les produits partenaires;
- rapport clair des blocages.

## Audit de reprise

- Dossier applicatif retrouve: `C:\Users\sinek\Desktop\MAXI_TROUVAILLE\site\maxi-trouvaille`.
- Le dossier est une jonction vers: `C:\Users\sinek\Desktop\maxi-trouvaille`.
- Branche Git: `main`.
- Derniers commits reperes:
  - `4b9e7fb simplify homepage hero`
  - `42d9f1a refresh destockage storefront`
  - `e397d28 add moderated product reviews`
  - `1ceee25 add real product views and favorites`
  - `031229b configure stripe checkout card payments`
  - `eb9b564 site ready`
- Beaucoup de changements non commites etaient deja presents avant cette couche.
- Automation existante: `maxi-trouvailles-couche-par-couche`, active toutes les 2 minutes.
- Automation TikTok: presente mais PAUSED.
- Automation Maxi mise a jour: publication catalogue autorisee uniquement apres controle strict complet; commandes, paiements, comptes, reseaux sociaux, suppressions et deploiement production restent a validation manuelle.

## Etat catalogue avant actions

- Produits total catalogue rapide: 57.
- Produits partenaires: 33.
- Produits partenaires publies: 0.
- Produits partenaires brouillon: 33.
- Images partenaires: 33/33 avec `verified_source_images`.
- Audit images partenaires: OK.
- Audit gates publication: OK.
- Aucun doublon slug/id detecte dans `data/quick-products.json`.
- Images locales referencees: OK, aucune image manquante detectee.

## Nouvelle automatisation ajoutee

### Publication stricte

Fichier ajoute:

- `scripts/automation/score_partner_drafts.mjs`

Commandes ajoutees:

- `npm run catalog:score-partner-drafts`
- `npm run catalog:publish-ready-partners`

Regle appliquee par le script:

- publier uniquement si image, titre, description, vendeur, stock, delai 3-7 jours, marge >= 30%, categorie et fiche technique sont valides;
- garder en brouillon si un seul controle echoue;
- generer une proposition SEO/ALT pour les produits prets;
- ne jamais commander, payer, se connecter a un compte ou publier hors catalogue local.

Resultat execution:

- Produits prets a publier: 0.
- Produits bloques: 33.
- Raisons restantes:
  - `delai_non_prouve`: 33.
  - `vendeur_non_valide`: 27.
  - `validation_fournisseur_hold`: 6.

Aucune publication n'a donc ete effectuee.

### Marge cible 40%

Fichier ajoute:

- `scripts/automation/apply_partner_margin_target.mjs`

Commande ajoutee:

- `npm run catalog:apply-target-margin`

Resultat execution:

- 33 produits partenaires brouillons recalcules vers une marge cible >= 40%.
- Tous restent en brouillon.
- Aucun paiement, commande, compte, publication externe ou deploiement.

## Sauvegardes

- `backups/couche-035-score-partner-drafts-20260605_2042/package.json.bak`
- `backups/quick-products-before-margin-target-2026-06-05T18-43-58-437Z/quick-products.json.bak`

## Tests executes

- `npm run catalog:audit-partners`: OK.
- `npm run catalog:publish-ready-partners`: OK, 0 publication, blocages expliques.
- `npm run typecheck`: OK.
- `npm run lint`: OK.
- `npm run business:status`: OK.
- Automation `maxi-trouvailles-couche-par-couche` mise a jour: OK.

## Feuille de route priorisee

1. Verifier les fournisseurs et delais 3-7 jours des 33 brouillons partenaires avec donnees fiables.
2. Publier automatiquement uniquement les fiches qui passent le controle strict.
3. Ajouter un audit SEO structure pour detecter les fiches sans `seo`, `imageAlt`, FAQ ou mots-cles.
4. Enrichir les produits non publies avec SEO/ALT brouillon sans les rendre visibles.
5. Corriger ou remplacer les produits avec delai 7-15 jours ou fournisseur non prouve.
6. Importer progressivement de nouveaux produits AliExpress seulement si livraison 3-7 jours prouvee.
7. Verifier affichage local apres chaque publication: page produit, images, prix, categorie, SEO.
8. Lancer build ou verification navigateur seulement quand le poste est disponible.

## Statut

Couche 035 terminee.

La suite doit commencer par la verification fournisseur/delai des brouillons les mieux scores, puis relancer:

- `npm run catalog:publish-ready-partners`
- `npm run catalog:audit-partners`
- `npm run typecheck`
- `npm run lint`
