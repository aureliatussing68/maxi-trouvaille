# Rapport couche 298 - Historique local du lot actif

## Objectif
- Transformer le marqueur `dernier traite local` en mini historique local par lot actif.
- Garder une trace session courte des produits repris sans modifier le catalogue.
- Maintenir tous les produits en brouillon/HOLD tant que les preuves exactes et la validation Mouss ne sont pas completes.

## Integration
- L'etat local garde maintenant jusqu'a 3 produits traites par lot actif.
- Le bouton `Marquer traite localement` ajoute le produit en tete de l'historique.
- Les doublons sont dedupliques par slug.
- La carte mobile affiche `Historique local du lot` avec rang, nom et slug.
- Le retour a la file dynamique remet toujours l'historique local a zero.

## Garde-fous
- Historique local uniquement, sans ecriture catalogue.
- Aucun produit n'est publie ou rendu achetable.
- Aucun fournisseur, AliExpress, Temu ou mention supplier n'est expose cote client.
- Aucun paiement, achat, commande, connexion compte, message reel, suppression definitive, API payante ou deploiement production.

## Verifications
- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-admin-page-guards` OK.
- `npm run catalog:audit-checkout-eligibility` OK.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run catalog:audit-public-visual-ambiguity` OK.
- `npm run build` OK.
- Verification navigateur mobile admin sur `127.0.0.1:3123/admin/dropshipping` OK:
  - selection du lot `Droits image / Enfant`;
  - deux clics sur `Marquer traite localement`;
  - l'historique affiche une seule entree dedupliquee `#1 traite localement`;
  - nom affiche: `Protege coins silicone enfant`;
  - slug affiche: `protege-coins-silicone-enfant-partenaire-hold`;
  - HOLD et `Pas de vente` restent visibles;
  - aucune erreur console;
  - aucun debordement horizontal mobile.

## Preuve visuelle
- Capture: `tmp-next-couche-298-mobile.png`.

## Suite conseillee
- Ajouter un export texte court de l'historique local pour reprise manuelle, sans persistance ni publication.
