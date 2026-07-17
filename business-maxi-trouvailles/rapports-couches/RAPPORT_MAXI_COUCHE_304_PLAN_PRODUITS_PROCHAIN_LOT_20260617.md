# Rapport Maxi couche 304 - Plan produits prochain lot

Date: 2026-06-17

## Objectif

Rendre le prochain lot de validation dropshipping directement exploitable sur mobile, sans modifier les fiches produit ni sortir de produit du HOLD.

## Integration locale

- Ajout d'un mini-plan "Plan produits prochain lot" dans le cockpit admin dropshipping.
- Le plan liste les premiers produits restant a traiter dans le prochain lot local.
- Chaque ligne affiche la preuve cible, le score de priorite, les preuves suivantes et un lien interne "Fiche admin".
- Ajout de l'export "Export plan produits prochain lot" pour reprendre la validation hors ecran.
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
- Verification Playwright mobile 390x844 sans service worker: plan visible, export lisible, ouverture du prochain lot OK, 0 erreur console, aucun debordement horizontal.

## Artefacts

- Capture mobile: `tmp-next-couche-304-mobile.png`.
- Logs serveur local: `tmp-next-couche-304-dev.out.log`, `tmp-next-couche-304-dev.err.log`.

## Suite conseillee

Ajouter une progression locale par produit du prochain lot, avec distinction "pret a verifier" / "bloque par preuves suivantes", toujours sans valider ni publier.
