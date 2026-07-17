# Rapport Maxi couche 341 - Programme partenaires et anciennes routes mobile

Date: 2026-06-18 16:28 Europe/Paris

## Objectif

Eviter que les anciennes pages `vendre`, `deposer-annonce` et l'ancienne adresse partenaires donnent une impression de site incomplet. Le public doit voir un parcours ferme, coherent et centre boutique produits partenaires.

## Fichiers touches

- `src/components/PartnerProgramGatePanel.tsx`
- `src/app/vendre/page.tsx`
- `src/app/deposer-annonce/page.tsx`
- `src/app/dropshipping/page.tsx`

Sauvegardes:

- `business-maxi-trouvailles/backups/couche-341-programme-partenaires-ferme-mobile-20260618/vendre-page.tsx.bak`
- `business-maxi-trouvailles/backups/couche-341-programme-partenaires-ferme-mobile-20260618/deposer-annonce-page.tsx.bak`
- `business-maxi-trouvailles/backups/couche-341-programme-partenaires-ferme-mobile-20260618/dropshipping-page.tsx.bak`

## Integrations

- Ajout d'un panneau commun `Acces encadre`: formulaire ferme, boutique prioritaire, controle avant mise en ligne, vente protegee.
- Renforcement de `/vendre` avec les compteurs storefront, le gate programme partenaires et le parcours client.
- Transformation de `/deposer-annonce` en page propre: ancien depot remplace, aucun formulaire actif, lien logique vers le programme partenaires.
- Remplacement de l'ancienne route `/dropshipping` par une page propre "Produits partenaires Maxi Trouvaille" afin d'eviter une page blanche et de garder une vitrine mobile coherent.

## Produits

- Aucun produit ajoute.
- Aucune publication.
- Aucune fiche rendue achetable.
- Les 91 fiches partenaires restent en controle/HOLD tant que les preuves ne sont pas completes.

## Tests et audits

- `npx eslint src/app/vendre/page.tsx src/app/deposer-annonce/page.tsx src/app/dropshipping/page.tsx src/components/PartnerProgramGatePanel.tsx src/components/ServiceReadinessPanel.tsx src/components/CustomerJourneyPanel.tsx src/lib/storefront-control-metrics.ts`: OK
- `npm run typecheck`: OK
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 finding.
- `npm run catalog:audit-checkout-eligibility`: OK, 0 article achetable attendu.
- `npm run catalog:audit-seo-hold-visibility`: OK, 121 fiches non publiques hors indexation.
- `npm run catalog:audit-generated-artifact-leaks`: OK, 0 fuite.
- `npm run lint`: OK
- `npm run build`: OK

## Verification mobile navigateur

Dev server local temporaire: `http://127.0.0.1:3265`, arrete apres verification.

Pages controlees en viewport mobile:

- `/vendre`
- `/deposer-annonce`
- `/dropshipping`

Resultats: H1 presents, panneaux de controle visibles, parcours client visible, aucune fuite AliExpress/Temu/supplier/fournisseur, aucun debordement horizontal, 0 warning/error console.

Captures:

- `tmp-next-couche-341-vendre-mobile.png`
- `tmp-next-couche-341-deposer-annonce-mobile.png`
- `tmp-next-couche-341-dropshipping-mobile.png`

## Prochain pas

Continuer la surface publique mobile: verifier les pages legales principales et les liens de navigation, puis reprendre le catalogue partenaire en HOLD avec preuves exactes avant toute vente.
