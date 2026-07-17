# Rapport Maxi couche 340 - FAQ, retours et conditions mobile

Date: 2026-06-18 16:18 Europe/Paris

## Objectif

Renforcer les pages de confiance encore trop legeres pour une visite telephone:
FAQ, retours/remboursements et conditions produits partenaires.

## Fichiers touches

- `src/app/faq/page.tsx`
- `src/app/retours-remboursements/page.tsx`
- `src/app/conditions-produits-partenaires/page.tsx`

Sauvegardes:

- `business-maxi-trouvailles/backups/couche-340-faq-retours-conditions-mobile-20260618/faq-page.tsx.bak`
- `business-maxi-trouvailles/backups/couche-340-faq-retours-conditions-mobile-20260618/retours-remboursements-page.tsx.bak`
- `business-maxi-trouvailles/backups/couche-340-faq-retours-conditions-mobile-20260618/conditions-produits-partenaires-page.tsx.bak`

## Integrations

- Ajout du panneau `Support sous controle` sur FAQ, retours et conditions partenaires.
- Ajout du parcours client sur les trois pages: articles valides, paiement Maxi Trouvaille, preparation suivie, suivi colis.
- Passage des pages en composants serveur async pour reutiliser les compteurs storefront.
- Conservation du verrou public: `0 article sans preuve`, `91 fiches en controle`, aucun produit douteux rendu achetable.

## Produits

- Aucun produit ajoute.
- Aucune publication.
- Toutes les fiches partenaires incompletes restent brouillon/HOLD.

## Tests et audits

- `npx eslint src/app/faq/page.tsx src/app/retours-remboursements/page.tsx src/app/conditions-produits-partenaires/page.tsx src/components/ServiceReadinessPanel.tsx src/components/CustomerJourneyPanel.tsx src/lib/storefront-control-metrics.ts`: OK
- `npm run typecheck`: OK
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 finding.
- `npm run catalog:audit-checkout-eligibility`: OK, 0 article achetable attendu.
- `npm run catalog:audit-seo-hold-visibility`: OK, 121 fiches non publiques hors indexation.
- `npm run catalog:audit-generated-artifact-leaks`: OK, 0 fuite.
- `npm run lint`: OK
- `npm run build`: OK

## Verification mobile navigateur

Dev server local temporaire: `http://127.0.0.1:3264`, arrete apres verification.

Pages controlees en viewport mobile:

- `/faq`
- `/retours-remboursements`
- `/conditions-produits-partenaires`

Resultats: H1 presents, panneau support visible, parcours client visible, compteurs HOLD visibles, aucune fuite AliExpress/Temu/supplier/fournisseur, aucun debordement horizontal, 0 warning/error console.

Captures:

- `tmp-next-couche-340-faq-mobile.png`
- `tmp-next-couche-340-retours-mobile.png`
- `tmp-next-couche-340-conditions-partenaires-mobile.png`

## Prochain pas

Continuer la grosse couche de confiance visible: relier encore mieux boutique, categories et pages confiance, puis reprendre le catalogue HOLD avec preuves exactes avant toute vente.
