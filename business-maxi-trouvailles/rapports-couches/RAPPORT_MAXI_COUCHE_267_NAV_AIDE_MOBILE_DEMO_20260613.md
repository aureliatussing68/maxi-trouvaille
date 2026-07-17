# Rapport couche 267 - Navigation aide mobile demo

Date locale: 2026-06-13 14:08 Europe/Paris

## Objectif

Rendre les pages d'aide plus faciles a trouver pendant une demonstration telephone, sans surcharger la navigation desktop.

## Changements integres

- Header mobile:
  - ajout des liens `Livraison`, `Retours`, `FAQ` sous la navigation principale.
- Footer:
  - ajout du lien `Paiement` dans la colonne boutique.

## Garde-fous confirmes

- Aucun produit publie.
- Aucun paiement active.
- Aucun achat fournisseur.
- Aucun message client envoye.
- Aucun deploiement.
- Aucun fournisseur/AliExpress visible client.

## Verifications

- Scan public vocabulaire/fuites: OK, 0 match sensible.
- `npm run catalog:audit-public-demo-copy`: OK, 0 finding.
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 finding.
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible/achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-visual-ambiguity`: OK, 0 failure.
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit achetable attendu.
- `npm run catalog:audit-seo-hold-visibility`: OK, HOLD non indexable.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- Verification navigateur mobile 390x844:
  - menu mobile ouvert: `Accueil`, `Partenaires`, `Nouveautes`, `Promos`, `Boutique`, `Paiement`, `Suivi`, `Contact`, `Livraison`, `Retours`, `FAQ` visibles;
  - footer: lien `Paiement` visible;
  - 0 erreur console, 0 overflow horizontal, 0 fuite sensible.

## Notes

Cette couche facilite la demonstration: Mouss peut ouvrir rapidement les pages qui rassurent les invites sur paiement, livraison, suivi, retours et FAQ.
