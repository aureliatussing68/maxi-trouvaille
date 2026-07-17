# Automation couche par couche - Maxi Trouvailles

Objectif: rendre Maxi Trouvailles exploitable, propre et rentable sur une periode d'environ un mois, sans casser l'existant et sans action sensible automatique.

Automation activee uniquement quand Mouss dit GO.

Cadence prevue: toutes les 5 minutes, en couches testables.

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

## Branches de chantier 5 minutes

L'automatisation principale tourne toutes les 5 minutes et alterne entre trois branches de travail. Une seule heartbeat peut etre attachee a ce fil, donc ces branches sont pilotees dans le meme chef de chantier pour eviter les conflits de fichiers.

1. Branche Images exactes
   - Priorite: retirer du public toute fiche dont l'image n'est pas prouvee exacte.
   - Livrables: audits images client, HOLD automatique local, checklists photo, admin de revue.
   - Commandes cles: `npm run catalog:hold-public-unverified-images`, `npm run catalog:audit-images`, `npm run catalog:audit-sprint-image-gates`.

2. Branche Catalogue rentable
   - Priorite: remplir les categories avec des produits a potentiel en brouillon/HOLD tant que les preuves fournisseur manquent.
   - Livrables: files produits, marges, preuves rapides, lots de validation.
   - Commandes cles: `npm run catalog:prepare-draft-backlog`, `npm run catalog:fast-proof-now-export`, `npm run catalog:audit-fast-proof-now-export`, `npm run catalog:single-product-cockpit`, `npm run catalog:product-cockpits-batch`, `npm run catalog:product-field-kit`.

3. Branche Confiance, mobile, checkout
   - Priorite: garder un site clair, rapide et rassurant, sans paiement possible sur fiche douteuse.
   - Livrables: tests checkout, pages confiance, SEO, verifications mobile/PC.
   - Commandes cles: `npm run catalog:audit-public-dropshipping-surface`, `npm run catalog:audit-checkout-eligibility`, `npm run catalog:dropshipping-focus-hold`, `npm run catalog:test-checkout-guards`, `npm run build`.

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
npm run catalog:fast-proof-now-export
npm run catalog:audit-fast-proof-now-export
npm run catalog:single-product-cockpit
npm run catalog:product-cockpits-batch
npm run catalog:product-field-kit
npm run catalog:audit-product-field-kit
npm run catalog:hold-public-unverified-images
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
npm run catalog:visual-production-board
npm run catalog:audit-visual-production-board
npm run catalog:visual-deposit-session
npm run catalog:business-next-actions
npm run catalog:audit-public-dropshipping-surface
npm run catalog:audit-seo-hold-visibility
npm run catalog:audit-admin-publication-gate
npm run catalog:audit-admin-publication-ui-guard
npm run catalog:audit-surprise-hold
npm run catalog:audit-checkout-eligibility
npm run catalog:dropshipping-focus-hold
npm run catalog:apply-dropshipping-focus-hold
npm run catalog:test-checkout-guards
npm run catalog:audit-all-partner-gates
npm run catalog:audit-category-images
npm run catalog:category-image-uniqueness-sprint
npm run catalog:category-image-drop-kit
npm run catalog:category-image-promotion-plan
npm run catalog:category-image-roadmap
npm run catalog:category-image-next-batch-kit
npm run catalog:category-image-intake-status
npm run catalog:daily-execution-board
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

La commande `catalog:fast-proof-now-export` extrait les preuves rapides a remplir tout de suite dans un format local JSON/Markdown/CSV, sans modifier le catalogue.

La commande `catalog:audit-fast-proof-now-export` relit cet export et controle les champs remplis avant revue humaine. Elle garde tout en HOLD si une preuve manque, si une valeur ressemble a un placeholder, si la validation Mouss manque ou si la decision finale n'est pas `READY_REVIEW`.

La commande `catalog:single-product-cockpit` prend le meilleur candidat du sprint preuve/image et genere un cockpit de validation produit: recap business, champs de preuve a remplir, images WebP exactes attendues, bloquants et commandes a relancer. Elle reste en lecture seule, ne telecharge aucune image, ne modifie pas le catalogue et garde publication, paiement et commande fournisseur bloques.

La commande `catalog:product-cockpits-batch` genere les cockpits des meilleurs candidats du sprint en parallele local: un dossier par produit, un template de preuves par fiche et un recap batch. Elle reste en lecture seule, sans image publique, sans publication, sans paiement ni commande fournisseur.

