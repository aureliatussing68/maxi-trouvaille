# Rapport Maxi couche 293 - Resume file active preuve/rayon

## Objectif

Rendre le panneau actif preuve/rayon plus autonome sur mobile: voir les 3 lots de la file sans redescendre vers les cartes ni ouvrir les exports.

## Integration locale

- Ajout d'un bloc `Resume file active` dans le panneau "File active".
- Le resume affiche les 3 couples preuve/rayon avec statut `Actif`, `Suivant` ou `En attente`.
- Chaque carte du resume montre le ratio pret apres preuve, les blocages lies et la priorite.
- Les cartes du resume sont cliquables et reutilisent la meme logique locale de selection de lot que la file principale.
- Ajout d'un rappel HOLD: les 3 lots restent en brouillon/HOLD et le resume sert uniquement a enchainer la reprise.

## Garde-fous

- Aucun changement de donnees catalogue, aucune publication, aucun produit rendu achetable.
- Les produits non prouves restent en HOLD/brouillon.
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
- Verification navigateur mobile sur `http://127.0.0.1:3118/admin/dropshipping` OK: selection `Droits image / Enfant`, bloc `Resume file active` visible, 3 cartes resume presentes, clic sur la carte `Suivant #3 Droits image / Mode`, bascule du lot actif vers `Mode`, resume mis a jour avec `Suivant #1`, `En attente #2`, `Actif #3`, panneau actif conserve en haut, checklist locale a `0/5 cochees`, aucune erreur console, aucun debordement horizontal.

## Capture

- `tmp-next-couche-293-mobile.png`

## Suite conseillee

Ajouter un export compact du resume file active pour coller rapidement l'etat des 3 lots dans une validation Mouss ou un rapport de reprise.
