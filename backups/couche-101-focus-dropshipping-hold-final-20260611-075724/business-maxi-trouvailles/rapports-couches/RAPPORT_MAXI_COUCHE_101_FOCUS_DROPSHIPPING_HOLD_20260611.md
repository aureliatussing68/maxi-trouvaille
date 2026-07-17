# Rapport Maxi Trouvailles - Couche 101 - Focus dropshipping HOLD legacy

Date locale: 2026-06-11 07:58 Europe/Paris

## Objectif

Mettre en suspens les produits personnels, fiches test et produits legacy encore publies afin de concentrer la boutique publique sur le dropshipping uniquement.

## Fichiers touches

- `data/quick-products.json`
- `src/lib/catalog.ts`
- `package.json`
- `scripts/automation/apply_dropshipping_focus_legacy_hold.mjs`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/tableaux-action/suspension-legacy-dropshipping-focus-20260611/SUSPENSION_LEGACY_FOCUS_DROPSHIPPING_20260611.json`
- `business-maxi-trouvailles/tableaux-action/suspension-legacy-dropshipping-focus-20260611/SUSPENSION_LEGACY_FOCUS_DROPSHIPPING_20260611.md`
- `business-maxi-trouvailles/file-validation-fournisseurs/AUDIT_CHECKOUT_ELIGIBILITY_20260611.json`
- `business-maxi-trouvailles/tableaux-action/execution-du-jour-20260611/EXECUTION_DU_JOUR_MAXI_20260611.json`
- `business-maxi-trouvailles/captures/couche-101-focus-dropshipping-hold/VERIFICATION_NAVIGATEUR_COUCHE_101.json`

## Sauvegardes

- Avant modification: `backups/couche-101-focus-dropshipping-hold-before-20260611-075234`
- Sauvegarde automatique quick-products appliquee: `backups/dropshipping-focus-hold-20260611-075406`
- Sauvegarde finale des fichiers touches: `backups/couche-101-focus-dropshipping-hold-final-20260611-075724`

## Produits mis en suspens

8 fiches rapides sont passees de `published` a `draft`:

- Filtre robinet inox 13 etapes avec LED
- Plafonnier LED 3 spots orientables blanc GU10
- Applique murale LED doree tricolore
- Controleur LED RGB/RGBW 5 canaux 12V/24V
- Interrupteur de phares chrome compatible Golf MK5/MK6
- Tapis educateurs pour chiot - lot entame
- Raquettes tennis Babolat Roland Garros Pulse avec housse
- Lot de tetes de mannequin aimantees

2 fiches statiques sont maintenant en `draft`:

- Pack revendeur
- Pack decouverte test

## Commandes ajoutees

- `npm run catalog:dropshipping-focus-hold`
- `npm run catalog:apply-dropshipping-focus-hold`

Ces commandes listent puis appliquent la mise en brouillon des fiches legacy reperees par l'audit checkout. Elles ne suppriment rien.

## Resultat business

- Produits achetables publics: 0
- Produits legacy achetables avant focus dropshipping: 0
- Produits dropshipping visibles: 0 tant que les preuves/images exactes ne sont pas validees
- Produits partenaires en HOLD: 37
- Aucune publication, aucun paiement, aucune commande fournisseur

## Tests executes

- Lecture docs Next locale: Server/Client Components et Fetching Data
- `node --check scripts/automation/apply_dropshipping_focus_legacy_hold.mjs` OK
- `npm run catalog:dropshipping-focus-hold` OK en dry-run
- `npm run catalog:apply-dropshipping-focus-hold` OK, 8 fiches rapides passees en `draft`
- `npm run catalog:audit-checkout-eligibility` OK, `legacyRiskProductCount=0`
- `npm run catalog:audit-public-dropshipping-surface` OK, 0 fuite client
- `npm run catalog:test-checkout-guards` OK, 11/11 cas passent
- `npm run catalog:audit-surprise-hold` OK, 0 echec
- `npm run catalog:daily-execution-board` OK, legacy a 0
- `npm run lint` OK
- `npm run typecheck` OK
- `npm run build` OK
- Verification navigateur via Playwright Edge sur `localhost:3010`: boutique desktop, boutique mobile et panier OK, 0 erreur console, 0 fuite fournisseur
- Scan secrets sur les fichiers touches OK, aucun motif sensible detecte

Note: le navigateur integre a tente Chrome mais Chrome n'etait pas disponible sur ce poste; verification faite via Playwright avec Edge local, sans installation ni telechargement.

## Garde-fous

- Aucune suppression definitive.
- Aucune publication.
- Aucun paiement Stripe.
- Aucune commande fournisseur.
- Aucun message client.
- Aucun telechargement ou remplacement d'image produit.

## Prochain pas recommande

Continuer sur le cockpit produit prioritaire: remplir les 12 preuves de la pochette cables et deposer 4 images WebP exactes, ou remplacer le produit si les preuves/droits ne sont pas rapides a obtenir.
