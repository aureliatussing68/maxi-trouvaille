# Audit alias publics

Date locale: 2026-06-19 03:48 Europe/Paris

## Synthese

- Statut: OK
- Alias attendus: 15
- Alias detectes: 15
- Routes sitemap surveillees: 11
- Alertes: 0

## Alias redirects

| Source | Destination | Permanent | Ligne |
|---|---|---|---:|
| /aide | /faq | oui | 3 |
| /catalogue | /boutique | oui | 4 |
| /cgv | /conditions-generales-vente | oui | 5 |
| /conditions-dropshipping | /conditions-produits-partenaires | oui | 9 |
| /confidentialite | /politique-confidentialite | oui | 14 |
| /deposer-annonce | /produits-partenaires | oui | 19 |
| /dropshipping | /produits-partenaires | oui | 24 |
| /livraison-colis | /livraison | oui | 29 |
| /mentions | /mentions-legales | oui | 31 |
| /partenaires | /produits-partenaires | oui | 32 |
| /produits | /boutique | oui | 36 |
| /retours | /retours-remboursements | oui | 38 |
| /shop | /boutique | oui | 42 |
| /suivi | /suivi-colis | oui | 44 |
| /vendre | /produits-partenaires | oui | 45 |

## Alertes

| Regle | Fichier | Ligne | Detail |
|---|---|---:|---|
| OK | - | - | Aucun ecart detecte |

## Garde-fous

- Lecture seule sur le catalogue.
- Aucun changement produit, prix, stock, image ou commande.
- Aucun paiement, achat, commande fournisseur, message reel ou deploiement.
- Les anciennes routes sensibles doivent rester des alias permanents sans etre annoncees dans robots.

