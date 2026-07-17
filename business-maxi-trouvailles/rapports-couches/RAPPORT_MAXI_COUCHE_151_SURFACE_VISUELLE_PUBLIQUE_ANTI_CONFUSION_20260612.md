# Rapport couche 151 - Surface visuelle publique anti-confusion

Date: 2026-06-12
Statut: HOLD public maintenu

## Objectif

Reduire la confusion visuelle cote mobile/public: tant qu'aucun produit dropshipping n'a ses preuves exactes, les pages publiques ne doivent plus afficher de photos stock/Unsplash pouvant etre prises pour des articles vendus.

## Modifications integrees

- `src/components/HeroCarousel.tsx`: remplacement des 4 images Unsplash par des visuels locaux de rayons partenaires.
- `src/components/HeroCarousel.tsx`: libelles orientes validation, preuves avant vente, nouveautes partenaires et livraison suivie.
- `scripts/automation/audit_public_visual_ambiguity.mjs`: nouvel audit lecture seule de la surface visuelle publique.
- `package.json`: ajout de `npm run catalog:audit-public-visual-ambiguity`.
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`: commande et description ajoutees dans le workflow.

## Produits

- Produit ajoute: 0.
- Produit publie: 0.
- Produit rendu achetable: 0.
- Images produit exactes ajoutees: 0.
- Changement realise: suppression des visuels stock du hero public, sans toucher au catalogue.

## Preuves et controles

- `npm run catalog:audit-public-visual-ambiguity`: OK.
  - checkedSourceCount: 9
  - failureCount: 0
  - stockVisualFindingCount: 0
  - heroGuardOk: true
  - productCardAirbagOk: true
- `npm run catalog:audit-public-dropshipping-surface`: OK.
  - visibleDropshippingCount: 0
  - purchasableDropshippingCount: 0
  - failureCount: 0
  - draftBlockedCount: 37
- `npm run catalog:audit-checkout-eligibility`: OK.
  - totalProducts: 67
  - expectedPurchasableCount: 0
  - failureCount: 0
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- Verification navigateur Edge mobile locale:
  - `/`: validation/preparation presente, 0 image Unsplash, 0 overflow, 0 erreur console.
  - `/boutique`: validation/preparation presente, 0 image Unsplash, 0 lien produit, 0 bouton panier, 0 overflow, 0 erreur console.
  - `/produits-partenaires`: validation/preparation presente, 0 image Unsplash, 0 lien produit, 0 bouton panier, 0 overflow, 0 erreur console.

## Sauvegardes

- Avant couche: `backups/couche-151-public-visual-ambiguity-pre-20260612-001707`.
- Apres couche: `backups/couche-151-public-visual-ambiguity-final-20260612-002022`.

## Limites

- Les images de rayons restent des visuels de categorie, pas des photos produit exactes.
- Aucun produit ne doit etre publie tant que fournisseur, SKU, prix, marge, stock, delai, droits image et validation Mouss ne sont pas prouves.
- Les vraies photos produit exactes restent a produire/deposer via le pipeline visuels P0.

## Prochaine action recommandee

Passer sur une couche production catalogue utile: relancer `catalog:visual-production-board`, `catalog:visual-deposit-session` et prioriser le premier lot P0 de photos produits exactes a produire.