La commande `catalog:product-field-kit` transforme les cockpits actifs en kit terrain: feuille Markdown, CSV preuves, CSV images et JSON global a remplir. Elle sert a remplir les preuves fournisseur et les depots WebP exacts sans toucher au catalogue.

La commande `catalog:audit-product-field-kit` controle le JSON global du kit terrain rempli, les preuves obligatoires, la decision `READY_REVIEW`, la validation Mouss et les fichiers WebP exacts deposes. Elle reste en lecture seule, garde publication/paiement/commande fournisseur bloques et produit un statut HOLD ou revue humaine HOLD.

La page admin `Preuves partenaires` permet de rechercher les fiches HOLD par nom, slug, categorie, statut ou zone de preuve (`Images / droits`, `Fournisseur / SKU`, `Prix / stock / marge`, `Livraison / suivi`, `Validation Mouss`), puis d'exporter le resultat filtre en CSV terrain sans modifier le catalogue. Les filtres rapides affichent aussi un compteur par zone en respectant la recherche et le statut actifs. Elle affiche maintenant un `Sprint zone active` qui transforme le filtre de preuve courant en 3 fiches prioritaires, avec action specialisee par zone, compteur de preuves zone, checklist session manuelle par fiche, export CSV dedie au sprint avec `action_zone`, `checklist_session`, colonnes de suivi `session_*` et `lien_sprint`, puis lien `Traiter cette preuve` conservant `status=hold`, `q` et `zone` jusqu'a l'ancre du top verification. Elle affiche aussi un `Lot terrain du jour` avec les 3 premieres fiches HOLD a verrouiller, chacune avec etat visuel priorise (`Image a prouver`, `Marge a verrouiller` ou `Delai a prouver`), prochaine action terrain, compteur `Preuves a remplir`, zones de preuves manquantes, signaux image/marge/livraison, checklist compacte, lien `Fiche terrain` filtre en `status=hold` et export CSV dedie au lot du jour. Ce CSV conserve `priorite_visuelle`, `etat_visuel`, `action_terrain`, `preuves_a_remplir` et `zones_preuves` pour traiter le lot dans le bon ordre hors interface. Le `Top produits a verifier maintenant` permet ensuite d'attaquer en premier les fiches avec signaux image, marge, livraison et potentiel categorie, avec un export CSV court dedie au top prioritaire, une mini fiche terrain par produit et un mode impression limite au top verification.

La page admin `Pilotage` affiche un recap `HOLD du jour`: nombre de fiches partenaires a prouver, top verification pret, CSV court pret, impression prete, progression zones preuves, zone prioritaire du jour, sprint preuves terrain et prochain produit a verifier. Elle affiche aussi un bloc `Depot photo exact` relie au dernier manifeste `MANIFEST_DEPOT_PHOTOS_SPRINT_*`: produits photo, WebP attendus, WebP valides, fichiers invalides/en trop, chemin du depot local, noms WebP attendus, liens `Photos produits`/`Checklist photo` et export `maxi-depot-photo-exact.csv` avec `fichier_attendu` et `chemin_depot`. Ce bloc lit aussi le dernier `ORDRE_TRAVAIL_PHOTOS_MANQUANTES_*`, affiche l'ordre court des photos exactes a produire, le statut `HOLD PHOTOS MANQUANTES`, le chemin local et l'export `maxi-ordre-travail-photos-manquantes.csv` pour bosser sans chercher dans les dossiers. Ce bloc affiche une `Alerte post-depot` stricte: `Depot incomplet` si des WebP exacts manquent, `Depot a corriger` si le depot contient des fichiers invalides/en trop, ou `Depot complet - revue humaine requise` seulement quand tous les WebP sont presents. Meme en depot complet, l'etat reste limite a une revue humaine: relancer `npm run catalog:audit-photo-checklist` puis `npm run catalog:audit-sprint-image-human-review` avant toute copie publique. La page affiche aussi un bloc `Production visuels exacts` relie au dernier `VISUELS_EXACTS_A_PRODUIRE_*`: total des visuels a produire, P0 photos produits, P1/P2 categories, statut HOLD, export `maxi-production-visuels-exacts.csv` et cartes de priorites. Elle affiche aussi un bloc `Depot images categories` relie au dernier `SUIVI_DEPOTS_IMAGES_CATEGORIES_*`: lots P1/P2, WebP attendus, WebP valides, WebP manquants, fichiers invalides, alerte `HOLD_IMAGES_CATEGORIES_MANQUANTES`, chemins de depot, cartes categories et export `maxi-suivi-depots-images-categories.csv`. Aucune copie publique dans `public/uploads/category-images` n'est faite depuis ces blocs: ils servent seulement a piloter le depot et la revue humaine. La progression zones preuves repartit les blocages terrain entre `Images`, `Fournisseur`, `Marge`, `Livraison` et `Validation`, avec compteur, part du volume et lien direct vers `Preuves partenaires` filtre en `status=hold&zone=...#top-verification`. La zone prioritaire est calculee depuis les blocages partenaires du tableau d'execution et ouvre `Preuves partenaires` avec `status=hold&zone=...#top-verification` pour attaquer directement `Images / droits`, `Fournisseur / SKU`, `Prix / stock / marge`, `Livraison / suivi` ou `Validation Mouss`. Le bloc `Sprint preuves terrain` remonte 3 fiches a traiter maintenant, leurs zones de checklist session et un lien `Ouvrir sprint` filtre par `status=hold`, `q`, `zone` et ancre top verification. Le bouton `Fiche terrain` ouvre la page preuves avec `status=hold`, un filtre `q` sur le produit cible et une ancre de carte top verification. Le bouton `Exporter recap CSV` telecharge un recap court `maxi-pilotage-hold-du-jour.csv` avec `type_ligne`, `priorite`, `libelle`, `valeur`, `details`, `statut` et `lien_admin`, couvrant resume, zones, sprint et prochain produit via liens admin internes uniquement. Elle reste une vue de pilotage, sans publication, paiement ni commande fournisseur.

