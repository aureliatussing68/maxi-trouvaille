# Rapport Maxi couche 301 - avance locale du lot actif

Date: 2026-06-17 07:17 Europe/Paris

## Objectif

Rendre le cockpit dropshipping admin plus operationnel sur mobile: quand Mouss marque un brouillon comme traite localement, le lot actif avance automatiquement au prochain brouillon non traite en session.

## Integration

- Ajout d'une liste locale des brouillons encore a faire dans le lot actif.
- Le `Brouillon courant` pointe maintenant vers le premier produit non marque localement.
- Ajout du compteur mobile `A faire local`.
- Ajout du badge `A faire N` dans la fiche mobile du brouillon courant.
- Le bouton `Marquer traite localement` garde l'historique complet de session du lot actif, sans ecriture catalogue.
- Si tout le lot est coche localement, le bouton devient `Lot couvert localement` et reste desactive.
- La purge locale ajoutee en couche 300 remet bien le lot a zero pour reprendre.

## Verification

- `npm run lint` OK.
- `npm run typecheck` OK.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run catalog:audit-checkout-eligibility` OK.
- `npm run build` OK.
- Verification navigateur mobile OK:
  - activation d'un lot via `Filtrer ce couple`,
  - compteur `A faire` initial a 6,
  - marquage local du brouillon courant,
  - compteur `A faire` passe a 5,
  - brouillon courant passe de `miroir-maquillage-led-compact-partenaire-hold` a `bandeau-skincare-microfibre-partenaire-hold`,
  - historique local conserve le produit marque,
  - garde-fou `Pas de vente` visible,
  - aucun overflow horizontal,
  - aucune erreur console.

## Artefacts

- Screenshot mobile: `tmp-next-couche-301-mobile.png`.
- Logs serveur local: `tmp-next-couche-301-dev.out.log`, `tmp-next-couche-301-dev.err.log`.

## Securite

Aucune commande fournisseur, aucun paiement, aucun achat, aucune connexion compte, aucun deploiement, aucun message reel, aucune API payante, aucune suppression definitive.
