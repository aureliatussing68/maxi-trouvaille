# Rapport couche 150 - Airbag carte produit image HOLD

Date: 2026-06-12
Statut: HOLD public maintenu

## Objectif

Ajouter un verrou de rendu cote client: si une fiche non publique ou HOLD arrive accidentellement dans une carte produit, la carte ne doit pas afficher sa photo, son titre reel, son lien produit ni son bouton panier.

## Modifications integrees

- `src/components/ProductCard.tsx`: ajout du controle `isPublicProduct(product)` avant rendu public.
- `src/components/ProductCard.tsx`: rendu neutre `Fiche en validation` pour les fiches non publiques quand elles ne sont pas en mode admin.
- `src/components/ProductCard.tsx`: la carte neutre ne contient pas d'image produit, pas de lien `/produit/...`, pas de bouton achat et pas de titre reel.
- `scripts/automation/audit_public_dropshipping_surface.mjs`: l'audit verifie maintenant que `ProductCard` conserve le garde-fou public, le gate de rendu et le placeholder HOLD.

## Produits

- Produit ajoute: 0.
- Produit publie: 0.
- Produit rendu achetable: 0.
- Produit corrige: 0 fiche catalogue; correction de securite UI uniquement.

## Preuves et controles

- `npm run catalog:audit-public-dropshipping-surface`: OK.
  - visibleDropshippingCount: 0
  - purchasableDropshippingCount: 0
  - failureCount: 0
  - draftBlockedCount: 37
  - publishedReadinessFailureCount: 0
- `npm run catalog:audit-checkout-eligibility`: OK.
  - totalProducts: 67
  - expectedPurchasableCount: 0
  - failureCount: 0
  - guardFailures: 0
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- Verification navigateur Edge mobile locale:
  - `/boutique`: validation copy presente, 0 lien produit, 0 bouton panier, 0 overflow.
  - `/produits-partenaires`: validation copy presente, 0 lien produit, 0 bouton panier, 0 overflow.
  - consoleErrors: 0.

## Sauvegardes

- Avant couche: `backups/couche-150-product-card-airbag-pre-20260612-000921`.
- Apres couche: `backups/couche-150-product-card-airbag-final-20260612-001503`.

## Limites

- Aucun produit n'est valide par cette couche.
- L'airbag evite l'affichage accidentel d'une mauvaise fiche, mais les vraies images exactes doivent encore etre produites ou deposees dans le pipeline visuels.

## Prochaine action recommandee

Passer sur une couche production visuels exacts: relancer le tableau des visuels P0, choisir le premier lot photo produit, puis remplir/deposer les fichiers WebP exacts avant revue humaine.
