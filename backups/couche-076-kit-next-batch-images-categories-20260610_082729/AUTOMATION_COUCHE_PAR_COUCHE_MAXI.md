# Automation couche par couche - Maxi Trouvailles

Objectif: rendre Maxi Trouvailles exploitable, propre et rentable sur une periode d'environ un mois, sans casser l'existant et sans action sensible automatique.

Automation activee uniquement quand Mouss dit GO.

Cadence prevue: toutes les 10 minutes, en petites couches testables.

## Regles absolues

- Ne jamais commander chez un fournisseur automatiquement.
- Ne jamais payer, debiter, connecter un compte, publier en production ou deployer sans validation explicite.
- Ne jamais supprimer definitivement sans sauvegarde et validation.
- Ne jamais afficher AliExpress au client.
- Ne jamais copier de secret/API/token dans un rapport.
- Garder en `draft` ou `HOLD` toute fiche dont le fournisseur, le prix, le stock, le delai, la variante ou l'image exacte ne sont pas prouves.
- Les colis surprises, palettes, mystery box et colis perdus restent non vendables avec badge `A venir`.

## Priorite du mois

1. Stabiliser le site et les pages utiles: accueil, boutique, categories, fiches produit, panier, paiement, FAQ, livraison, suivi colis, contact.
2. Remplir progressivement les categories avec des produits phares a potentiel.
3. Corriger les images produit pour qu'elles correspondent exactement a l'article vendu.
4. Garder un pipeline dropshipping semi-automatique: validation humaine avant fournisseur, paiement, publication ou commande.
5. Ameliorer SEO, confiance, mobile, performance et admin.
6. Preparer les automations futures: prix, stock, suivi colis, alertes fournisseur.

## Volume catalogue

Objectif indicatif: 20 a 30 annonces propres par jour quand les preuves suivent.

La qualite passe avant le volume. Une fiche incomplete vaut mieux en brouillon qu'une mauvaise fiche publiee.

Les gros lots produits doivent passer par:

```powershell
npm run catalog:prepare-draft-backlog
npm run catalog:import-evidence-drafts
npm run catalog:partner-action-board
npm run catalog:partner-validation-packets
npm run catalog:apply-validation-packets
npm run catalog:all-partner-validation-queue
npm run catalog:all-partner-validation-packets
npm run catalog:audit-all-partner-validation-evidence
npm run catalog:partner-evidence-workplan
npm run catalog:fast-evidence-forms
npm run catalog:audit-fast-evidence-forms
npm run catalog:fast-go-shortlist
npm run catalog:sprint-image-proof-board
npm run catalog:sprint-image-local-plan
npm run catalog:audit-sprint-image-gates
npm run catalog:sprint-image-replacement-manifest
npm run catalog:audit-sprint-image-replacement-decisions
npm run catalog:sprint-image-action-board
npm run catalog:sprint-image-field-checklist
npm run catalog:audit-sprint-image-local-files
npm run catalog:audit-sprint-image-human-review
npm run catalog:photo-sprint-du-jour
npm run catalog:photo-drop-kit
npm run catalog:business-next-actions
npm run catalog:audit-surprise-hold
npm run catalog:audit-checkout-eligibility
npm run catalog:test-checkout-guards
npm run catalog:audit-all-partner-gates
npm run catalog:audit-category-images
npm run catalog:category-image-uniqueness-sprint
npm run catalog:category-image-drop-kit
npm run catalog:category-image-promotion-plan
npm run catalog:category-image-roadmap
```

La premiere commande prepare une file de brouillons directs, detecte les doublons probables et bloque l'ecriture dans `data/quick-products.json` tant que les preuves exactes ne sont pas remplies.

La deuxieme commande controle le template de preuves en dry-run. Elle n'ecrit rien par defaut. Le mode `--apply` est autorise uniquement quand toutes les preuves sont remplies; il cree alors une sauvegarde automatique et ajoute les produits en `draft`/HOLD, jamais en publication.

La troisieme commande produit le tableau d'action des brouillons partenaires deja integres: file prioritaire, bloquants, preuves manquantes, prochaine action par produit.

La quatrieme commande genere des packs de validation fournisseur pour les produits prioritaires du tableau d'action. Chaque pack liste les URLs, images, prix, blocages et champs de preuve a remplir avant de lever un HOLD.

La cinquieme commande controle les packs remplis en dry-run. Elle n'ecrit rien par defaut. Le mode `--apply` est autorise uniquement si toutes les preuves sont remplies; il cree une sauvegarde et met a jour les fiches existantes en `draft`/HOLD, jamais en publication.

La commande `catalog:all-partner-validation-queue` produit une file de validation toutes sources, incluant les produits partenaires statiques dans `src/lib/catalog.ts` et les brouillons de `data/quick-products.json`.

La commande `catalog:all-partner-validation-packets` transforme le top de cette file globale en packs de validation fournisseur detailles, avec un formulaire de preuves par produit. Elle n'ecrit pas dans le catalogue.

