# Rapport Maxi couche 309 - Lot prioritaire revue Mouss

Date: 2026-06-17

## Objectif

Rendre la revue Mouss file active plus directement actionnable dans le cockpit admin dropshipping, avec un lot prioritaire clair, un export CSV global et une verification mobile propre.

## Integration locale

- Ajout du tri local "lot prioritaire" sur la file active revue Mouss.
- Ajout de la carte "Lot prioritaire maintenant" avec preuve, rayon, candidats a relire et brouillons encore bloques.
- Ajout du bouton "Ouvrir lot prioritaire" pour basculer directement sur le lot recommande.
- Ajout de l'export "Export CSV revue Mouss file active" avec colonnes position, lot_prioritaire, preuve, rayon, candidats, blocages visibles et garde_hold.
- Correction mobile du tableau admin large: les conteneurs gardent `min-w-0`, le tableau scrolle dans sa boite et ne force plus la page a deborder.
- Aucun changement catalogue, aucune publication, aucune commande, aucun paiement, aucun message, aucune action fournisseur.

## Verification

- `npm run typecheck`: OK.
- `npx eslint src/components/DropshippingAdminPanel.tsx`: OK.
- `npm run lint`: OK.
- `npm run build`: OK.
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 produit dropshipping public/payant, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 fuite publique.
- `npm run catalog:audit-seo-hold-visibility`: OK, produits HOLD non indexables.
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit eligible checkout.
- `npm run catalog:audit-admin-publication-ui-guard`: OK.
- `npm run catalog:audit-admin-page-guards`: OK.
- Verification Playwright mobile 390x844 sans service worker: carte prioritaire visible, CSV global lisible, bouton "Ouvrir lot prioritaire" fonctionnel, aucune fuite AliExpress/Temu/supplier dans le CSV, aucun debordement horizontal global (`390/390`).

## Artefacts

- Capture mobile: `tmp-next-couche-309-mobile.png`.
- Logs serveur local: `tmp-next-couche-309-dev.out.log`, `tmp-next-couche-309-dev.err.log`.
- Serveur local de verification ferme apres test, port `3134` libre.

## Suite conseillee

Continuer avec une couche catalogue qui utilise ce lot prioritaire pour preparer les preuves manquantes produit par produit, sans sortir du HOLD avant preuve exacte et validation Mouss.
