# Rapport couche 170 - Verrou image fiche produit

Date: 2026-06-12 03:33 Europe/Paris
Statut: GO technique / HOLD business

## Objectif

Fermer l autre chemin sensible cote client: une fiche produit non publique/HOLD ne doit jamais afficher sa galerie image, meme en preview admin, tant que l image exacte et les droits ne sont pas prouves.

## Fichiers touches

- `src/app/produit/[slug]/page.tsx`
- `scripts/automation/audit_public_visual_ambiguity.mjs`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/rapports-couches/RAPPORT_MAXI_COUCHE_170_VERROU_IMAGE_FICHE_PRODUIT_20260612.md`

## Sauvegardes

- `backups/product-page-image-lock-couche-170-20260612-032654/product-page.tsx`
- `backups/product-page-image-lock-couche-170-20260612-032654/audit_public_visual_ambiguity.mjs`
- `backups/product-page-image-lock-couche-170-20260612-032654/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`

## Couche integree

- Ajout d un verrou `canShowProductImages = isPublicProduct(product)` dans la fiche produit.
- Si la fiche n est pas publiable, la galerie produit est vide et l image principale devient un bloc neutre `Image verrouillée`.
- En `adminPreview`, une alerte indique que l image, l achat et la publication restent bloques jusqu aux preuves completes.
- L audit `catalog:audit-public-visual-ambiguity` controle maintenant aussi `src/app/produit/[slug]/page.tsx`.
- L audit verifie le garde `productDetailImageGuardOk=true` et bloque toute galerie construite sans garde public.

## Produits / catalogue

- Produit ajoute: 0.
- Produit publie: 0.
- Produit rendu achetable: 0.
- Etat catalogue confirme: `publicProductCount=0`, `nonPublicProductCount=91`, `expectedPurchasableCount=0`.

## Preuves navigateur

Captures creees:

- `business-maxi-trouvailles/captures/couche-170-product-detail-image-lock/boutique-prod-mobile.png`
- `business-maxi-trouvailles/captures/couche-170-product-detail-image-lock/boutique-prod-desktop-edge.png`
- `business-maxi-trouvailles/captures/couche-170-product-detail-image-lock/draft-admin-preview-prod-desktop-edge.png`
- `business-maxi-trouvailles/captures/couche-170-product-detail-image-lock/shielded-admin-preview-prod-desktop-edge.png`

Verification production locale `ADMIN_MODE=true`:

- `/boutique`: HTTP 200, validation visible, `productImageLikeCount=0`, `productLinkCount=0`, desktop `scrollWidth=1280`, `clientWidth=1280`.
- `/boutique` mobile: validation visible, `productImageLikeCount=0`, `productLinkCount=0`, `scrollWidth=375`, `clientWidth=375`.
- `/produit/mini-imprimante-thermique-bluetooth?adminPreview=1`: HTTP 404, `productImageLikeCount=0`.
- `/produit/palette-mystere-destockage?adminPreview=1`: HTTP 404, `productImageLikeCount=0`.

Le 404 confirme que le bouclier SEO/dynamic params bloque deja les slugs HOLD en production; le nouveau verrou image couvre le rendu si ce mode preview devient accessible dans un contexte futur.

## Validations

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run catalog:audit-public-visual-ambiguity`: OK, `checkedSourceCount=10`, `failureCount=0`, `productDetailImageGuardOk=true`
- `npm run catalog:audit-seo-hold-visibility`: OK, `OK_HOLD_PRODUCTS_NOT_INDEXABLE`, `failureCount=0`
- `npm run catalog:audit-public-dropshipping-surface`: OK, `visibleDropshippingCount=0`, `purchasableDropshippingCount=0`, `failureCount=0`
- `npm run catalog:audit-checkout-eligibility`: OK, `expectedPurchasableCount=0`, `failureCount=0`
- `npm run catalog:test-checkout-guards`: OK, `caseCount=11`, `failedCount=0`
- `git diff --check`: OK, seulement l avertissement CRLF habituel sur `src/app/produit/[slug]/page.tsx`.
- Scan anti-fuite: OK, seulement les mentions de regle `secret/API/token` dans la doc d automatisation.

## Limites

- Aucune image exacte n a ete prouvee ou remplacee dans cette couche.
- Les fiches restent HOLD tant que fournisseur exact, SKU, prix, stock, delai, droits image et validation Mouss ne sont pas remplis.

## Prochain pas recommande

Continuer avec un atelier admin de priorisation "premieres fiches a sauver": choisir 3 produits dropshipping a potentiel, produire/deposer leurs WebP exacts et remplir les preuves fournisseur terrain avant toute publication.