La commande `catalog:hold-public-unverified-images` controle les produits visibles cote client et repere les fiches publiees avec image generee, placeholder, image Unsplash generique ou titre a verifier. La commande `catalog:apply-public-unverified-image-hold` repasse ces fiches en brouillon/HOLD local avec sauvegarde automatique, sans supprimer de produit.

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

La commande `catalog:photo-drop-kit` prepare les dossiers de depot, les README et un `ORDRE_TRAVAIL_PHOTOS_MANQUANTES_*` Markdown/CSV/JSON pour les WebP exacts du sprint photo du jour. Cet ordre de travail liste uniquement les photos absentes ou invalides, avec nom exact, role image, dossier depot et action terrain. Elle ne copie rien dans `public/uploads`, ne genere aucune image et garde les fiches en HOLD.

La commande `catalog:visual-production-board` consolide les photos produits exactes et les images categories dropshipping dans un ordre de travail unique `VISUELS_EXACTS_A_PRODUIRE_*` en JSON/Markdown/CSV. Elle priorise les photos produits en P0, les categories P1/P2 ensuite, et garde copie publique, catalogue, publication, paiement et commande fournisseur bloques.

La commande `catalog:audit-visual-production-board` controle que ce tableau unique reste aligne sur `ORDRE_TRAVAIL_PHOTOS_MANQUANTES_*` et `SUIVI_DEPOTS_IMAGES_CATEGORIES_*`: priorites continues, compteurs exacts, fichiers WebP attendus presents dans les sources, statut HOLD, garde-fous lecture seule et absence de libelles fournisseur interdits dans le board.

La commande `catalog:visual-deposit-session` transforme le tableau unique et son audit en session terrain JSON/Markdown/CSV: groupes par produit/categorie, ordre P0/P1/P2, chemins exacts, checklist par fichier et commandes apres depot. Elle garde le statut en HOLD si l'audit du board n'est pas OK et ne copie rien dans `public/uploads`.

La page admin `Pilotage` remonte aussi le dernier `AUDIT_VISUELS_EXACTS_A_PRODUIRE_*`: statut de coherence, nombre d'echecs, compteurs photos produits/categories, chemin du rapport et export `maxi-audit-visuels-exacts.csv`. Si l'audit manque ou detecte un echec, le bloc reste en HOLD et demande de relancer `catalog:audit-visual-production-board` avant de travailler les depots.

La commande `catalog:business-next-actions` rassemble les decisions statiques, formulaires rapides, recontroles complets, bloquants et commandes a relancer dans une vue business unique "quoi faire maintenant".

La commande `catalog:audit-public-dropshipping-surface` controle la surface client dropshipping: aucun AliExpress, aucun lien fournisseur, aucun prix fournisseur, aucune source fournisseur, aucune image non prouvee sur les produits visibles. Elle reste en lecture seule et bloque le pilotage si une fuite client apparait.