La commande `catalog:audit-all-partner-validation-evidence` controle les preuves remplies dans ces packs globaux et produit un statut `HOLD_MISSING_EVIDENCE`, `ready_review_hold` ou `business_action_ready_hold`. Elle reste en lecture seule et ne publie jamais.

La commande `catalog:partner-evidence-workplan` transforme cet audit en plan de travail priorise: decisions statiques, validations rapides et recontroles complets, avec guides courts par produit. Elle reste en lecture seule.

La commande `catalog:fast-evidence-forms` genere des formulaires courts pour les validations rapides du workplan, pre-remplis avec les donnees deja connues mais sans inventer les preuves manquantes.

La commande `catalog:audit-fast-evidence-forms` controle les formulaires rapides remplis en dry-run strict. Elle refuse les preuves incompletes et garde publication, paiement et commande fournisseur bloques.

La commande `catalog:fast-go-shortlist` classe les formulaires rapides par potentiel, marge, stock, risque et effort de preuve. Elle sort les 3 meilleurs candidats a traiter en sprint de preuves, sans modifier le catalogue.

La commande `catalog:sprint-image-proof-board` controle les images des produits en sprint: exactitude visuelle, URLs fournisseur/CDN, besoin de rapatriement local et droits images. Elle reste en lecture seule.

La commande `catalog:sprint-image-local-plan` prepare les chemins locaux WebP, l'ordre galerie, les alt SEO et le manifeste de migration image pour les produits en sprint. Elle ne telecharge rien et ne modifie pas le catalogue.

La commande `catalog:audit-sprint-image-gates` bloque la revue humaine si les produits en sprint pointent encore vers un domaine image fournisseur ou si les WebP locaux cibles sont absents. Elle reste en lecture seule.

La commande `catalog:sprint-image-replacement-manifest` prepare les decisions autorisees pour remplacer les images fournisseur: photo propre, permission fournisseur, image licencee exacte, remplacement produit ou maintien HOLD. Elle interdit les images generees pour la galerie produit exacte.

La commande `catalog:audit-sprint-image-replacement-decisions` controle le manifeste rempli et refuse les modes invalides, les images generees en galerie produit et tout passage en revue sans fichier local, droits images, variante exacte et validation Mouss.

La commande `catalog:sprint-image-action-board` transforme les blocages images du sprint en priorites business courtes: photo propre, demande de droits, remplacement produit ou maintien HOLD.

La commande `catalog:sprint-image-field-checklist` genere une checklist terrain a imprimer/remplir pour photographier ou verifier les produits du sprint sans jamais debloquer une image approximative.

La commande `catalog:audit-sprint-image-local-files` verifie que les WebP locaux cibles existent, restent dans `public/uploads/partner-products`, ont une signature WebP valide et gardent les fiches en HOLD tant que les fichiers manquent.

La commande `catalog:audit-sprint-image-human-review` combine les audits fichiers locaux et decisions images. Elle ouvre uniquement une revue humaine HOLD si les WebP sont valides, les droits/variantes sont prouves et Mouss a valide; elle ne publie jamais.

La commande `catalog:photo-sprint-du-jour` extrait les produits `PHOTO_OR_RIGHTS_FIRST` du sprint et liste les WebP prioritaires a produire, tout en excluant les produits HOLD/remplacement. Elle reste en lecture seule.

La commande `catalog:photo-drop-kit` prepare les dossiers de depot et les README pour les WebP exacts du sprint photo du jour. Elle ne copie rien dans `public/uploads`, ne genere aucune image et garde les fiches en HOLD.

La commande `catalog:business-next-actions` rassemble les decisions statiques, formulaires rapides, recontroles complets, bloquants et commandes a relancer dans une vue business unique "quoi faire maintenant".

La commande `catalog:audit-surprise-hold` verifie que colis surprises, palettes, box mystere et colis perdus restent non vendables avec le statut a venir.

La commande `catalog:audit-checkout-eligibility` verifie que le panier, la page paiement et l'API Stripe bloquent les brouillons, produits test, categories cachees, produits a venir, ruptures et doublons avant toute session Stripe.

La commande `catalog:test-checkout-guards` verifie des cas concrets en lecture seule: panier vide, doublon, produit test force, produit a venir force, brouillon partenaire force, quantite superieure au stock, source non interne, livraison et absence de fuite fournisseur.

La commande `catalog:audit-all-partner-gates` controle tous les produits partenaires, y compris ceux declares directement dans `src/lib/catalog.ts`, pour eviter qu'une fiche dropshipping statique soit publiee sans fournisseur exact, SKU, images validees et gate de validation.

La commande `catalog:audit-category-images` controle les images de toutes les categories: presence WebP locale, signature, dimensions, poids, images partagees et brief de production. Elle ne genere aucune image et ne modifie pas le catalogue.

La commande `catalog:category-image-uniqueness-sprint` transforme l'audit categories en sprint de production: elle priorise les visuels partages a differencier en premier et propose des nouveaux noms WebP, sans remplacer les images publiques.

La commande `catalog:category-image-drop-kit` prepare les dossiers de depot et les README pour les WebP categories prioritaires. Elle controle les signatures WebP deposees mais ne copie rien dans `public/uploads/category-images`.

