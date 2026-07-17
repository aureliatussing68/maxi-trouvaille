# Rapport Maxi couche 305 - Statut produits prochain lot

Date: 2026-06-17

## Objectif

Rendre le plan du prochain lot dropshipping plus actionnable, en indiquant produit par produit si la preuve cible permettrait une revue finale ou si d'autres preuves bloquent encore la fiche.

## Integration locale

- Ajout d'un calcul de plan produit pour le prochain lot local.
- Ajout des compteurs "A verifier" et "Encore bloques" dans la carte du prochain lot.
- Chaque produit du mini-plan affiche maintenant:
  - le statut apres preuve cible: "Pret a verifier" ou "Bloque par X preuve(s)";
  - le score de priorite;
  - le badge HOLD actif;
  - les preuves suivantes restantes.
- L'export "Plan produits prochain lot" reprend les memes statuts, sans lien fournisseur ni donnees sensibles.
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
- Verification Playwright mobile 390x844 sans service worker: compteurs visibles, statuts produit visibles, export coherent, aucune fuite AliExpress/Temu/supplier, 0 erreur console, aucun debordement horizontal.

## Artefacts

- Capture mobile: `tmp-next-couche-305-mobile.png`.
- Logs serveur local: `tmp-next-couche-305-dev.out.log`, `tmp-next-couche-305-dev.err.log`.

## Suite conseillee

Ajouter un export CSV du plan produit par prochain lot pour faciliter la validation hors cockpit, toujours en brouillon/HOLD.
