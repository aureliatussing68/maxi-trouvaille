# Rapport couche 169 - Verrou image carte produit

Date: 2026-06-12 03:24 Europe/Paris
Statut: GO technique / HOLD business

## Objectif

Supprimer un risque de mauvaise image sur la surface client: une fiche non publique ou HOLD ne doit jamais afficher sa photo produit dans une grille, meme si une future page lui passe `showAdminControls`.

## Fichiers touches

- `src/components/ProductCard.tsx`
- `scripts/automation/audit_public_visual_ambiguity.mjs`
- `business-maxi-trouvailles/rapports-couches/RAPPORT_MAXI_COUCHE_169_VERROU_IMAGE_CARTE_PRODUIT_20260612.md`

## Sauvegardes

- `backups/product-card-public-image-lock-couche-169-20260612-031622/ProductCard.tsx`
- `backups/product-card-public-image-lock-couche-169-20260612-031622/audit_public_visual_ambiguity.mjs`

## Couche integree

- `ProductCard` utilise maintenant strictement `isPublicProduct(product)` pour afficher une vraie photo produit.
- Les fiches non publiques affichent une carte HOLD neutre sans image produit.
- En mode admin, la carte HOLD garde le nom du produit, la categorie et le lien `Modifier la fiche`, mais l image reste masquee tant que les preuves ne sont pas completes.
- L audit `catalog:audit-public-visual-ambiguity` bloque maintenant toute regression qui reintroduirait `showAdminControls || isPublicProduct(product)`.

## Produits / catalogue

- Produit ajoute: 0.
- Produit publie: 0.
- Produit rendu achetable: 0.
- Surface publique controlee: `publicProductCount=0`, `expectedPurchasableCount=0`, `visibleDropshippingCount=0`.

## Preuves navigateur

Captures creees:

- `business-maxi-trouvailles/captures/couche-169-product-card-image-lock/boutique-prod-desktop.png`
- `business-maxi-trouvailles/captures/couche-169-product-card-image-lock/boutique-prod-mobile.png`
- `business-maxi-trouvailles/captures/couche-169-product-card-image-lock/produits-partenaires-prod-desktop.png`
- `business-maxi-trouvailles/captures/couche-169-product-card-image-lock/accueil-prod-desktop.png`

Verification navigateur production locale:

- `/boutique`: texte validation visible, `productImageLikeCount=0`, `productLinkCount=0`, desktop sans debordement.
- `/boutique` mobile 390 px: texte validation visible, `productImageLikeCount=0`, `productLinkCount=0`, `scrollWidth=375`, `clientWidth=375`.
- `/produits-partenaires`: texte validation visible, aucune image produit publique.
- `/`: texte validation visible, aucune image produit publique.

## Validations

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run catalog:audit-public-visual-ambiguity`: OK, `failureCount=0`, `productCardAirbagOk=true`
- `npm run catalog:audit-public-dropshipping-surface`: OK, `visibleDropshippingCount=0`, `purchasableDropshippingCount=0`, `failureCount=0`, `draftBlockedCount=61`
- `npm run catalog:audit-checkout-eligibility`: OK, `expectedPurchasableCount=0`, `failureCount=0`
- `npm run catalog:audit-seo-hold-visibility`: OK, `OK_HOLD_PRODUCTS_NOT_INDEXABLE`, `publicProductCount=0`, `failureCount=0`
- `git diff --check`: OK, seulement l avertissement CRLF habituel sur `ProductCard.tsx`.
- Scan anti-fuite fichiers touches: OK, aucune valeur sensible detectee.

## Limites

- Cette couche ne prouve aucune image fournisseur et ne remplace aucune photo.
- Les produits restent invisibles/non achetables tant que fournisseur exact, SKU, prix, stock, delai, droits image et validation Mouss manquent.

## Prochain pas recommande

Continuer le chantier images exactes: produire ou deposer les WebP exacts des 5 produits prioritaires, puis relancer les audits `catalog:audit-sprint-image-local-files` et `catalog:audit-sprint-image-human-review`.
