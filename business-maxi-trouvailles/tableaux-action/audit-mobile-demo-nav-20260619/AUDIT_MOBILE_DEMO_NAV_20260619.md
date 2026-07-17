# Audit navigation mobile demo

Date locale: 2026-06-19 04:24 Europe/Paris

## Synthese

- Statut: OK
- Liens requis: 5
- Liens detectes: 5
- Routes service worker demo: 6
- Alertes: 0

## Liens mobile

| Libelle | URL | Source |
|---|---|---|
| Boutique | /boutique | ligne 14 |
| Partenaires | /produits-partenaires | ligne 19 |
| Nouveau | /nouveautes | ligne 25 |
| Promos | /promotions | ligne 31 |
| Suivi | /suivi-colis | ligne 37 |

## Routes service worker demo

| URL | Source |
|---|---|
| /boutique | ligne 10 |
| /produits-partenaires | ligne 10 |
| /nouveautes | ligne 12 |
| /promotions | ligne 12 |
| /suivi-colis | ligne 13 |
| /contact | ligne 14 |

## Alertes

| Regle | Fichier | Ligne | Detail |
|---|---|---:|---|
| OK | - | - | Aucun ecart detecte |

## Garde-fous

- Lecture seule sur le catalogue.
- Aucun lien mobile vers panier, paiement, admin, API ou anciennes routes sensibles.
- Alignement avec les raccourcis PWA publics et le service worker demo.
- Aucun paiement, achat, commande fournisseur, publication, message reel ou appel externe.

