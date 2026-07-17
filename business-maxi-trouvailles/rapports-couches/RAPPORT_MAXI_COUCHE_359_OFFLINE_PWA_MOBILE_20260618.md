# Rapport Maxi couche 359 - Offline PWA mobile

Date locale: 2026-06-18 20:03 Europe/Paris

## Objectif

Rendre la page `/offline` plus utile et presentable sur telephone pour une boutique PWA, sans toucher au catalogue, sans publier de produit et sans action sensible.

## Integration

- Page `src/app/offline/page.tsx` renforcee avec un layout mobile en deux zones: message hors ligne, reprise de connexion, raccourcis vers boutique, produits partenaires et suivi colis.
- Ajout de cartes confiance cote client: boutique gardee propre, paiement Maxi Trouvaille, suivi centralise.
- Ajout de `/offline` dans `scripts/automation/audit_public_demo_copy.mjs` pour surveiller cette surface dans les audits anti-fuite publics.

## Sauvegardes

- `business-maxi-trouvailles/backups/couche-359-offline-pwa-mobile-20260618/offline-page.tsx.bak`
- `business-maxi-trouvailles/backups/couche-359-offline-pwa-mobile-20260618/audit_public_demo_copy.mjs.bak`

## Verifications

- `npx eslint src/app/offline/page.tsx scripts/automation/audit_public_demo_copy.mjs --no-warn-ignored`: OK
- `npm run catalog:audit-public-demo-copy`: OK, 56 fichiers surveilles, 0 alerte
- `npm run catalog:audit-mobile-manifest`: OK
- `npm run catalog:audit-public-route-aliases`: OK
- `npm run catalog:audit-public-catalog-source-guards`: OK
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 produit dropshipping visible ou achetable, 91 brouillons bloques
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit achetable attendu
- `npm run catalog:audit-seo-hold-visibility`: OK
- `npm run catalog:audit-generated-artifact-leaks`: OK
- `npm run typecheck`: OK
- `npm run lint`: OK
- `npm run build`: OK, `/offline` genere en statique
- Verification navigateur mobile localhost `http://127.0.0.1:3282/offline` en 390 x 844: OK, titre et textes attendus presents, 0 mot interdit, 0 erreur console, 0 debordement horizontal. Serveur local arrete apres verification.

## Garde-fous

- Aucune commande fournisseur, aucun paiement, aucun achat reel, aucune connexion compte, aucune publication production/deploiement.
- Aucun message reel, aucune API payante, aucune video pub.
- Aucun terme AliExpress, Temu, fournisseur, supplier, seller, Stripe, HOLD ou dropshipping expose cote client sur `/offline`.
