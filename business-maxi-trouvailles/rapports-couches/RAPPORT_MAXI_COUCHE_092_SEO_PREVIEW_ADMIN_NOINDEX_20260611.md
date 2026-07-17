# Rapport Maxi Trouvaille - Couche 092 - SEO preview admin noindex

Date: 2026-06-11
Statut: GO local, HOLD publication produits

## Objectif

Verrouiller les surfaces SEO apres le passage en focus dropshipping: eviter qu'une preview admin ou une URL interne soit indexee, et confirmer que le sitemap ne reference aucun produit suspendu.

## Sauvegarde

Sauvegarde locale avant modification:

- `backups/couche-092-seo-admin-preview-noindex-20260611_0601`

## Changements appliques

- Ajout de `robots: noindex, nofollow` sur les fiches produit ouvertes en preview admin via `?adminPreview=1`.
- Ajout de `googlebot: noindex, nofollow` sur ces previews.
- Ajout dans `robots.txt` des exclusions:
  - `/admin/`
  - `/api/admin/`
  - `/*?adminPreview=1`
- Controle du sitemap local: 0 URL `/produit/` tant que les produits dropshipping restent en HOLD/brouillon.

## Fichiers touches

- `src/app/produit/[slug]/page.tsx`
- `src/app/robots.ts`

## Validations executees

- Lecture doc Next locale `generateMetadata` / champ `robots`.
- `npm run typecheck`: OK
- `npm run lint`: OK
- `npm run build`: OK, 49 routes generees
- `npm run catalog:audit-all-partner-gates`: OK, 37 produits partenaires, 0 publie, 37 HOLD/brouillon
- `npm run catalog:test-checkout-guards`: OK, 11/11
- Verification locale:
  - `robots.txt` contient `/api/admin/` et `/*?adminPreview=1`
  - `sitemap.xml` contient 0 URL produit
  - une fiche `?adminPreview=1` contient `noindex, nofollow`

## Securite

- Aucun paiement.
- Aucune commande fournisseur.
- Aucun deploiement.
- Aucune publication produit.
- Aucune API externe payante.

## Prochaine couche recommandee

Passer a la couche produit: produire une shortlist stricte de 5 produits dropshipping prioritaires a valider avec preuve fournisseur, SKU, stock, prix, delai France/Europe et images exactes avant toute publication.
