# Rapport Maxi couche 292 - Navigation lots actifs preuve/rayon

## Objectif

Permettre d'enchainer les couples preuve/rayon depuis le panneau actif mobile, sans redescendre dans la file et sans modifier le catalogue.

## Integration locale

- Ajout d'un calcul de position du lot actif dans la file preuve/rayon.
- Ajout des boutons `Lot precedent` et `Lot suivant` dans le panneau "File active".
- Le changement de lot reutilise la meme logique que les cartes de file: filtre preuve, rayon, premier brouillon, reset checklist locale et retour au panneau actif.
- Ajout du libelle de prochain lot pour savoir quel couple sera traite ensuite.
- Les coches locales restent de l'aide de pilotage uniquement et ne changent aucun statut produit.

## Garde-fous

- Aucun brouillon HOLD n'est publie ou rendu achetable.
- Aucune commande fournisseur, aucun paiement, aucun achat, aucune connexion compte, aucun message reel et aucun deploiement.
- Aucune exposition client de fournisseur, AliExpress, Temu ou supplier.

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
- Verification navigateur mobile sur `http://127.0.0.1:3117/admin/dropshipping` OK: selection `Droits image / Enfant`, affichage `Lot 2/3`, bouton `Lot suivant`, passage a `Droits image / Mode`, affichage `Lot 3/3`, prochain lot boucle vers `Droits image / Beaute`, checklist locale affichee a `0/5 cochees`, panneau actif conserve en haut, aucune erreur console, aucun debordement horizontal.

## Capture

- `tmp-next-couche-292-mobile.png`

## Suite conseillee

Ajouter un petit resume "3 lots de la file" directement dans le panneau actif pour visualiser la progression globale sans ouvrir les exports.
