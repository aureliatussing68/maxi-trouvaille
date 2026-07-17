# Audit noindex transactionnel

Date: 2026-06-19T01:58:38.175Z
Statut: OK

## Routes transactionnelles

| Route | Fichier | Attendu |
|---|---|---|
| /panier | src/app/panier/page.tsx | noindex |
| /paiement | src/app/paiement/page.tsx | noindex |
| /paiement/annule | src/app/paiement/annule/page.tsx | noindex,nofollow |
| /paiement/succes | src/app/paiement/succes/page.tsx | noindex,nofollow |
| /avis/laisser | src/app/avis/laisser/page.tsx | noindex,nofollow |
| /offline | src/app/offline/page.tsx | noindex,nofollow |

## Routes vitrine a garder indexables

| Route | Fichier | Attendu |
|---|---|---|
| /produits-partenaires | src/app/produits-partenaires/page.tsx | indexable |
| /nouveautes | src/app/nouveautes/page.tsx | indexable |
| /promotions | src/app/promotions/page.tsx | indexable |
| /boutique | src/app/boutique/page.tsx | indexable |

## Alertes

| Regle | Route | Fichier | Ligne | Extrait |
|---|---|---|---:|---|
| OK | - | - | - | - |

## Garde-fous

- Lecture seule: aucun catalogue modifie, aucun paiement, aucune commande, aucune publication.
- Les pages panier, paiement, avis et hors ligne ne doivent pas etre indexees.
- Les routes vitrine principales restent indexables.

