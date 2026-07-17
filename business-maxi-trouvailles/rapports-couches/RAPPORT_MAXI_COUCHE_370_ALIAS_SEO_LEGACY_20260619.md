# Rapport Maxi couche 370 - Alias SEO legacy

Date: 2026-06-19 03:49 Europe/Paris

## Objectif

Rendre les anciennes routes techniques plus propres pour le SEO et la demonstration: redirections permanentes vers les pages client propres, robots public moins bavard, sitemap centre sur les routes vitrine utiles.

## Integrations

- Passage de `/dropshipping` en `permanentRedirect("/produits-partenaires")`.
- Passage de `/conditions-dropshipping` en `permanentRedirect("/conditions-produits-partenaires")`.
- Retrait des anciens chemins legacy de `src/app/robots.ts`.
- Ajout explicite de `/paiement/annule` et `/paiement/succes` dans les disallow robots.
- Ajout de `scripts/automation/audit_legacy_alias_seo_surface.mjs`.
- Ajout du script `catalog:audit-legacy-alias-seo-surface`.
- Mise a jour de `scripts/automation/audit_public_route_aliases.mjs` pour preferer les alias permanents discrets plutot que l'annonce des anciens chemins dans robots.
- Sauvegarde avant modification: `business-maxi-trouvailles/backups/couche-370-seo-alias-legacy-20260619`.

## Validations

- `node --check scripts/automation/audit_legacy_alias_seo_surface.mjs`: OK.
- `node --check scripts/automation/audit_public_route_aliases.mjs`: OK.
- `npm run catalog:audit-legacy-alias-seo-surface`: OK, 2 alias legacy, 0 alerte.
- `npm run catalog:audit-public-route-aliases`: OK, 15 alias publics, 0 alerte.
- `npm run catalog:audit-transactional-noindex-surface`: OK.
- `npm run catalog:audit-public-catalog-source-guards`: OK.
- `npm run catalog:audit-seo-hold-visibility`: OK.
- `npx eslint src/app/robots.ts src/app/sitemap.ts src/app/dropshipping/page.tsx src/app/conditions-dropshipping/page.tsx`: OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK, 49 pages generees.

## Verification locale

- Verification HTTP locale sur serveur temporaire `3141`: robots propre et alias legacy rediriges, puis serveur coupe.
- Verification artefacts `.next/server/app/robots.txt.body` et `sitemap.xml.body`: aucun `/dropshipping`, `/conditions-dropshipping`, `AliExpress`, `Temu`, `supplier` ou `fournisseur`.
- `robots.txt` build contient bien `/paiement/annule`, `/paiement/succes`, `/admin/` et `/api/`.

## Garde-fous

- Aucune commande, aucun paiement reel, aucune publication et aucun deploiement.
- Aucune connexion compte, aucun message reel, aucun service payant externe.
- Aucune fiche produit rendue achetable.
- Les produits sans preuves completes restent en brouillon/HOLD et non indexables.
