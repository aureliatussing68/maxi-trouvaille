# Rapport Maxi Couche 371 - PWA short name mobile

Date locale: 2026-06-19 03:55 Europe/Paris

## Objectif

Rendre l'installation mobile Maxi Trouvaille plus propre et plus lisible, sans toucher au catalogue, sans publication et sans action sensible.

## Integrations

- `src/app/manifest.ts`
  - `short_name` racine resserre a `Maxi` pour eviter un libelle coupe sous l'icone mobile.
  - `id: "/"` ajoute pour stabiliser l'identite PWA.
  - `lang: "fr-FR"` ajoute pour declarer la langue de la surface mobile.
- `scripts/automation/audit_mobile_manifest_shortcuts.mjs`
  - Audit renforce sur le nom court mobile.
  - Audit renforce sur l'id racine et la langue du manifest.
  - Synthese enrichie avec le nom court mobile detecte.

## Audits et validations

- `node --check scripts/automation/audit_mobile_manifest_shortcuts.mjs` OK.
- `npm run catalog:audit-mobile-manifest` OK, 5 raccourcis requis, 0 alerte.
- `npm run catalog:audit-mobile-demo-nav` OK, 5 liens requis, 0 alerte.
- `npm run catalog:audit-public-catalog-source-guards` OK, 0 fuite.
- `npm run catalog:audit-legacy-alias-seo-surface` OK, 0 alerte.
- `npm run catalog:audit-transactional-noindex-surface` OK, 0 alerte.
- `npm run catalog:audit-seo-hold-visibility` OK, 121 produits non publics restent non indexables.
- `npm run catalog:audit-partner-checkout-surface` OK, 0 alerte.
- `npx eslint src/app/manifest.ts` OK.
- `npm run lint` OK.
- `npm run typecheck` OK.
- `npm run build` OK, 49 pages generees.
- Verification `.next/server/app/manifest.webmanifest.body` OK: `short_name` = `Maxi`, `id` = `/`, `lang` = `fr-FR`.

## Garde-fous

- Aucun paiement.
- Aucune commande fournisseur.
- Aucun achat reel.
- Aucune connexion compte.
- Aucune publication production ou deploiement.
- Aucun message reel.
- Aucune API payante.
- Aucune video pub.
- Aucun produit HOLD rendu public.
- Aucun fournisseur, AliExpress, Temu ou supplier expose cote client.
