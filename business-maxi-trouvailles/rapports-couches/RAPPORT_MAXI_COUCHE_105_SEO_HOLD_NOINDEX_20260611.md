# Rapport Maxi Trouvailles - Couche 105 - SEO anti-indexation produits HOLD

Date locale: 2026-06-11 08:40 Europe/Paris

## Objectif

Eviter que des fiches brouillon/HOLD ou avec images non prouvees restent accessibles/indexables par Google pendant le focus dropshipping.

## Fichiers touches

- `src/app/produit/[slug]/page.tsx`
- `package.json`
- `scripts/automation/audit_seo_hold_visibility.mjs`
- `scripts/automation/prepare_maxi_daily_execution_board.mjs`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/tableaux-action/audit-seo-hold-visibility-20260611/AUDIT_SEO_HOLD_VISIBILITY_20260611.*`
- `business-maxi-trouvailles/tableaux-action/execution-du-jour-20260611/EXECUTION_DU_JOUR_MAXI_20260611.*`

## Sauvegardes

- Avant modification: `backups/couche-105-seo-noindex-hold-before-20260611-082924`
- Finale: `backups/couche-105-seo-noindex-hold-final-20260611-083914`

## Ce qui a ete integre

- `generateStaticParams()` ne prepare plus que les produits publics via `isPublicProduct`.
- La route produit est verrouillee avec `dynamicParams = false`: tout slug non genere retourne une vraie 404 HTTP.
- Suppression du rendu `force-dynamic` sur la fiche produit pendant ce mode SEO HOLD.
- Nouvelle commande `npm run catalog:audit-seo-hold-visibility`.
- Integration du statut SEO HOLD dans le tableau d'execution du jour.

## Resultat actuel

- Produits controles: 67.
- Produits publics attendus: 0.
- Produits non publics/HOLD hors indexation: 67.
- Echecs SEO: 0.
- Sitemap: ne contient pas `pack-decouverte-test`.
- Test HTTP local production: `/produit/pack-decouverte-test` retourne `404` et ne contient pas le nom du produit.

## Garde-fous

- Aucune publication.
- Aucun paiement.
- Aucune commande fournisseur.
- Aucun message client.
- Aucun deploiement.
- Les fiches produit non publiques ne doivent plus etre indexables tant que les preuves/image exacte manquent.

## Tests executes

- Lecture docs Next.js: `generateMetadata`, `generateStaticParams`, `sitemap`, `robots`, `dynamicParams`.
- `node --check scripts/automation/audit_seo_hold_visibility.mjs` OK
- `npm run catalog:audit-seo-hold-visibility` OK, `OK_HOLD_PRODUCTS_NOT_INDEXABLE`
- `npm run catalog:daily-execution-board` OK, 40 actions consolidees
- `npm run catalog:audit-public-dropshipping-surface` OK, 0 fuite client
- `npm run catalog:audit-checkout-eligibility` OK, 0 produit achetable
- `npm run lint` OK
- `npm run typecheck` OK
- `npm run build` OK
- `next start` local sur port 3020: sitemap `200`, fiche draft `404`
- Scan secrets cible OK: aucun secret detecte dans les fichiers touches ou rapports generes, uniquement la regle documentaire "Ne jamais copier de secret/API/token".

## Prochain pas recommande

Continuer la priorite produits: remplir les preuves fournisseur et deposer les WebP exacts pour sortir progressivement des fiches de HOLD, puis regénérer sitemap/build seulement quand la revue Mouss valide une fiche.
