# Rapport Maxi couche 354 - Sitemap vitrines nouveautes promotions

## Objectif
- Raccorder les vitrines publiques `/nouveautes` et `/promotions` au sitemap technique.
- Garder les anciennes URLs sensibles hors sitemap et bloquees par robots.
- Ne modifier aucun produit, prix, stock, image ou statut de publication.

## Integration locale
- `src/app/sitemap.ts`
  - Ajout de `/nouveautes` avec priorite `0.92` et frequence `daily`.
  - Ajout de `/promotions` avec priorite `0.92` et frequence `daily`.
- `src/app/robots.ts`
  - Relu et sauvegarde, sans changement: `/dropshipping` et `/conditions-dropshipping` restent disallow.

## Sauvegarde
- `business-maxi-trouvailles/backups/couche-354-sitemap-vitrines-20260618/sitemap.ts.bak`
- `business-maxi-trouvailles/backups/couche-354-sitemap-vitrines-20260618/robots.ts.bak`

## Verification
- `npx eslint src/app/sitemap.ts src/app/robots.ts --no-warn-ignored` OK.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit partenaire visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-checkout-eligibility` OK: 0 produit achetable attendu.
- `npm run catalog:audit-generated-artifact-leaks` OK.
- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run build` OK, 49 pages generees.

## Verification HTTP locale
- Serveur local temporaire sur `localhost:3278`, coupe apres controle.
- `sitemap.xml` contient:
  - `https://maxitrouvaille.fr/nouveautes`
  - `https://maxitrouvaille.fr/promotions`
- `sitemap.xml` ne contient pas:
  - `https://maxitrouvaille.fr/dropshipping`
  - `https://maxitrouvaille.fr/conditions-dropshipping`
- `robots.txt` contient toujours:
  - `Disallow: /dropshipping`
  - `Disallow: /conditions-dropshipping`

## Garde-fous
- Aucun achat, paiement, commande fournisseur, connexion compte, message reel, suppression definitive, video pub, API payante, publication production ou deploiement.
- Aucun changement catalogue, prix, stock, image ou donnees commande.
- Les produits incomplets restent hors vente et hors index produit public.
