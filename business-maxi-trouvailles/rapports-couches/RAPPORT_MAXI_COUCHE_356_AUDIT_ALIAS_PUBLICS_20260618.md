# Rapport Maxi couche 356 - Audit alias publics

## Objectif
- Ajouter un garde-fou automatique pour les anciennes URLs publiques et les routes demo mobile.
- Verifier que les alias publics restent en redirects permanents avant le redirect host canonique.
- Verifier que les vraies vitrines publiques restent dans le sitemap, et que les anciennes URLs sensibles ne sont pas indexees.
- Ne modifier aucun produit, prix, stock, image, commande ou statut de publication.

## Integration locale
- `scripts/automation/audit_public_route_aliases.mjs`
  - Nouvel audit lecture seule des redirects `publicRouteAliases` dans `next.config.ts`.
  - Controle des 15 alias publics attendus, dont `/dropshipping`, `/conditions-dropshipping`, `/vendre` et `/deposer-annonce`.
  - Controle du sitemap: `/nouveautes`, `/promotions`, `/produits-partenaires`, `/boutique` et routes de confiance doivent rester presents.
  - Controle anti-indexation: les alias publics ne doivent pas etre des routes statiques du sitemap.
  - Controle robots: `/dropshipping` et `/conditions-dropshipping` restent disallow avec les routes sensibles panier/paiement/admin/API.
  - Sorties JSON, Markdown et CSV dans `business-maxi-trouvailles/tableaux-action/audit-alias-publics-20260618/`.
- `package.json`
  - Ajout de `catalog:audit-public-route-aliases`.

## Sauvegarde
- `business-maxi-trouvailles/backups/couche-356-audit-alias-publics-20260618/package.json.bak`
- `business-maxi-trouvailles/backups/couche-356-audit-alias-publics-20260618/next.config.ts.readonly-snapshot.bak`
- `business-maxi-trouvailles/backups/couche-356-audit-alias-publics-20260618/sitemap.ts.readonly-snapshot.bak`
- `business-maxi-trouvailles/backups/couche-356-audit-alias-publics-20260618/robots.ts.readonly-snapshot.bak`

## Verification
- `npx eslint scripts/automation/audit_public_route_aliases.mjs --no-warn-ignored` OK.
- `npm run catalog:audit-public-route-aliases` OK: 15 alias attendus, 15 detectes, 0 alerte.
- `npm run catalog:audit-public-demo-copy` OK: 55 fichiers surveilles, 0 alerte.
- `npm run catalog:audit-public-catalog-source-guards` OK: 19 composants publics, 10 routes publiques, 0 alerte.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit partenaire visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-checkout-eligibility` OK: 0 produit achetable attendu, 0 echec.
- `npm run catalog:audit-seo-hold-visibility` OK: 121 produits non publics, 0 echec SEO/HOLD.
- `npm run catalog:audit-generated-artifact-leaks` OK: 14 fichiers scannes, 0 fuite sensible.
- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run build` OK, 49 pages generees.

## Garde-fous
- Aucun achat, paiement, commande fournisseur, connexion compte, message reel, suppression definitive, video pub, API payante, publication production ou deploiement.
- Aucun changement catalogue, prix, stock, image ou donnees commande.
- L'audit ajoute est strictement local et lecture seule; il sert a bloquer les regressions de surface publique/SEO.
