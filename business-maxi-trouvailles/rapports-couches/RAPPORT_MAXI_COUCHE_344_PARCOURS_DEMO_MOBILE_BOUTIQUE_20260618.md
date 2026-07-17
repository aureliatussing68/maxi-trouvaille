# Rapport Maxi Trouvaille - couche 344

Date: 2026-06-18
Focus: parcours demo mobile boutique, rayons prioritaires et garde-fous publics.

## Objectif

Rendre la boutique plus facile a montrer sur telephone avec un chemin clair:
rayons partenaires, paiement Maxi Trouvaille, suivi colis et service client,
sans publier de fiche produit non prouvee.

## Sauvegarde

Sauvegarde locale avant modifications:

- `business-maxi-trouvailles/backups/couche-344-parcours-demo-mobile-20260618/`

## Integration

- Ajout de `src/components/PartnerDemoPathPanel.tsx`.
- Injection du panneau sur:
  - `src/app/boutique/page.tsx`
  - `src/app/categories/page.tsx`
  - `src/app/produits-partenaires/page.tsx`
- Le panneau expose un parcours demo mobile en 3 temps:
  1. ouvrir les rayons partenaires,
  2. rassurer sur le paiement Maxi Trouvaille,
  3. montrer le suivi colis et le service client.
- Ajout d'une selection courte de rayons a ouvrir en premier: nouveautes,
  promotions, high-tech, maison et accessoires, avec compteurs de validation.
- Ajout du nouveau composant a `scripts/automation/audit_public_demo_copy.mjs`.
- Correction d'un faux positif audit en evitant les identifiants internes rendus
  comme texte source auditable dans le composant.

## Garde-fous

- Aucune publication production.
- Aucun deploiement.
- Aucun paiement, achat reel ou commande partenaire.
- Aucun message reel.
- Aucun produit incomplet rendu achetable.
- Aucun terme sensible visible dans la verification mobile: AliExpress, Temu,
  supplier, seller, marketplace, fournisseur, dropshipping, HOLD, fiche douteuse
  ou fiche fragile.

## Verifications

- `npm run catalog:audit-public-demo-copy` OK: 54 fichiers controles, 0 finding.
- `npx eslint src/components/PartnerDemoPathPanel.tsx src/app/boutique/page.tsx src/app/categories/page.tsx src/app/produits-partenaires/page.tsx --no-warn-ignored` OK.
- `npm run typecheck` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards` OK: 0 finding.
- `npm run catalog:audit-checkout-eligibility` OK: 0 produit attendu achetable, 0 failure.
- `npm run catalog:audit-seo-hold-visibility` OK: 121 produits non publics, 0 failure.
- `npm run lint` OK.
- `npm run build` OK: 49 pages generees.
- `npm run catalog:audit-generated-artifact-leaks` OK: 0 finding.

## Verification mobile

Verification Playwright mobile 390x844 sur `http://127.0.0.1:3268`:

- `/boutique` OK.
- `/categories` OK.
- `/produits-partenaires` OK.
- Signaux du panneau presents.
- Aucun terme sensible visible cote client.
- Aucun debordement horizontal.
- Aucune erreur ou warning console retenu.
- Capture: `tmp-next-couche-344-demo-mobile.png`.

## Suite conseillee

Continuer sur une couche categorie detaillee: renforcer les pages de rayons
prioritaires une par une avec apercus d'articles en validation et ordre de
lecture mobile, sans ouvrir la vente tant que les preuves exactes manquent.