La commande `catalog:audit-seo-hold-visibility` controle que les produits brouillons/HOLD ne partent pas dans le SEO: sitemap base sur produits publics, route produit en lookup public, `adminPreview` en noindex et `generateStaticParams` limite aux produits publiables. Elle reste en lecture seule.

La commande `catalog:audit-admin-publication-gate` controle que la route admin refuse la publication d'un produit dropshipping si les preuves fournisseur, SKU, prix, delai, gate validation et images exactes ne sont pas completes. Elle reste en lecture seule et ne publie rien.

La commande `catalog:audit-admin-publication-ui-guard` controle que le formulaire admin rend cette garde visible: checklist preuves, bouton publication bloque si le statut `published` est choisi avec preuves manquantes, affichage des blocages serveur, raccourcis vers preuves/pilotage/photos et recherche dans l'atelier preuves partenaires. Elle reste en lecture seule.

La commande `catalog:audit-surprise-hold` verifie que colis surprises, palettes, box mystere et colis perdus restent non vendables avec le statut a venir.

La commande `catalog:audit-checkout-eligibility` verifie que le panier, la page paiement et l'API Stripe bloquent les brouillons, produits test, categories cachees, produits a venir, ruptures et doublons avant toute session Stripe.

La commande `catalog:dropshipping-focus-hold` liste les produits personnels, tests ou legacy encore publies qui doivent rester en suspens pendant le focus dropshipping. La commande `catalog:apply-dropshipping-focus-hold` passe uniquement les fiches rapides concernees en `draft` avec sauvegarde automatique, sans suppression, publication, paiement ni commande fournisseur.

La commande `catalog:test-checkout-guards` verifie des cas concrets en lecture seule: panier vide, doublon, produit test force, produit a venir force, brouillon partenaire force, quantite superieure au stock, source non interne, livraison et absence de fuite fournisseur.

La commande `catalog:audit-all-partner-gates` controle tous les produits partenaires, y compris ceux declares directement dans `src/lib/catalog.ts`, pour eviter qu'une fiche dropshipping statique soit publiee sans fournisseur exact, SKU, images validees et gate de validation.

La commande `catalog:audit-category-images` controle les images de toutes les categories: presence WebP locale, signature, dimensions, poids, images partagees et brief de production. Elle ne genere aucune image et ne modifie pas le catalogue.

La commande `catalog:category-image-uniqueness-sprint` transforme l'audit categories en sprint de production: elle priorise les visuels partages a differencier en premier et propose des nouveaux noms WebP, sans remplacer les images publiques.

La commande `catalog:category-image-drop-kit` prepare les dossiers de depot et les README pour les WebP categories prioritaires. Elle controle les signatures WebP deposees mais ne copie rien dans `public/uploads/category-images`.

La commande `catalog:category-image-promotion-plan` relit le depot images categories, controle les WebP presents et prepare un plan futur de copie publique/revue humaine. Elle ne copie rien, ne modifie pas le catalogue et garde tout en HOLD tant que Mouss n'a pas valide.

La commande `catalog:category-image-roadmap` produit une roadmap globale de toutes les categories: images OK, visuels partages a differencier, categories cachees/a venir et briefs de production. Elle reste en lecture seule et ne copie aucune image publique.

La commande `catalog:category-image-next-batch-kit` prepare les dossiers de depot pour les visuels categories `P2` de la roadmap, notamment les prochaines variantes dropshipping a differencier. Elle controle seulement les fichiers deposes et ne copie rien dans `public/uploads/category-images`.

La commande `catalog:category-image-intake-status` consolide les depots categories `P1` et `P2` dans un tableau unique: WebP attendus, presents, manquants, invalides et prets pour revue humaine. Elle reste en lecture seule et ne modifie ni catalogue ni fichiers publics.

La commande `catalog:daily-execution-board` rassemble les actions du jour: cockpit produit prioritaire, preuves produits partenaires, depots images categories, photos produits sprint et garde-fous checkout/publication/surprises. Elle reste en lecture seule et sert de tableau priorise d'execution.

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
npm run catalog:fast-proof-now-export
npm run catalog:audit-fast-proof-now-export
npm run catalog:single-product-cockpit
npm run catalog:product-cockpits-batch
npm run catalog:product-field-kit
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
npm run catalog:audit-public-dropshipping-surface
npm run catalog:audit-surprise-hold
npm run catalog:audit-checkout-eligibility
npm run catalog:dropshipping-focus-hold
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
npm run catalog:category-image-next-batch-kit
npm run catalog:category-image-intake-status
npm run catalog:daily-execution-board
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
