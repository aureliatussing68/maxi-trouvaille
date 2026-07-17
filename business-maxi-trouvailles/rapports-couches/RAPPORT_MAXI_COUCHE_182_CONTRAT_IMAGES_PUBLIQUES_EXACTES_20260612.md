# Rapport Maxi Trouvailles - Couche 182 - Contrat images publiques exactes

Date: 2026-06-12

## Objectif

Eviter qu'une fiche dropshipping vendable affiche une mauvaise image produit sur la surface client, mobile, SEO ou Google.

## Fichiers touches

- `src/lib/catalog.ts`
- `scripts/automation/hold_public_products_with_unverified_images.mjs`
- `scripts/automation/audit_public_dropshipping_surface.mjs`
- `scripts/automation/audit_checkout_eligibility.mjs`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/tableaux-action/surface-publique-dropshipping-20260612/`
- `business-maxi-trouvailles/tableaux-action/public-image-hold-20260612/`
- `business-maxi-trouvailles/tableaux-action/surface-visuelle-publique-20260612/`
- `business-maxi-trouvailles/file-validation-fournisseurs/AUDIT_CHECKOUT_ELIGIBILITY_20260612.*`

Sauvegardes creees dans:

- `business-maxi-trouvailles/sauvegardes/20260612_couche_182_public_image_contract/`

## Changements

- Ajout du helper `getPublicImageBlockers(product)` dans `src/lib/catalog.ts`.
- Une fiche dropshipping publique est maintenant bloquee si une image produit est:
  - distante;
  - issue d'un CDN fournisseur;
  - issue d'Unsplash ou d'un visuel stock;
  - une image categorie utilisee comme photo produit;
  - une image generee ou placeholder;
  - hors depot produit exact;
  - non WebP.
- Les depots produits exacts acceptes sont:
  - `/uploads/partner-products/`
  - `/uploads/quick-products/`
- Le script `catalog:hold-public-unverified-images` detecte aussi ces cas et redige les images distantes dans ses rapports.
- Les audits `catalog:audit-public-dropshipping-surface` et `catalog:audit-checkout-eligibility` utilisent le meme niveau de blocage.

## Produits / commandes

- Produits ajoutes: 0.
- Produits publies localement rendus visibles: 0.
- Produits modifies dans `data/quick-products.json`: 0.
- Paiement: aucun.
- Commande fournisseur: aucune.
- Publication: aucune.
- API externe: aucune.

## Validations executees

- `npm run catalog:audit-public-dropshipping-surface` OK.
- `npm run catalog:hold-public-unverified-images` OK.
- `npm run catalog:audit-checkout-eligibility` OK.
- `npm run catalog:audit-public-visual-ambiguity` OK.
- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run build` OK.
- Scan anti-fuite cible sur rapports/exports 20260612 OK apres redaction des URLs images distantes dans l'audit surface.

## Resultat

- Produits dropshipping visibles localement: 0.
- Produits dropshipping achetables localement: 0.
- Brouillons/HOLD bloques par les audits: 61.
- Fiches deja en HOLD image: 16.

## Limites

- Cette couche ne prouve pas de nouvelles photos fournisseur.
- Elle ne telecharge aucune image et ne publie aucune fiche.
- Les fiches resteront invisibles tant que les photos exactes locales et les preuves humaines ne sont pas remplies.

## Statut

GO technique local pour le verrou image publique.
HOLD business pour toute publication, commande fournisseur, paiement ou remplacement d'image sans validation Mouss.

## Prochain pas recommande

Produire ou deposer les WebP exacts dans `public/uploads/partner-products`, puis relancer les audits image, surface publique, checkout et revue humaine avant de rendre une fiche vendable.
