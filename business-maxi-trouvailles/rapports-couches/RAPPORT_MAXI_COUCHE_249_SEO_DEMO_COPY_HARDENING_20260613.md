# Rapport couche 249 - Verrou demo SEO et copie publique

Date locale: 2026-06-13 11:23 Europe/Paris

## Objectif

Renforcer la surface publique pour la demonstration 20h: retirer le vocabulaire anxiogene restant, verrouiller les liens de rayons vers les URLs partenaires et confirmer que les fiches non validées restent invisibles/non indexables.

## Changements integres localement

- `src/components/StorefrontReadinessPanel.tsx`: remplacement du wording "fiche fragile" par "fiche produit non validée".
- `src/components/PartnerLaunchBoard.tsx`: remplacement du wording "fiches fragiles" par "fiches non validées" et liens de cartes corriges vers `/categories/*-partenaires`.
- `src/app/categories/[slug]/page.tsx`: empty state client aligne sur "fiche non validée".
- `scripts/automation/audit_public_demo_copy.mjs`: audit renforce pour bloquer le jargon `HOLD`, les formulations fiche fragile/douteuse et les anciens liens publics `/categories/dropshipping*`.

## Tests

- `npm run catalog:audit-public-demo-copy`: OK, 24 fichiers surveilles, 0 alerte
- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run catalog:audit-public-catalog-source-guards`: OK
- `npm run catalog:audit-public-visual-ambiguity`: OK
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible, 0 achetable, 91 brouillons bloques
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit attendu achetable
- `npm run catalog:audit-seo-hold-visibility`: OK, 121 produits non publics, 0 fiche HOLD indexable
- Browser mobile local `390x844` sur `/`, `/boutique`, `/produits-partenaires`, `/categories`, `/categories/produits-partenaires`, `/categories/nouveautes-partenaires`, `/livraison`, `/paiement`, `/suivi-colis`: OK, 0 texte interdit, 0 lien legacy, 0 overflow horizontal, 0 erreur console locale

## Garde-fous

Aucun paiement, aucune commande fournisseur, aucun achat reel, aucun message reel, aucune API payante, aucune publication produit et aucun deploiement production dans cette couche.
