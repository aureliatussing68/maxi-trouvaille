# Rapport couche 242 - Verrou wording public

Date locale: 2026-06-13 07:10 Europe/Paris

## Objectif

Neutraliser un micro-vocabulaire trop interne dans le panneau public de vitrine
controlee, sans changer la logique catalogue et sans deployer.

## Changements

- `src/components/StorefrontReadinessPanel.tsx`
  - Remplace le wording public "mauvaise photo ni de fournisseur" par
    "mauvaise photo ni d'information interne".
- Aucun produit publie.
- Aucun paiement, aucune commande, aucun message reel, aucun achat, aucune API
  payante.
- Aucun deploiement production effectue dans cette couche.

## Verifications

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run catalog:audit-public-catalog-source-guards`: OK
- Verification locale ciblee: le panneau public ne contient plus le mot remplace.

## Etat

La production reste celle de la couche 241, deja prete pour demonstration mobile.
Cette couche garde la correction localement pour le prochain lot valide.
