# Audit sources catalogue public

Date locale: 2026-06-18 21:58 Europe/Paris

## Synthese

- Statut: OK
- Fichiers client publics surveilles: 19
- Routes publiques surveillees: 10
- Alertes: 0

| Regle | Fichier | Ligne | Detail |
|---|---|---:|---|
| OK | - | - | Aucun contournement detecte |

## Garde-fous

- Le panier global ne doit stocker que les lignes locales.
- Les vues panier et paiement doivent recevoir les produits via `getPublicProducts`.
- Les composants client publics ne doivent pas importer `products` ni de valeur depuis `@/lib/catalog`.
- Les routes publiques ne doivent pas importer `products` directement.
- Lecture seule: aucune publication, aucun paiement, aucune commande fournisseur.
