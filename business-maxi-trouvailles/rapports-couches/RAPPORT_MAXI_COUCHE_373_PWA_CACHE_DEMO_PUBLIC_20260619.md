# Rapport Maxi Couche 373 - PWA cache demo public

Date locale: 2026-06-19 04:09 Europe/Paris

## Objectif

Ameliorer la robustesse de la demonstration mobile en gardant en cache les routes publiques utiles, sans precacher de surface sensible.

## Integrations

- `public/sw.js`
  - Cache PWA passe en `maxi-trouvaille-pwa-v2`.
  - Ajout de `DEMO_ROUTES` pour les pages publiques de demonstration: boutique, produits partenaires, nouveautes, promotions, suivi colis, contact.
  - Precaching centralise avec `PRECACHE_URLS = [...APP_SHELL, ...DEMO_ROUTES]`.
  - Le garde-fou API reste actif: les requetes `/api/` ne sont pas interceptees.
- `scripts/automation/audit_offline_demo_surface.mjs`
  - Audit renforce pour verifier les routes demo precachees.
  - Controle que le precache ne contient pas admin, API, panier, paiement ou anciennes routes sensibles.
  - Synthese enrichie avec `demoRouteCount` et `precacheUrlCount`.

## Audits et validations

- `node --check scripts/automation/audit_offline_demo_surface.mjs` OK.
- `npm run catalog:audit-offline-demo-surface` OK, 6 routes demo, 12 URLs precachees, 0 alerte.
- `npm run catalog:audit-mobile-manifest` OK, 0 alerte.
- `npm run catalog:audit-mobile-demo-nav` OK, 0 alerte.
- `npm run catalog:audit-public-catalog-source-guards` OK, 0 fuite.
- `npm run catalog:audit-public-demo-copy` OK, 57 fichiers publics surveilles, 0 alerte.
- `npm run catalog:audit-seo-hold-visibility` OK, 121 produits non publics restent non indexables.
- `npm run catalog:audit-partner-checkout-surface` OK, 0 alerte.
- `npm run lint` OK.
- `npm run typecheck` OK.
- `npm run build` OK, 49 pages generees.
- Verification port temporaire OK: aucun serveur laisse ouvert sur 3139-3143.

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
