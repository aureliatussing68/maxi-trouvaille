# Rapport Maxi Trouvaille - couche 345

Date: 2026-06-18
Focus: guide mobile des rayons partenaires et lecture categorie detaillee.

## Objectif

Rendre chaque page de rayon partenaire plus explicite sur telephone: le client
voit le rayon, comprend que les articles restent en validation, puis retrouve
paiement Maxi Trouvaille, suivi colis et service client, sans fiche non prouvee
rendue achetable.

## Sauvegarde

Sauvegarde locale avant modifications:

- `business-maxi-trouvailles/backups/couche-345-guide-rayon-mobile-20260618/`

## Integration

- Ajout de `PartnerCategoryDemoGuidePanel` dans
  `src/components/PartnerMobileShowcasePanel.tsx`.
- Injection du guide sur les pages dynamiques de rayons partenaires via
  `src/app/categories/[slug]/page.tsx`.
- Le guide ajoute:
  - ordre de lecture du rayon sur mobile,
  - compteur de fiches en validation,
  - statut de mise en vente verrouillee tant que la validation manque,
  - checklist visible: image exacte, prix clair, stock lisible, delai client,
    droits image,
  - liens internes vers paiement, suivi colis et service client.

## Garde-fous

- Aucune publication production.
- Aucun deploiement.
- Aucun paiement, achat reel ou commande partenaire.
- Aucun message reel.
- Aucun produit incomplet rendu achetable.
- Aucun vocabulaire sensible visible dans la verification mobile: AliExpress,
  Temu, supplier, seller, marketplace, fournisseur, dropshipping, HOLD, fiche
  douteuse ou fiche fragile.

## Verifications

- `npm run catalog:audit-public-demo-copy` OK: 54 fichiers controles, 0 finding.
- `npx eslint src/components/PartnerMobileShowcasePanel.tsx src/app/categories/[slug]/page.tsx --no-warn-ignored` OK.
- `npm run typecheck` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards` OK: 0 finding.
- `npm run catalog:audit-checkout-eligibility` OK: 0 produit attendu achetable, 0 failure.
- `npm run catalog:audit-seo-hold-visibility` OK: 121 produits non publics, 0 failure.
- `npm run lint` OK.
- `npm run build` OK: 49 pages generees.
- `npm run catalog:audit-generated-artifact-leaks` OK: 0 finding.

## Verification mobile

Verification Playwright mobile 390x844 sur `http://127.0.0.1:3269`:

- `/categories/produits-partenaires` OK.
- `/categories/nouveautes-partenaires` OK.
- `/categories/promotions-partenaires` OK.
- `/categories/high-tech-partenaires` OK.
- `/categories/maison-partenaires` OK.
- Signaux du guide presents.
- Aucun terme sensible visible cote client.
- Aucun debordement horizontal.
- Aucune erreur ou warning console retenu.
- Capture: `tmp-next-couche-345-rayons-mobile.png`.

## Suite conseillee

Continuer sur une couche catalogue admin/HOLD: rendre la file de validation plus
lisible pour choisir les prochains articles a completer, sans publication ni
commande.
