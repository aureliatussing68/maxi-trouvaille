# Rapport Maxi couche 355 - Alias programme partenaires

## Objectif
- Retirer deux anciennes pages publiques qui pouvaient brouiller la demonstration boutique.
- Garder les anciennes URLs fonctionnelles en les envoyant vers la vitrine produits partenaires.
- Ne modifier aucun produit, prix, stock, image ou statut de publication.

## Integration locale
- `next.config.ts`
  - Ajout du redirect permanent `/vendre` vers `/produits-partenaires`.
  - Ajout du redirect permanent `/deposer-annonce` vers `/produits-partenaires`.
  - Les redirects passent avant le filesystem Next.js.
- `src/app/vendre/page.tsx`
  - Remplacement de l'ancienne page programme par un alias serveur simple vers `/produits-partenaires`.
- `src/app/deposer-annonce/page.tsx`
  - Remplacement de l'ancienne page depot annonce par un alias serveur simple vers `/produits-partenaires`.

## Sauvegarde
- `business-maxi-trouvailles/backups/couche-355-alias-programme-partenaires-20260618/next.config.ts.bak`
- `business-maxi-trouvailles/backups/couche-355-alias-programme-partenaires-20260618/vendre-page.tsx.bak`
- `business-maxi-trouvailles/backups/couche-355-alias-programme-partenaires-20260618/deposer-annonce-page.tsx.bak`

## Verification
- `npx eslint next.config.ts src/app/vendre/page.tsx src/app/deposer-annonce/page.tsx --no-warn-ignored` OK.
- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit partenaire visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-checkout-eligibility` OK: 0 produit achetable attendu.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run catalog:audit-public-visual-ambiguity` OK.
- `npm run catalog:audit-generated-artifact-leaks` OK.
- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run build` OK, 49 pages generees.

## Verification HTTP locale
- Serveur local temporaire sur `localhost:3279`, coupe apres controle.
- `curl -I http://localhost:3279/vendre`
  - `HTTP/1.1 308 Permanent Redirect`
  - `location: /produits-partenaires`
- `curl -I http://localhost:3279/deposer-annonce`
  - `HTTP/1.1 308 Permanent Redirect`
  - `location: /produits-partenaires`
- `sitemap.xml` ne contient pas:
  - `https://maxitrouvaille.fr/vendre`
  - `https://maxitrouvaille.fr/deposer-annonce`

## Garde-fous
- Aucun achat, paiement, commande fournisseur, connexion compte, message reel, suppression definitive, video pub, API payante, publication production ou deploiement.
- Aucun changement catalogue, prix, stock, image ou donnees commande.
- Les anciens parcours restent accessibles uniquement comme alias vers la vitrine partenaires.
