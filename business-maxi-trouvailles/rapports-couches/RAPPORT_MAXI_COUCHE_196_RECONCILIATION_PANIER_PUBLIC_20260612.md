# Rapport couche 196 - reconciliation panier public

Date: 2026-06-12

## Objectif

Empecher un vieux panier local navigateur de conserver ou compter un produit HOLD/non public apres le durcissement du catalogue public cote serveur.

## Couche integree

- Ajout de `src/app/api/cart/eligible-items/route.ts`.
- L'API interne expose uniquement les champs minimums `id` et `stock` des produits publics et achetables.
- `CartProvider` ne charge toujours pas le catalogue brut cote client.
- A l'hydratation, le panier local est reconcilie avec `/api/cart/eligible-items`.
- Les lignes non eligibles sont purgees, les doublons sont fusionnes et les quantites sont bornees au stock public eligible.
- Les audits checkout et source publique verrouillent cette nouvelle barriere.

## Fichiers touches

- `src/app/api/cart/eligible-items/route.ts`
- `src/components/CartProvider.tsx`
- `scripts/automation/audit_checkout_eligibility.mjs`
- `scripts/automation/audit_public_catalog_source_guards.mjs`

Sauvegarde avant modification:

- `business-maxi-trouvailles/sauvegardes/20260612_couche_196_reconciliation_panier_public/`

## Validations

- `node --check scripts/automation/audit_checkout_eligibility.mjs`: OK
- `node --check scripts/automation/audit_public_catalog_source_guards.mjs`: OK
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit achetable attendu, 0 echec
- `npm run catalog:test-checkout-guards`: OK, 11/11 cas passent
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 finding
- `npm run typecheck`: OK
- `npm run lint`: OK
- `npm run build`: OK
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 produit dropshipping visible/achetable public
- `npm run catalog:daily-execution-board`: OK, tableau du jour regenere en lecture seule
- `npm run catalog:audit-generated-artifact-leaks`: OK, 0 fuite detectee

Verification navigateur:

- Test Playwright local sur `/panier` avec un ancien item localStorage inexistant/HOLD.
- Resultat: l'ancien item est purge, le panier redevient vide, aucun produit stale n'apparait.
- Le serveur de test local a ete arrete ensuite.

## Etat business

- Aucune fiche produit n'a ete publiee.
- Aucun achat, paiement, commande fournisseur, connexion compte, message reel ou deploiement.
- Les produits restent en brouillon/HOLD tant que les preuves exactes image, fournisseur, prix, stock, delai, droits image et validation Mouss ne sont pas completes.

## Prochaine couche utile

Continuer le chantier images exactes: depot manuel des 12 WebP attendus, puis copie controlee seulement si le gate `publicImageCopyReadyCandidateCount` passe au vert.
