# Rapport Maxi couche 306 - Export CSV plan prochain lot

Date: 2026-06-17

## Objectif

Ajouter un export CSV interne du plan produits du prochain lot dropshipping, pour reprendre la validation hors cockpit sans perdre les statuts de preuve.

## Integration locale

- Ajout de l'export "Export CSV plan prochain lot" dans le cockpit admin dropshipping.
- Le CSV reprend:
  - position;
  - preuve cible;
  - rayon;
  - statut apres preuve cible;
  - produit et slug;
  - priorite;
  - preuves suivantes;
  - lien interne de reprise admin;
  - garde HOLD.
- L'export reste interne/admin et ne publie rien.
- Aucun changement catalogue, aucune publication, aucune commande, aucun paiement, aucun message, aucune action fournisseur.

## Verification

- `npx eslint src/components/DropshippingAdminPanel.tsx`: OK.
- `npm run typecheck`: OK.
- `npm run lint`: OK.
- `npm run build`: OK.
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 produit dropshipping public/payant.
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 fuite publique.
- `npm run catalog:audit-seo-hold-visibility`: OK, produits HOLD non indexables.
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit eligible checkout.
- `npm run catalog:audit-admin-publication-ui-guard`: OK.
- `npm run catalog:audit-admin-page-guards`: OK.
- Verification Playwright mobile 390x844 sans service worker: export CSV visible, en-tetes OK, lignes OK, HOLD present, aucune fuite AliExpress/Temu/supplier, 0 erreur console, aucun debordement horizontal.

## Artefacts

- Capture mobile: `tmp-next-couche-306-mobile.png`.
- Logs serveur local: `tmp-next-couche-306-dev.out.log`, `tmp-next-couche-306-dev.err.log`.

## Suite conseillee

Ajouter une action de copie rapide pour les exports du cockpit, ou une synthese "lot pret a basculer en revue Mouss" sans jamais retirer le HOLD automatiquement.
