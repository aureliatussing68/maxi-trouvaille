# Rapport Maxi Couche 374 - Alignement mobile PWA SW

Date locale: 2026-06-19 04:13 Europe/Paris

## Objectif

Eviter les derives entre la barre mobile, les raccourcis PWA et le service worker apres le renfort cache de demo. Garder une surface telephone coherent, visible et sans route sensible.

## Integrations

- `scripts/automation/audit_mobile_demo_nav.mjs`
  - Audit renforce avec lecture de `public/sw.js`.
  - Controle que chaque lien mobile requis est aussi dans `DEMO_ROUTES`.
  - Controle que `DEMO_ROUTES` ne contient pas admin, API, panier, paiement ou anciennes routes sensibles.
  - Autorise `/contact` comme exception support explicite dans le service worker.
  - Synthese enrichie avec `serviceWorkerDemoRouteCount`.

## Audits et validations

- `node --check scripts/automation/audit_mobile_demo_nav.mjs` OK.
- `npm run catalog:audit-mobile-demo-nav` OK, 5 liens mobile, 6 routes service worker demo, 0 alerte.
- `npm run catalog:audit-offline-demo-surface` OK, 6 routes demo, 12 URLs precachees, 0 alerte.
- `npm run catalog:audit-mobile-manifest` OK, 0 alerte.
- `npm run catalog:audit-public-catalog-source-guards` OK, 0 fuite.
- `npm run catalog:audit-public-demo-copy` OK, 57 fichiers publics surveilles, 0 alerte.
- `npm run catalog:audit-seo-hold-visibility` OK, 121 produits non publics restent non indexables.
- `npm run catalog:audit-partner-checkout-surface` OK, 0 alerte.
- `npm run catalog:audit-legacy-alias-seo-surface` OK, 0 alerte.
- `npm run lint` OK.
- `npm run typecheck` OK.
- `npm run build` OK, 49 pages generees.
- Verification port temporaire OK: aucun serveur ouvert sur 3139-3144.

## Garde-fous

- Aucun paiement.
- Aucune commande partenaire.
- Aucun achat reel.
- Aucune connexion compte.
- Aucune publication production ou deploiement.
- Aucun message reel.
- Aucune API payante.
- Aucune video pub.
- Aucun produit HOLD rendu public.
- Aucun fournisseur, AliExpress, Temu ou supplier expose cote client.