La commande `catalog:category-image-promotion-plan` relit le depot images categories, controle les WebP presents et prepare un plan futur de copie publique/revue humaine. Elle ne copie rien, ne modifie pas le catalogue et garde tout en HOLD tant que Mouss n'a pas valide.

La commande `catalog:category-image-roadmap` produit une roadmap globale de toutes les categories: images OK, visuels partages a differencier, categories cachees/a venir et briefs de production. Elle reste en lecture seule et ne copie aucune image publique.

## Checklist produit

Chaque produit doit avoir:

- categorie correcte;
- titre clair;
- description utile et vendeur;
- caracteristiques principales;
- prix fournisseur;
- prix de vente;
- marge estimee;
- lien fournisseur reel;
- SKU ou identifiant fournisseur si disponible;
- stock fournisseur;
- delai livraison estime;
- photo principale exacte;
- images secondaires exactes ou volontairement absentes;
- statut `draft` si une preuve manque;
- note de validation indiquant ce qui reste a verifier.

## Photos produit

Une image est acceptable seulement si:

- elle represente exactement le produit vendu;
- elle correspond a la bonne variante;
- elle ne montre pas un lot si la fiche vend une piece seule;
- elle ne montre pas une marque/logo interdit ou trompeur;
- elle n'est pas pixelisee;
- elle peut etre utilisee proprement dans la fiche.

Si l'image est generique ou douteuse:

- ne pas publier;
- marquer la fiche en HOLD;
- ajouter l'action requise dans la checklist fournisseur.

## Travail par couche

A chaque reveil:

1. Lire ce fichier, le dernier rapport et `RAPATRIEMENT_JARVIS_LATEST.md`.
2. Verifier l'etat git sans revenir en arriere.
3. Choisir une seule couche utile et limitee.
4. Faire une sauvegarde ou utiliser une sauvegarde existante avant modification importante.
5. Integrer localement ce qui est sur.
6. Lancer les tests pertinents.
7. Corriger les erreurs raisonnables detectees.
8. Ecrire un rapport court.

## Tests selon couche

Catalogue:

```powershell
npm run catalog:prepare-draft-backlog
npm run catalog:import-evidence-drafts
npm run catalog:partner-action-board
npm run catalog:partner-validation-packets
npm run catalog:apply-validation-packets
npm run catalog:all-partner-validation-queue
npm run catalog:all-partner-validation-packets
npm run catalog:audit-all-partner-validation-evidence
npm run catalog:partner-evidence-workplan
npm run catalog:fast-evidence-forms
npm run catalog:audit-fast-evidence-forms
npm run catalog:fast-go-shortlist
npm run catalog:sprint-image-proof-board
npm run catalog:sprint-image-local-plan
npm run catalog:audit-sprint-image-gates
npm run catalog:sprint-image-replacement-manifest
npm run catalog:audit-sprint-image-replacement-decisions
npm run catalog:sprint-image-action-board
npm run catalog:sprint-image-field-checklist
npm run catalog:audit-sprint-image-local-files
npm run catalog:audit-sprint-image-human-review
npm run catalog:photo-sprint-du-jour
npm run catalog:photo-drop-kit
npm run catalog:business-next-actions
npm run catalog:audit-surprise-hold
npm run catalog:audit-checkout-eligibility
npm run catalog:test-checkout-guards
npm run catalog:audit-all-partner-gates
npm run catalog:audit-partners
npm run catalog:partner-summary
npm run catalog:audit-images
npm run catalog:audit-category-images
npm run catalog:category-image-uniqueness-sprint
npm run catalog:category-image-drop-kit
npm run catalog:category-image-promotion-plan
npm run catalog:category-image-roadmap
npm run catalog:audit-partner-gates
```

Code:

```powershell
npm run typecheck
npm run lint
```

Apres gros paquet UI/catalogue:

```powershell
npm run build
```

## Rapport attendu

Chaque couche doit produire un rapport court avec:

- numero/date de couche;
- objectif;
- fichiers touches;
- produits ajoutes ou corriges;
- preuves fournisseur ou preuves manquantes;
- statut des fiches: `draft`, `HOLD`, `ready_review`, `published` seulement si deja valide;
- tests executes;
- erreurs corrigees;
- prochain pas.

Nom conseille:

`business-maxi-trouvailles/rapports-couches/RAPPORT_MAXI_COUCHE_YYYYMMDD_HHMM.md`

## Premier travail au GO

Reprendre par:

- selection produits: `business-maxi-trouvailles/produits-a-valider/selection_couche_006_20260527.md`;
- workflow images: `business-maxi-trouvailles/docs/WORKFLOW_AUDIT_IMAGES_PARTENAIRES_20260605.md`;
- paquet rapatrie: `business-maxi-trouvailles/RAPATRIEMENT_JARVIS_LATEST.md`.

Premier objectif recommande: choisir 5 produits phares maximum, verifier fournisseur/images, puis importer ou corriger uniquement en brouillon propre.
