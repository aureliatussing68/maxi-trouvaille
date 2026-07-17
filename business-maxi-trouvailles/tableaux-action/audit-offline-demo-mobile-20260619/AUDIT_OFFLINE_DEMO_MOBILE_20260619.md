# Audit offline demo mobile

Date locale: 2026-06-19 04:24 Europe/Paris

## Synthese

- Statut: OK
- Liens offline detectes: 8
- Routes demo precachees: 6
- Signaux enregistrement PWA: 11
- Alertes: 0

## Liens offline

| URL | Ligne |
|---|---:|
| /boutique | 27 |
| /produits-partenaires | 33 |
| /suivi-colis | 39 |
| / | 80 |
| /produits-partenaires | 85 |
| /contact | 90 |
| / | 117 |
| /boutique | 123 |

## Routes demo precachees

| URL | Ligne |
|---|---:|
| /boutique | 10 |
| /produits-partenaires | 10 |
| /nouveautes | 12 |
| /promotions | 12 |
| /suivi-colis | 13 |
| /contact | 14 |

## Enregistrement PWA

| Signal | Ligne |
|---|---:|
| Client Component isole | 1 |
| API navigateur gardee | 10 |
| Contexte securise | 19 |
| Localhost IPv4 | 16 |
| Localhost IPv6 | 17 |
| Scope racine | 30 |
| URL service worker | 5 |
| Scope public | 6 |
| Register silencieux | 31 |
| Update silencieux | 37 |
| Annulation propre | 23 |

## Alertes

| Regle | Fichier | Ligne | Detail |
|---|---|---:|---|
| OK | - | - | Aucun ecart detecte |

## Garde-fous

- Lecture seule hors generation de rapport.
- Aucun raccourci offline vers admin, API, panier, paiement ou routes legacy sensibles.
- Aucun paiement, aucune commande partenaire, aucune publication.

