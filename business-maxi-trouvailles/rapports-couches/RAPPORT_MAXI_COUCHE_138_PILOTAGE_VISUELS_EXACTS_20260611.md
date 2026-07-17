# Maxi Trouvailles - Couche 138 - Pilotage visuels exacts

Date locale: 2026-06-11
Statut: HOLD maintenu

## Objectif

Afficher dans `Admin > Pilotage` le tableau unique `VISUELS_EXACTS_A_PRODUIRE_*` pour piloter les photos produits P0 et les images categories P1/P2 depuis le cockpit.

## Fichiers touches

- `src/app/admin/pilotage/page.tsx`
- `scripts/automation/audit_admin_publication_ui_guard.mjs`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/rapports-couches/couche-138-browser-check.json`
- `business-maxi-trouvailles/rapports-couches/couche-138-pilotage-visuels-exacts-desktop.png`
- `business-maxi-trouvailles/rapports-couches/couche-138-pilotage-visuels-exacts-mobile.png`

## Resultat

- Nouveau bloc `Production visuels exacts` dans `Pilotage`.
- Lecture du dernier `VISUELS_EXACTS_A_PRODUIRE_*`.
- Affichage des 17 visuels a produire: 8 photos produits P0 et 9 images categories P1/P2.
- Nouvel export admin: `maxi-production-visuels-exacts.csv`.
- Aucun fichier public copie, aucun catalogue modifie, aucune publication, aucun paiement.

## Validations

- `npm run catalog:audit-admin-publication-ui-guard`: OK
- `npm run typecheck`: OK
- `npm run lint`: OK
- `npm run catalog:visual-production-board`: OK, statut `HOLD_VISUELS_EXACTS_A_PRODUIRE`
- `npm run catalog:audit-photo-checklist`: OK, 8 WebP produits manquants
- `npm run catalog:category-image-intake-status`: OK, 9 WebP categories manquants
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible, 0 achetable
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit attendu achetable
- `npm run catalog:daily-execution-board`: OK
- `npm run build`: OK
- Playwright Edge `/admin/pilotage`: OK desktop et mobile, export CSV present, 18 lignes, aucun libelle fournisseur interdit dans le CSV, aucune erreur console, aucun debordement horizontal

## Prochain pas recommande

Traiter le CSV `maxi-production-visuels-exacts.csv`: produire d'abord les 8 photos produits P0, puis les 5 categories P1 et les 4 categories P2. Relancer ensuite `npm run catalog:visual-production-board`.
