# Rapport Maxi couche 291 - Scroll mobile lot actif preuve/rayon

## Objectif

Faciliter la reprise mobile des lots preuve/rayon dans l'admin dropshipping: apres selection d'une carte de file, ramener automatiquement Mouss sur le panneau actif au lieu de le laisser chercher le bon bloc.

## Integration locale

- Ajout d'une ancre stable `dropshipping-active-proof-category-panel` sur le panneau "File active".
- Ajout d'un focus programmatique mobile et d'un scroll doux vers le lot actif apres changement de couple preuve/rayon.
- Respect de `prefers-reduced-motion` pour eviter le scroll anime si l'appareil le demande.
- Ajout d'un badge mobile "Position mobile" dans le panneau actif.
- Aucun changement de catalogue, de publication ou de statut HOLD.

## Garde-fous

- Les brouillons restent en HOLD tant que les preuves exactes et la validation Mouss ne sont pas completes.
- Aucun paiement, aucune commande fournisseur, aucun achat reel, aucune connexion compte, aucun message reel, aucun deploiement.
- Aucune exposition client de source fournisseur, AliExpress, Temu ou supplier.

## Verifications

- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-admin-page-guards` OK.
- `npm run catalog:audit-checkout-eligibility` OK.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run catalog:audit-public-visual-ambiguity` OK.
- `npm run build` OK.
- Verification navigateur mobile sur `http://127.0.0.1:3116/admin/dropshipping` OK: selection du couple `Droits image / Enfant`, panneau actif visible en haut de viewport, focus sur l'ancre, badge mobile visible, checklist execution conservee, aucune erreur console, aucun debordement horizontal.

## Capture

- `tmp-next-couche-291-mobile.png`

## Suite conseillee

Ajouter une action mobile "lot suivant" dans le panneau actif pour enchainer les 3 couples preuve/rayon sans redescendre dans la file.
