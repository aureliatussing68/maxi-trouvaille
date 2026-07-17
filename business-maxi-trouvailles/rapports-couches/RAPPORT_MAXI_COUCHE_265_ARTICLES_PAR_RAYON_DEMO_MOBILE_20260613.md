# Rapport couche 265 - Articles par rayon demo mobile

Date locale: 2026-06-13 13:58 Europe/Paris

## Objectif

Rendre les rayons partenaires moins vides pendant la demonstration telephone, en affichant des articles en validation directement dans les pages categories concernees, sans publier de fiche produit.

## Changements integres

- `PartnerArticlePreviewPanel` peut maintenant filtrer les articles par rayon.
- Pages categories partenaires vides: ajout d'une vitrine locale "Articles en validation pour ce rayon".
- Rayons enrichis:
  - High-tech: Mini imprimante thermique Bluetooth.
  - Accessoires: Organisateur de cables voyage.
  - Maison: Projecteur galaxie LED.
  - Auto / Moto: Mini aspirateur voiture sans fil.
  - Nouveautes: mini imprimante + projecteur galaxie.
  - Promotions: organisateur de cables + mini aspirateur voiture.

## Garde-fous confirmes

- Aucun produit publie.
- Aucun bouton d'achat ajoute.
- Aucun prix invente.
- Aucune photo produit non prouvee.
- Aucun fournisseur/AliExpress visible client.
- Aucun paiement, achat, commande fournisseur, message ou deploiement.

## Verifications

- Scan public vocabulaire/fuites: OK, 0 match sensible.
- `npm run catalog:audit-public-demo-copy`: OK, 0 finding.
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible/achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 finding.
- `npm run catalog:audit-public-visual-ambiguity`: OK, 0 failure.
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit achetable attendu.
- `npm run catalog:audit-seo-hold-visibility`: OK, HOLD non indexable.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- Verification navigateur mobile 390x844:
  - `/categories/high-tech-partenaires`: mini imprimante visible.
  - `/categories/accessoires-partenaires`: organisateur de cables visible.
  - `/categories/maison-partenaires`: projecteur galaxie visible.
  - `/categories/auto-moto-partenaires`: mini aspirateur voiture visible.
  - `/categories/nouveautes-partenaires`: mini imprimante + projecteur visibles.
  - `/categories/promotions-partenaires`: organisateur de cables + mini aspirateur visibles.
  - 0 erreur console, 0 image cassee, 0 overflow horizontal.

## Notes

Cette couche ameliore le parcours de demonstration: si Mouss clique sur un rayon depuis la boutique, il voit des exemples concrets en validation au lieu d'une page trop generique. Les fiches produits restent bloquees tant que les preuves exactes ne sont pas completes.
